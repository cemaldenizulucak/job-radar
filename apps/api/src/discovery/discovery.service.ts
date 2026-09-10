import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SourceId } from '../common/domain.types.js';
import { assertAllowedJobSourceUrl } from '../common/job-source-url.js';
import { hasExplicitSearchLocationFilter, coalesceSubdivisionNames } from '../common/search-location.js';
import { DuplicateGroupsService } from '../duplicates/duplicate-groups.service.js';
import { LocationsService } from '../locations/locations.service.js';
import { DuplicatesService } from '../duplicates/duplicates.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { mergeNormalizedJobUpdate } from '../jobs/listing-merge.js';
import type { CatalogListingRecord, NormalizedJob } from '../jobs/jobs.types.js';
import { sourceListingIdentity } from '../jobs/job-identity.js';
import { MatchingService } from '../matching/matching.service.js';
import { MATCH_STATUS, parseMatchStatus } from '../matching/match-status.js';
import { queryMatchKind } from '../matching/match-text.js';
import type { JobSearchMatch, MatchableJob } from '../matching/matching.types.js';
import {
  collectUnverifiedSourceCandidates,
  type SearchScopedProvenance,
} from '../matching/source-candidate-match.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { selectVisibleNewMatches } from '../notifications/discovery-notification.js';
import type { PersistedJobForNotification } from '../notifications/notifications.types.js';
import { TelegramNotificationService } from '../notifications/telegram-notification.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { SavedSearch } from '../searches/searches.types.js';
import { SearchesService } from '../searches/searches.service.js';
import type { SourceSearchQuery, SourceJobRaw, SourceDetailFetchOutcome } from '../sources/job-source.adapter.js';
import { sourceErrorCategory, isSourceCircuitBreakError } from '../sources/source-errors.js';
import { SourceRegistry } from '../sources/source-registry.js';
import { KARIYER_NET_DEFAULT_MAX_DETAIL_REQUESTS } from '../sources/kariyer-net/kariyer-net-web.config.js';
import {
  DEFAULT_JOB_INACTIVE_AFTER_DAYS,
  DEFAULT_JOB_SOURCE_MAX_AGE_DAYS,
  inactiveNotSeenCutoff,
  isWithinSourceMaxAge,
  readPositiveIntEnv,
} from './discovery-window.js';
import { selectDetailCandidates } from './detail-candidates.js';
import type { DetailCandidate } from './detail-candidates.js';
import { recordProvenance } from './source-job-provenance.js';
import type { SourceQueryProvenance } from './source-job-provenance.js';
import { DiscoveryRunGate } from './discovery-run-gate.js';
import {
  DiscoveryRunStateStore,
  type DetailQueueEnqueueInput,
  type DetailQueueItem,
  type DetailQueueReason,
} from './discovery-run-state.js';
import {
  EMPTY_DISCOVERY_SUMMARY,
  FAILED_DISCOVERY_RESULT,
  PENDING_DISCOVERY_RESULT,
  toImmediateDiscoveryResult,
  type DetailQueueBackfillReport,
  type DiscoveryRunSummary,
  type ImmediateDiscoveryResult,
  type ListingDiagnosis,
  type ListingDetailRefreshResult,
  type MatchReevaluationPair,
  type MatchReevaluationReport,
} from './discovery.types.js';
import { listingDiagnosisFromDecision } from './listing-diagnostics.js';
import { diffJobSearchMatches } from './match-reevaluation.js';
import { normalizeSourceJob } from './job-normalizer.js';
import {
  listingMatchesDiagnosisTarget,
  parseDiagnosisListingUrl,
} from './diagnosis-listing-url.js';
import {
  countQueryOutcomes,
  toQueryTelemetry,
  type QueryUnitOutcome,
} from './query-accounting.js';
import {
  DEFAULT_MAX_QUERIES_PER_SEARCH_SOURCE,
  DEFAULT_TIME_BUDGET_MS_PER_SEARCH_SOURCE,
  readKariyerNetMaxQueriesPerHour,
  buildSourceQueryUnits,
  nextQueryStartIndex,
  queryUnitKey,
  resolveScanKind,
  selectQueryUnits,
  sourceQueryPlanFingerprint,
  type ScanKind,
  type SourceQueryUnit,
} from './source-query-plan.js';
import {
  collectUniqueSourceQueries,
  scheduleQueriesRoundRobin,
} from './source-query-schedule.js';

type SearchSourceFetchStat = {
  savedSearchId: string;
  source: SourceId;
  fetchedJobCount: number;
  normalizedJobCount: number;
  queriesPlanned: number;
  queriesAttempted: number;
  queriesCompleted: number;
  queriesBlocked: number;
  queriesFailed: number;
  queriesDeferred: number;
  queriesPartialBlocked: number;
  detailsFetched: number;
  detailsFailed: number;
  detailsSelected: number;
  detailsAttempted: number;
  detailsSkipped: number;
  detailsBackoff: number;
  detailsQueued: number;
  providerMode: string | null;
};

const EMPTY_QUERY_TELEMETRY = toQueryTelemetry(countQueryOutcomes([]));

type DetailIntent = Omit<DetailQueueEnqueueInput, 'jobId'> & {
  identity: string;
  title: string;
};

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly runGate = new DiscoveryRunGate();
  private readonly immediateRuns = new Map<string, ImmediateDiscoveryResult>();
  private kariyerNetRoundRobinOffset = 0;

  constructor(
    @Inject(forwardRef(() => SearchesService))
    private readonly searchesService: SearchesService,
    private readonly sourceRegistry: SourceRegistry,
    private readonly matchingService: MatchingService,
    private readonly duplicatesService: DuplicatesService,
    private readonly duplicateGroupsService: DuplicateGroupsService,
    private readonly jobsService: JobsService,
    private readonly notificationsService: NotificationsService,
    private readonly profilesService: ProfilesService,
    private readonly config: ConfigService,
    private readonly locationsService: LocationsService,
    @Inject(DiscoveryRunStateStore)
    private readonly runState: DiscoveryRunStateStore,
    @Optional()
    private readonly telegramNotifications?: TelegramNotificationService,
  ) {
    void this.profilesService;
  }

  async run(): Promise<DiscoveryRunSummary> {
    return this.runGate.runExclusive(async () => {
      const searches = await this.searchesService.getActiveSearches();
      const loadTelemetry = this.searchesService.consumeActiveLoadTelemetry();
      return this.execute(searches, {
        markStale: true,
        trigger: 'scheduled',
        attemptCount: loadTelemetry.attemptCount,
        recoveredAfterRetry: loadTelemetry.recoveredAfterRetry,
      });
    });
  }

  async runForSavedSearch(savedSearch: SavedSearch): Promise<DiscoveryRunSummary> {
    if (!savedSearch.isActive) {
      return { ...EMPTY_DISCOVERY_SUMMARY };
    }

    return this.runGate.runForSearch(savedSearch.id, () =>
      this.execute([savedSearch], { markStale: false, trigger: 'user' }),
    );
  }

  getImmediateRun(savedSearchId: string): ImmediateDiscoveryResult | null {
    return this.immediateRuns.get(savedSearchId) ?? null;
  }

  enqueueForSavedSearch(savedSearch: SavedSearch): ImmediateDiscoveryResult {
    this.immediateRuns.set(savedSearch.id, PENDING_DISCOVERY_RESULT);
    void this.runEnqueuedSearch(savedSearch);
    return PENDING_DISCOVERY_RESULT;
  }

  /**
   * Explains why a listing is missing from a saved search when the catalog
   * row is already loaded. Does not dump the full catalog.
   */
  async diagnoseListing(input: {
    savedSearchId: string;
    sourceId?: SourceId;
    sourceJobId?: string;
    url?: string;
  }): Promise<ListingDiagnosis | null> {
    const parsedUrl = input.url ? parseDiagnosisListingUrl(input.url) : null;
    const searches = await this.searchesService.getActiveSearches();
    const search = searches.find((item) => item.id === input.savedSearchId);
    if (!search) {
      return null;
    }

    const catalogJobs = await this.loadCatalogJobs();
    const job = catalogJobs.find((item) =>
      listingMatchesDiagnosisTarget(item, { ...input, parsedUrl }),
    );
    const decision = job ? this.matchingService.evaluateMatch(job, search) : null;
    return listingDiagnosisFromDecision({
      job: job ?? null,
      decision,
      maxAgeDays: this.maxAgeDays(),
      publishedAt: job?.publishedAt,
      isActive: job?.isActive,
    });
  }

  /**
   * Re-evaluates stored job_search_matches with current matching rules.
   * Does not fetch job sources. Does not delete listings or applications.
   * Defaults to dry-run so live data is only changed after an explicit apply.
   */
  async rematchStoredMatches(
    options: { dryRun?: boolean } = {},
  ): Promise<MatchReevaluationReport> {
    const dryRun = options.dryRun !== false;
    return this.runGate.runExclusive(async () => {
      const searches = await this.searchesService.getActiveSearches();
      const catalogJobs = await this.loadCatalogJobs();
      const searchIds = searches.map((search) => search.id);
      const existing = await this.jobsService.listMatchesForSearches(searchIds);
      const desired = this.matchingService.matchJobsToSearches(
        catalogJobs,
        searches,
      );
      const describedJobIds = new Set(
        catalogJobs
          .filter((job) => Boolean(job.description?.trim()))
          .map((job) => job.id),
      );
      const pendingUnverified = existing.filter(
        (match) =>
          parseMatchStatus(match.matchStatus) ===
            MATCH_STATUS.unverifiedSourceCandidate &&
          !describedJobIds.has(match.jobId),
      );
      const pendingKeys = new Set(
        pendingUnverified.map(
          (match) => `${match.jobId}:${match.savedSearchId}`,
        ),
      );
      const existingForDiff = existing.filter(
        (match) => !pendingKeys.has(`${match.jobId}:${match.savedSearchId}`),
      );
      const diff = diffJobSearchMatches(existingForDiff, desired);
      const keptMatches = [...diff.keep, ...pendingUnverified];

      if (!dryRun) {
        await this.jobsService.syncMatchesForSearches(searchIds, desired);
        await this.jobsService.reconcileUnverifiedSourceCandidates({
          searchIds,
          candidates: [],
          describedJobIds,
        });
      }

      const titles = new Map(catalogJobs.map((job) => [job.id, job.title]));
      const names = new Map(searches.map((search) => [search.id, search.name]));
      const annotate = (match: JobSearchMatch): MatchReevaluationPair => ({
        jobId: match.jobId,
        savedSearchId: match.savedSearchId,
        title: titles.get(match.jobId),
        searchName: names.get(match.savedSearchId),
      });

      this.logger.log({
        message: dryRun
          ? 'Match re-evaluation preview'
          : 'Match re-evaluation applied',
        dryRun,
        searchesEvaluated: searches.length,
        jobsEvaluated: catalogJobs.length,
        existingMatches: existing.length,
        desiredMatches: desired.length,
        keepCount: keptMatches.length,
        insertCount: diff.insert.length,
        deleteCount: diff.remove.length,
      });

      return {
        dryRun,
        searchesEvaluated: searches.length,
        jobsEvaluated: catalogJobs.length,
        existingMatches: existing.length,
        desiredMatches: desired.length,
        keepCount: keptMatches.length,
        insertCount: diff.insert.length,
        deleteCount: diff.remove.length,
        listingsUnchanged: true,
        applicationsUnchanged: true,
        sampleKept: keptMatches.slice(0, 10).map(annotate),
        sampleInserts: diff.insert.slice(0, 10).map(annotate),
        sampleDeletes: diff.remove.slice(0, 10).map(annotate),
      };
    });
  }

  async refreshListingDetail(input: {
    jobId: string;
  }): Promise<ListingDetailRefreshResult> {
    const jobId = input.jobId.trim();
    if (!jobId) {
      throw new BadRequestException('jobId is required.');
    }

    const listing = await this.jobsService.getListingById(jobId);
    if (!listing) {
      throw new NotFoundException('Job not found.');
    }

    let storedUrl: URL;
    try {
      storedUrl = assertAllowedJobSourceUrl(listing.canonicalUrl);
    } catch {
      throw new BadRequestException('Stored listing URL is not allowed.');
    }

    const adapter = this.sourceRegistry.get(listing.sourceId);
    if (!adapter?.isEnabled() || !adapter.enrichMissingDescriptions) {
      throw new BadRequestException('Listing source cannot fetch details.');
    }

    const raw: SourceJobRaw = {
      sourceJobId: listing.sourceJobId,
      canonicalUrl: storedUrl.toString(),
      title: listing.title,
      companyName: listing.companyName,
      location: listing.location ?? undefined,
      workModel: listing.workModel ?? undefined,
      description: listing.description ?? undefined,
      publishedAt: listing.publishedAt ?? undefined,
      experienceLevel: listing.experienceLevel ?? undefined,
      technologies: listing.technologies,
    };

    let detailFetched = false;
    let requestSucceeded = false;
    let descriptionExtracted = false;
    let errorCategory: string | null = null;
    let httpStatus: number | null = null;
    let enriched = raw;
    try {
      const result = await adapter.enrichMissingDescriptions([raw]);
      enriched = result.jobs[0] ?? raw;
      const outcome = result.outcomes?.[0] ?? fallbackOutcome(result, listing.sourceJobId);
      requestSucceeded = outcome.requestSucceeded;
      detailFetched = outcome.detailFetched;
      descriptionExtracted = outcome.descriptionExtracted;
      errorCategory = outcome.errorCategory;
      httpStatus = outcome.httpStatus;
    } catch (error) {
      this.logger.warn({
        message: 'Listing detail refresh failed',
        jobId,
        source: listing.sourceId,
        errorCategory: 'unavailable',
        error: error instanceof Error ? error.message : 'unknown',
      });
      requestSucceeded = false;
      detailFetched = false;
      descriptionExtracted = false;
      errorCategory = 'unavailable';
    }

    const incoming = normalizeSourceJob(listing.sourceId, enriched);
    if (!incoming) {
      throw new BadRequestException('Listing could not be normalized.');
    }

    const merged = mergeNormalizedJobUpdate(incoming, listing);
    await this.jobsService.upsertNormalized(merged);
    const descriptionStored = Boolean(merged.description?.trim());

    const searches = await this.searchesService.getActiveSearches();
    const matchable = toMatchableJob(jobId, merged);
    const desired = this.matchingService.matchJobsToSearches(
      [matchable],
      searches,
    );
    const created = await this.jobsService.syncMatchesForSearches(
      searches.map((search) => search.id),
      desired.map((match) => ({
        ...match,
        matchStatus: MATCH_STATUS.verified,
      })),
    );
    const queueItem = (await this.runState.listQueueItems()).find(
      (item) => item.jobId === jobId,
    );
    const provenances = provenancesFromQueueItem(jobId, queueItem);
    const unverified = collectUnverifiedSourceCandidates({
      jobs: [matchable],
      searches,
      provenances,
      detailErrorByJobId: new Map([[jobId, errorCategory]]),
      evaluateMatch: (job, search) =>
        this.matchingService.evaluateMatch(job, search),
      verifiedKeys: new Set(desired.map((match) => `${match.jobId}:${match.savedSearchId}`)),
    });
    await this.jobsService.reconcileUnverifiedSourceCandidates({
      searchIds: searches.map((search) => search.id),
      candidates: unverified,
      describedJobIds: descriptionStored ? new Set([jobId]) : new Set(),
    });
    const decisions = searches.map((search) => {
      const decision = this.matchingService.evaluateMatch(matchable, search);
      return {
        savedSearchId: search.id,
        matched: decision.matched,
        keyword: decision.keyword,
        location: decision.location,
      };
    });

    const nowIso = new Date().toISOString();
    if (detailFetched && descriptionExtracted && descriptionStored) {
      await this.runState.completeDetail(jobId);
    } else {
      await this.runState.failDetail(
        jobId,
        errorCategory ?? 'empty',
        nowIso,
      );
    }

    return {
      jobId,
      requestSucceeded,
      detailFetched,
      descriptionExtracted,
      descriptionStored,
      errorCategory,
      httpStatus,
      matchesCreated: created.length,
      decisions,
    };
  }

  async backfillDetailQueue(
    options: { dryRun?: boolean } = {},
  ): Promise<DetailQueueBackfillReport> {
    const dryRun = options.dryRun !== false;
    const searches = await this.searchesService.getActiveSearches();
    const eligible = await this.jobsService.listEmptyDescriptionListings();
    const ranked = [...eligible].sort((left, right) => {
      const leftFit = this.locationFitsActiveSearches(left, searches) ? 0 : 1;
      const rightFit = this.locationFitsActiveSearches(right, searches) ? 0 : 1;
      if (leftFit !== rightFit) {
        return leftFit - rightFit;
      }
      return left.id.localeCompare(right.id);
    });

    const items: DetailQueueEnqueueInput[] = ranked.map((listing) => ({
      jobId: listing.id,
      sourceId: listing.sourceId,
      sourceJobId: listing.sourceJobId,
      sourceUrl: listing.canonicalUrl,
      priority: this.locationFitsActiveSearches(listing, searches) ? 2 : 3,
      reason: 'backfill',
      queryTermKind: null,
      queryTerm: null,
      queryLocation: listing.location,
    }));

    const queuedCount = dryRun
      ? items.length
      : (await this.runState.enqueueDetails(items)).queuedCount;

    this.logger.log({
      message: dryRun
        ? 'Detail queue backfill preview'
        : 'Detail queue backfill applied',
      dryRun,
      eligibleCount: eligible.length,
      queuedCount,
    });

    return {
      dryRun,
      eligibleCount: eligible.length,
      queuedCount,
      samples: ranked.slice(0, 10).map((listing) => ({
        jobId: listing.id,
        title: clipLogTitle(listing.title),
        sourceId: listing.sourceId,
        location: listing.location,
      })),
    };
  }

  private locationFitsActiveSearches(
    listing: Pick<CatalogListingRecord, 'location' | 'title' | 'sourceId' | 'id'>,
    searches: readonly SavedSearch[],
  ): boolean {
    const locationSearches = searches.filter((search) =>
      hasExplicitSearchLocationFilter(search),
    );
    if (locationSearches.length === 0) {
      return searches.length > 0;
    }

    const job = {
      id: listing.id,
      sourceId: listing.sourceId,
      title: listing.title,
      companyName: '',
      description: null,
      location: listing.location,
      workModel: null,
      experienceLevel: null,
      technologies: [],
    };
    return locationSearches.some(
      (search) => this.matchingService.evaluateMatch(job, search).location === 'pass',
    );
  }

  private async runEnqueuedSearch(savedSearch: SavedSearch): Promise<void> {
    try {
      const summary = await this.runForSavedSearch(savedSearch);
      this.immediateRuns.set(
        savedSearch.id,
        toImmediateDiscoveryResult(summary, new Date().toISOString()),
      );
    } catch (error) {
      this.logger.error({
        message: 'Background discovery failed after the search was saved',
        savedSearchId: savedSearch.id,
        userId: savedSearch.userId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      this.immediateRuns.set(savedSearch.id, FAILED_DISCOVERY_RESULT);
    }
  }

  private async execute(
    searches: readonly SavedSearch[],
    options: {
      markStale: boolean;
      trigger: 'scheduled' | 'user';
      attemptCount?: number;
      recoveredAfterRetry?: boolean;
    },
  ): Promise<DiscoveryRunSummary> {
    if (searches.length === 0) {
      return { ...EMPTY_DISCOVERY_SUMMARY };
    }

    await this.locationsService.primeSubdivisionCaches(
      searches
        .map((search) => search.countryCode)
        .filter((code): code is string => Boolean(code)),
    );

    const runId = randomUUID();
    const catalogJobs = await this.loadCatalogJobs();
    const catalogMatches = this.matchingService.matchJobsToSearches(
      catalogJobs,
      searches,
    );

    const fetched = await this.fetchNormalizedJobs(searches, {
      trigger: options.trigger,
      runId,
    });
    let jobsInserted = 0;
    let jobsUpdated = 0;
    const persisted: MatchableJob[] = [];
    const persistedForNotification: PersistedJobForNotification[] = [];

    for (const job of fetched.uniqueJobs) {
      const result = await this.jobsService.upsertNormalized(job);
      const matchable = toMatchableJob(result.id, job);
      if (result.inserted) {
        jobsInserted += 1;
      } else {
        jobsUpdated += 1;
      }

      persisted.push(matchable);
      persistedForNotification.push({
        id: result.id,
        sourceId: job.sourceId,
        isActive: job.isActive,
        publishedAt: job.publishedAt,
      });
    }

    const detailDrain = await this.enqueueAndDrainDetails({
      runId,
      uniqueJobs: fetched.uniqueJobs,
      persisted,
      intents: fetched.detailIntents,
      searches,
      deferKariyerNetDetailsDueToChallenge: fetched.sourceChallengeObserved,
    });
    jobsInserted += detailDrain.jobsInserted;
    jobsUpdated += detailDrain.jobsUpdated;

    const matchableJobs = mergeJobLists(catalogJobs, persisted);
    const liveMatches = this.matchingService.matchJobsToSearches(
      persisted,
      searches,
    );
    const allMatches = uniqueMatches([...catalogMatches, ...liveMatches]).map(
      (match) => ({
        ...match,
        matchStatus: MATCH_STATUS.verified,
      }),
    );
    const createdMatches = await this.jobsService.syncMatchesForSearches(
      searches.map((search) => search.id),
      allMatches,
    );
    const provenancesByJobId = provenancesByPersistedJob(
      persisted,
      fetched.jobProvenances,
    );
    const verifiedKeys = new Set(
      allMatches.map((match) => `${match.jobId}:${match.savedSearchId}`),
    );
    const unverified = collectUnverifiedSourceCandidates({
      jobs: persisted,
      searches,
      provenances: provenancesByJobId,
      detailErrorByJobId: detailDrain.detailErrorByJobId,
      evaluateMatch: (job, search) =>
        this.matchingService.evaluateMatch(job, search),
      verifiedKeys,
    });
    const unverifiedCreated = await this.jobsService.reconcileUnverifiedSourceCandidates({
      searchIds: searches.map((search) => search.id),
      candidates: unverified,
      describedJobIds: new Set(
        matchableJobs
          .filter((job) => Boolean(job.description?.trim()))
          .map((job) => job.id),
      ),
    });
    const discoveredAt = new Date().toISOString();
    await this.searchesService.markDiscoveredAt(
      searches.map((search) => search.id),
      discoveredAt,
    );
    const jobsForNotification = mergeNotificationJobs(
      catalogJobsForNotification(catalogJobs, catalogMatches),
      persistedForNotification,
    );
    const visible = selectVisibleNewMatches(
      createdMatches,
      jobsForNotification,
      this.maxAgeDays(),
    );
    const telegramVisible = selectVisibleNewMatches(
      uniqueMatches([...createdMatches, ...unverifiedCreated]),
      jobsForNotification,
      this.maxAgeDays(),
    );
    const matchesCreated = createdMatches.length;
    const notifiedJobCount = visible.jobs.length;

    if (options.markStale) {
      await this.markStaleJobsInactive();
    }

    const candidates = await this.jobsService.listDuplicateCandidates();
    const { groups } = this.duplicatesService.detectRelationships(candidates);
    const duplicateGroupsCreated =
      await this.duplicateGroupsService.saveGroups(groups);

    const notificationsCreated = await this.createDiscoveryNotifications(
      visible.matches,
      visible.jobs,
      searches,
    );
    await this.sendTelegramNotifications(
      telegramVisible.matches,
      matchableJobs,
      searches,
    );

    const usersProcessed = new Set(searches.map((search) => search.userId)).size;
    this.logSavedSearchMatchDebug({
      searches,
      catalogJobs,
      allJobs: matchableJobs,
      fetchStats: fetched.perSearch,
      createdMatches,
      lastDiscoveryAt: discoveredAt,
    });
    this.logDiscoveryCounts({
      usersProcessed,
      searchesProcessed: searches.length,
      jobsFetched: fetched.jobsFetched,
      jobsInserted,
      matchesCreated,
      catalogJobsChecked: catalogJobs.length,
      rawProviderJobs: fetched.rawProviderJobs,
      normalizedJobs: fetched.uniqueJobs.length,
      visibleMatchesCreated: visible.matches.length,
      notifiedJobCount,
    });

    this.logger.log({
      message: 'Discovery run telemetry',
      runId,
      scanKind: fetched.scanKind,
      providerModes: fetched.providerModes,
      queriesPlanned: fetched.queriesPlanned,
      queriesAttempted: fetched.queriesAttempted,
      queriesCompleted: fetched.queriesCompleted,
      queriesBlocked: fetched.queriesBlocked,
      queriesFailed: fetched.queriesFailed,
      queriesDeferred: fetched.queriesDeferred,
      queriesPartialBlocked: fetched.queriesPartialBlocked,
      sourceChallengeObserved: fetched.sourceChallengeObserved,
      detailsFetched: detailDrain.detailsFetched,
      detailsFailed: detailDrain.detailsFailed,
      detailsSelected: detailDrain.detailsSelected,
      detailsAttempted: detailDrain.detailsAttempted,
      detailsSkipped: detailDrain.detailsSkipped,
      detailsBackoff: fetched.perSearch.reduce(
        (total, stat) => total + stat.detailsBackoff,
        0,
      ),
      detailsQueued: detailDrain.detailsQueued,
      detailsRequested: detailDrain.detailsRequested,
      detailsDeferredDueToChallenge: detailDrain.detailsDeferredDueToChallenge,
      descriptionsExtracted: detailDrain.descriptionsExtracted,
      kariyerNetPagesFetched: fetched.kariyerNetPagesFetched,
      kariyerNetJobsCollected: fetched.kariyerNetJobsCollected,
      stopReason: fetched.stopReason,
      attemptCount: options.attemptCount ?? 1,
      recoveredAfterRetry: options.recoveredAfterRetry === true,
    });

    return {
      usersProcessed,
      searchesProcessed: searches.length,
      jobsFetched: fetched.jobsFetched,
      jobsInserted,
      jobsUpdated,
      matchesCreated,
      duplicateGroupsCreated,
      notificationsCreated,
      kariyerNetPagesFetched: fetched.kariyerNetPagesFetched,
      kariyerNetJobsCollected: fetched.kariyerNetJobsCollected,
      stopReason: fetched.stopReason,
      sourceAttempts: fetched.sourceAttempts,
      sourceFailures: fetched.sourceFailures,
      sourcePartials: fetched.sourcePartials,
      catalogJobsChecked: catalogJobs.length,
      rawProviderJobs: fetched.rawProviderJobs,
      normalizedJobs: fetched.uniqueJobs.length,
      notifiedJobCount,
      runId,
      scanKind: fetched.scanKind,
      queriesPlanned: fetched.queriesPlanned,
      queriesAttempted: fetched.queriesAttempted,
      queriesCompleted: fetched.queriesCompleted,
      queriesBlocked: fetched.queriesBlocked,
      queriesFailed: fetched.queriesFailed,
      queriesDeferred: fetched.queriesDeferred,
      queriesPartialBlocked: fetched.queriesPartialBlocked,
      sourceChallengeObserved: fetched.sourceChallengeObserved,
      detailsFetched: detailDrain.detailsFetched,
      detailsFailed: detailDrain.detailsFailed,
      detailsSelected: detailDrain.detailsSelected,
      detailsAttempted: detailDrain.detailsAttempted,
      detailsSkipped: detailDrain.detailsSkipped,
      detailsBackoff: fetched.perSearch.reduce(
        (total, stat) => total + stat.detailsBackoff,
        0,
      ),
      detailsQueued: detailDrain.detailsQueued,
      detailsRequested: detailDrain.detailsRequested,
      detailsDeferredDueToChallenge: detailDrain.detailsDeferredDueToChallenge,
      descriptionsExtracted: detailDrain.descriptionsExtracted,
      providerModes: fetched.providerModes,
      attemptCount: options.attemptCount ?? 1,
      recoveredAfterRetry: options.recoveredAfterRetry === true,
    };
  }

  private async createDiscoveryNotifications(
    createdMatches: readonly JobSearchMatch[],
    jobs: readonly { id: string; sourceId: MatchableJob['sourceId'] }[],
    searches: readonly SavedSearch[],
  ): Promise<number> {
    if (createdMatches.length === 0) {
      return 0;
    }

    try {
      return await this.notificationsService.createForNewMatches({
        runId: randomUUID(),
        jobs,
        searchOwners: new Map(
          searches.map((search) => [search.id, search.userId]),
        ),
        matches: createdMatches,
      });
    } catch (error) {
      this.logger.warn({
        message: 'Discovery notifications failed; jobs were still stored',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return 0;
    }
  }

  private async sendTelegramNotifications(
    matches: readonly JobSearchMatch[],
    jobs: readonly MatchableJob[],
    searches: readonly SavedSearch[],
  ): Promise<void> {
    if (!this.telegramNotifications || matches.length === 0) {
      return;
    }

    try {
      await this.telegramNotifications.notifyNewMatches({
        matches,
        jobs: jobs.map((job) => ({
          id: job.id,
          sourceId: job.sourceId,
          title: job.title,
          companyName: job.companyName,
          location: job.location,
          canonicalUrl: job.canonicalUrl ?? null,
        })),
        searches: searches.map((search) => ({
          id: search.id,
          name: search.name,
          userId: search.userId,
        })),
      });
    } catch (error) {
      this.logger.warn({
        message: 'Telegram notifications failed; discovery continues',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private async loadCatalogJobs(): Promise<MatchableJob[]> {
    try {
      const catalog = await this.jobsService.listMatchableActiveJobs();
      this.logger.log({
        message: 'Catalog jobs loaded for rematch',
        catalogJobsChecked: catalog.length,
      });
      return catalog;
    } catch (error) {
      this.logger.error({
        message: 'Failed to load catalog jobs for rematch',
        catalogJobsChecked: 0,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return [];
    }
  }

  private async fetchNormalizedJobs(
    searches: readonly SavedSearch[],
    options: { trigger: 'scheduled' | 'user'; runId: string },
  ): Promise<{
    jobsFetched: number;
    uniqueJobs: NormalizedJob[];
    rawProviderJobs: number;
    kariyerNetPagesFetched: number;
    kariyerNetJobsCollected: number;
    stopReason: string | null;
    sourceAttempts: number;
    sourceFailures: number;
    sourcePartials: number;
    perSearch: readonly SearchSourceFetchStat[];
    scanKind: ScanKind | 'mixed';
    queriesPlanned: number;
    queriesAttempted: number;
    queriesCompleted: number;
    queriesBlocked: number;
    queriesFailed: number;
    queriesDeferred: number;
    queriesPartialBlocked: number;
    sourceChallengeObserved: boolean;
    providerModes: Record<string, string>;
    detailIntents: readonly DetailIntent[];
    jobProvenances: ReadonlyMap<string, readonly SearchScopedProvenance[]>;
  }> {
    const uniqueJobs = new Map<string, NormalizedJob>();
    let jobsFetched = 0;
    let rawProviderJobs = 0;
    let kariyerNetPagesFetched = 0;
    let kariyerNetJobsCollected = 0;
    let stopReason: string | null = null;
    let sourceAttempts = 0;
    let sourceFailures = 0;
    let sourcePartials = 0;
    let queriesPlanned = 0;
    let queriesAttempted = 0;
    let queriesCompleted = 0;
    let queriesBlocked = 0;
    let queriesFailed = 0;
    let queriesDeferred = 0;
    let queriesPartialBlocked = 0;
    let sourceChallengeObserved = false;
    const detailIntents: DetailIntent[] = [];
    const intentKeys = new Set<string>();
    const jobProvenances = new Map<string, SearchScopedProvenance[]>();
    const providerModes: Record<string, string> = {};
    const scanKinds = new Set<ScanKind>();
    const perSearch: SearchSourceFetchStat[] = [];
    const catalogSourceIds = this.sourceRegistry
      .list()
      .map((adapter) => adapter.sourceId);

    const recordFetched = (
      search: SavedSearch,
      sourceId: SourceId,
      fetched: Awaited<ReturnType<DiscoveryService['fetchFromSource']>>,
      mode: 'full' | 'kariyer-stats' = 'full',
    ) => {
      perSearch.push({
        savedSearchId: search.id,
        source: sourceId,
        fetchedJobCount: fetched.raw,
        normalizedJobCount: fetched.accepted,
        queriesPlanned: fetched.queriesPlanned,
        queriesAttempted: fetched.queriesAttempted,
        queriesCompleted: fetched.queriesCompleted,
        queriesBlocked: fetched.queriesBlocked,
        queriesFailed: fetched.queriesFailed,
        queriesDeferred: fetched.queriesDeferred,
        queriesPartialBlocked: fetched.queriesPartialBlocked,
        detailsFetched: 0,
        detailsFailed: 0,
        detailsSelected: 0,
        detailsAttempted: 0,
        detailsSkipped: fetched.detailsSkipped,
        detailsBackoff: fetched.detailsBackoff,
        detailsQueued: fetched.detailIntents.length,
        providerMode: fetched.providerMode,
      });
      if (mode === 'full') {
        jobsFetched += fetched.accepted;
        rawProviderJobs += fetched.raw;
        queriesPlanned += fetched.queriesPlanned;
        queriesAttempted += fetched.queriesAttempted;
        queriesCompleted += fetched.queriesCompleted;
        queriesBlocked += fetched.queriesBlocked;
        queriesFailed += fetched.queriesFailed;
        queriesDeferred += fetched.queriesDeferred;
        queriesPartialBlocked += fetched.queriesPartialBlocked;
        sourceChallengeObserved =
          sourceChallengeObserved || fetched.sourceChallengeObserved;
        if (fetched.kariyerNet) {
          kariyerNetPagesFetched += fetched.kariyerNet.pagesFetched;
          kariyerNetJobsCollected += fetched.kariyerNet.jobsCollected;
        }
      }
      for (const intent of fetched.detailIntents) {
        if (intentKeys.has(intent.identity)) {
          continue;
        }
        intentKeys.add(intent.identity);
        detailIntents.push(intent);
      }
      for (const [identity, items] of fetched.provenances) {
        const existing = jobProvenances.get(identity) ?? [];
        jobProvenances.set(identity, [
          ...existing,
          ...items.map((item) => ({
            savedSearchId: search.id,
            keyword: item.keyword,
            origin: item.origin,
            location: item.location,
          })),
        ]);
      }
      if (fetched.providerMode) {
        providerModes[sourceId] = fetched.providerMode;
      }
      if (fetched.outcome !== 'skipped') {
        sourceAttempts += 1;
      }
      if (fetched.outcome === 'failed') {
        sourceFailures += 1;
      }
      if (fetched.outcome === 'partial') {
        sourcePartials += 1;
      }
      if (fetched.stopReason) {
        stopReason = preferStopReason(stopReason, fetched.stopReason);
      }
    };

    for (const search of searches) {
      const scanKind = resolveScanKind({
        trigger: options.trigger,
        lastDiscoveredAt: search.lastDiscoveredAt,
      });
      scanKinds.add(scanKind);
      const sourceIds =
        search.sourceIds.length > 0 ? search.sourceIds : catalogSourceIds;

      for (const sourceId of sourceIds) {
        if (sourceId === 'kariyer_net') {
          continue;
        }
        const fetched = await this.fetchFromSource(
          search,
          sourceId,
          uniqueJobs,
          { runId: options.runId, scanKind },
        );
        recordFetched(search, sourceId, fetched);
      }
    }

    const kariyerRun = await this.fetchKariyerNetForRun(
      searches,
      uniqueJobs,
      options,
    );
    for (const item of kariyerRun.items) {
      scanKinds.add(item.scanKind);
      recordFetched(item.search, 'kariyer_net', item.fetched, 'kariyer-stats');
    }
    jobsFetched += kariyerRun.jobsFetched;
    rawProviderJobs += kariyerRun.rawProviderJobs;
    queriesPlanned += kariyerRun.queriesPlanned;
    queriesAttempted += kariyerRun.queriesAttempted;
    queriesCompleted += kariyerRun.queriesCompleted;
    queriesBlocked += kariyerRun.queriesBlocked;
    queriesFailed += kariyerRun.queriesFailed;
    queriesDeferred += kariyerRun.queriesDeferred;
    queriesPartialBlocked += kariyerRun.queriesPartialBlocked;
    sourceChallengeObserved =
      sourceChallengeObserved || kariyerRun.sourceChallengeObserved;
    kariyerNetPagesFetched += kariyerRun.kariyerNetPagesFetched;
    kariyerNetJobsCollected += kariyerRun.kariyerNetJobsCollected;
    if (kariyerRun.stopReason) {
      stopReason = preferStopReason(stopReason, kariyerRun.stopReason);
    }

    const scanKind =
      scanKinds.size === 1 ? ([...scanKinds][0] ?? 'periodic') : 'mixed';

    return {
      jobsFetched,
      uniqueJobs: [...uniqueJobs.values()],
      rawProviderJobs,
      kariyerNetPagesFetched,
      kariyerNetJobsCollected,
      stopReason,
      sourceAttempts,
      sourceFailures,
      sourcePartials,
      perSearch,
      scanKind,
      queriesPlanned,
      queriesAttempted,
      queriesCompleted,
      queriesBlocked,
      queriesFailed,
      queriesDeferred,
      queriesPartialBlocked,
      sourceChallengeObserved,
      providerModes,
      detailIntents,
      jobProvenances,
    };
  }

  private kariyerNetMaxQueriesPerHour(): number {
    return readKariyerNetMaxQueriesPerHour(
      this.config.get<string>('DISCOVERY_KARIYER_NET_MAX_QUERIES_PER_HOUR'),
    );
  }

  private async fetchKariyerNetForRun(
    searches: readonly SavedSearch[],
    uniqueJobs: Map<string, NormalizedJob>,
    options: { trigger: 'scheduled' | 'user'; runId: string },
  ): Promise<{
    items: {
      search: SavedSearch;
      scanKind: ScanKind;
      fetched: Awaited<ReturnType<DiscoveryService['fetchFromSource']>>;
    }[];
    jobsFetched: number;
    rawProviderJobs: number;
    queriesPlanned: number;
    queriesAttempted: number;
    queriesCompleted: number;
    queriesBlocked: number;
    queriesFailed: number;
    queriesDeferred: number;
    queriesPartialBlocked: number;
    sourceChallengeObserved: boolean;
    kariyerNetPagesFetched: number;
    kariyerNetJobsCollected: number;
    stopReason: string | null;
  }> {
    const empty = {
      items: [] as {
        search: SavedSearch;
        scanKind: ScanKind;
        fetched: Awaited<ReturnType<DiscoveryService['fetchFromSource']>>;
      }[],
      jobsFetched: 0,
      rawProviderJobs: 0,
      ...EMPTY_QUERY_TELEMETRY,
      sourceChallengeObserved: false,
      kariyerNetPagesFetched: 0,
      kariyerNetJobsCollected: 0,
      stopReason: null as string | null,
    };
    const adapter = this.sourceRegistry.get('kariyer_net');
    const kariyerSearches = searches.filter((search) => {
      const sourceIds =
        search.sourceIds.length > 0
          ? search.sourceIds
          : this.sourceRegistry.list().map((item) => item.sourceId);
      return sourceIds.includes('kariyer_net');
    });
    if (kariyerSearches.length === 0) {
      return empty;
    }

    if (!adapter || !adapter.isEnabled()) {
      return {
        ...empty,
        items: kariyerSearches.map((search) => ({
          search,
          scanKind: resolveScanKind({
            trigger: options.trigger,
            lastDiscoveredAt: search.lastDiscoveredAt,
          }),
          fetched: {
            accepted: 0,
            raw: 0,
            outcome: 'skipped',
            stopReason: null,
            ...EMPTY_QUERY_TELEMETRY,
            sourceChallengeObserved: false,
            detailsSkipped: 0,
            detailsBackoff: 0,
            detailIntents: [],
            provenances: new Map(),
            providerMode: adapter?.providerMode ?? null,
          },
        })),
      };
    }

    type PlannedSearch = {
      search: SavedSearch;
      scanKind: ScanKind;
      units: SourceQueryUnit[];
      fingerprint: string;
      startIndex: number;
      selected: SourceQueryUnit[];
      plannerDeferred: number;
    };

    const plannedSearches: PlannedSearch[] = [];
    const scheduledItems: {
      userId: string;
      searchId: string;
      unit: SourceQueryUnit;
    }[] = [];

    for (const search of kariyerSearches) {
      const scanKind = resolveScanKind({
        trigger: options.trigger,
        lastDiscoveredAt: search.lastDiscoveredAt,
      });
      const units = buildSourceQueryUnits(search);
      const fingerprint = sourceQueryPlanFingerprint(search);
      const cursor = await this.runState.readQueryCursor(
        search.id,
        'kariyer_net',
        fingerprint,
      );
      const planned = selectQueryUnits(units, {
        startIndex: cursor.nextIndex,
        maxQueries: this.maxQueriesPerSearchSource(),
      });
      plannedSearches.push({
        search,
        scanKind,
        units,
        fingerprint,
        startIndex: cursor.nextIndex,
        selected: planned.selected,
        plannerDeferred: planned.deferred.length,
      });
      for (const unit of planned.selected) {
        scheduledItems.push({
          userId: search.userId,
          searchId: search.id,
          unit,
        });
      }
    }

    const uniqueQueries = collectUniqueSourceQueries(scheduledItems);
    const scheduled = scheduleQueriesRoundRobin({
      queries: uniqueQueries,
      budget: this.kariyerNetMaxQueriesPerHour(),
      roundRobinOffset: this.kariyerNetRoundRobinOffset,
    });
    this.kariyerNetRoundRobinOffset = scheduled.nextRoundRobinOffset;

    const uniqueResults = new Map<
      string,
      {
        outcome: QueryUnitOutcome;
        jobs: readonly SourceJobRaw[];
        pagesFetched: number;
        stopReason: string | null;
        providerMode: string | null;
      }
    >();
    const startedAt = Date.now();
    const deadline = startedAt + this.timeBudgetMs();
    let circuitOpen = false;
    let sourceChallengeObserved = false;
    let uniqueStopReason: string | null = null;
    let uniquePages = 0;
    let uniqueRaw = 0;
    let providerMode = adapter.providerMode ?? null;
    const uniqueOutcomes: QueryUnitOutcome[] = [];

    for (const query of scheduled.selected) {
      if (circuitOpen) {
        uniqueResults.set(query.key, {
          outcome: 'deferred',
          jobs: [],
          pagesFetched: 0,
          stopReason: null,
          providerMode,
        });
        uniqueOutcomes.push('deferred');
        continue;
      }

      if (Date.now() >= deadline) {
        uniqueResults.set(query.key, {
          outcome: 'deferred',
          jobs: [],
          pagesFetched: 0,
          stopReason: null,
          providerMode,
        });
        uniqueOutcomes.push('deferred');
        uniqueStopReason = preferStopReason(uniqueStopReason, 'time_budget');
        circuitOpen = true;
        continue;
      }

      const owner = query.consumers[0];
      const ownerSearch =
        kariyerSearches.find((search) => search.id === owner?.searchId) ??
        kariyerSearches[0];
      if (!ownerSearch) {
        uniqueResults.set(query.key, {
          outcome: 'deferred',
          jobs: [],
          pagesFetched: 0,
          stopReason: null,
          providerMode,
        });
        uniqueOutcomes.push('deferred');
        continue;
      }

      try {
        const result = await adapter.search(
          toSourceQuery(ownerSearch, query.unit, this.maxAgeDays()),
        );
        providerMode = result.providerMode ?? providerMode;
        uniqueRaw += result.jobs.length;
        uniquePages += result.pagesFetched ?? 0;
        if (result.stopReason) {
          uniqueStopReason = preferStopReason(uniqueStopReason, result.stopReason);
        }
        const outcome = listingQueryOutcome(result.stopReason, result.jobs.length);
        uniqueResults.set(query.key, {
          outcome,
          jobs: result.jobs,
          pagesFetched: result.pagesFetched ?? 0,
          stopReason: result.stopReason ?? null,
          providerMode,
        });
        uniqueOutcomes.push(outcome);
        if (
          result.stopReason === 'blocked_after_success' ||
          result.stopReason === 'challenge'
        ) {
          circuitOpen = true;
          sourceChallengeObserved = true;
        }
      } catch (error) {
        const errorCategory = sourceErrorCategory(error);
        const blocking = isSourceCircuitBreakError(error);
        uniqueResults.set(query.key, {
          outcome: blocking ? 'blocked' : 'failed',
          jobs: [],
          pagesFetched: 0,
          stopReason: null,
          providerMode,
        });
        uniqueOutcomes.push(blocking ? 'blocked' : 'failed');
        if (blocking) {
          circuitOpen = true;
          sourceChallengeObserved = true;
          uniqueStopReason = preferStopReason(
            uniqueStopReason,
            'blocked_after_success',
          );
        }
        this.logger.error({
          message: blocking
            ? 'Kariyer.net query blocked; opening circuit breaker for this run'
            : 'Kariyer.net query failed; keeping other query results',
          runId: options.runId,
          source: 'kariyer_net',
          savedSearchId: ownerSearch.id,
          providerMode,
          queryOrigin: query.unit.origin,
          errorCategory,
        });
      }
    }

    for (const query of scheduled.deferred) {
      uniqueResults.set(query.key, {
        outcome: 'deferred',
        jobs: [],
        pagesFetched: 0,
        stopReason: null,
        providerMode,
      });
      uniqueOutcomes.push('deferred');
    }
    if (scheduled.deferred.length > 0) {
      uniqueStopReason = preferStopReason(uniqueStopReason, 'query_budget');
    }

    const uniqueCounts = countQueryOutcomes(uniqueOutcomes);
    const items: {
      search: SavedSearch;
      scanKind: ScanKind;
      fetched: Awaited<ReturnType<DiscoveryService['fetchFromSource']>>;
    }[] = [];
    let jobsFetched = 0;

    for (const planned of plannedSearches) {
      const fetched = await this.materializeKariyerSearch({
        planned,
        uniqueResults,
        uniqueJobs,
        adapterProviderMode: providerMode,
        runId: options.runId,
      });
      jobsFetched += fetched.accepted;
      items.push({
        search: planned.search,
        scanKind: planned.scanKind,
        fetched,
      });
    }

    return {
      items,
      jobsFetched,
      rawProviderJobs: uniqueRaw,
      ...toQueryTelemetry(uniqueCounts),
      sourceChallengeObserved:
        sourceChallengeObserved ||
        uniqueCounts.blocked > 0 ||
        uniqueCounts.partialBlocked > 0,
      kariyerNetPagesFetched: uniquePages,
      kariyerNetJobsCollected: uniqueRaw,
      stopReason: uniqueStopReason,
    };
  }

  private async materializeKariyerSearch(input: {
    planned: {
      search: SavedSearch;
      scanKind: ScanKind;
      units: SourceQueryUnit[];
      fingerprint: string;
      startIndex: number;
      selected: SourceQueryUnit[];
      plannerDeferred: number;
    };
    uniqueResults: ReadonlyMap<
      string,
      {
        outcome: QueryUnitOutcome;
        jobs: readonly SourceJobRaw[];
        pagesFetched: number;
        stopReason: string | null;
        providerMode: string | null;
      }
    >;
    uniqueJobs: Map<string, NormalizedJob>;
    adapterProviderMode: string | null;
    runId: string;
  }): Promise<Awaited<ReturnType<DiscoveryService['fetchFromSource']>>> {
    const { planned, uniqueResults, uniqueJobs } = input;
    const collected = new Map<string, SourceJobRaw>();
    const provenances = new Map<string, SourceQueryProvenance[]>();
    const outcomes: QueryUnitOutcome[] = [];
    let raw = 0;
    let pagesFetched = 0;
    let stopReason: string | null = null;
    let providerMode = input.adapterProviderMode;

    for (const unit of planned.selected) {
      const executed = uniqueResults.get(queryUnitKey(unit));
      const outcome = executed?.outcome ?? 'deferred';
      outcomes.push(outcome);
      if (executed?.stopReason) {
        stopReason = preferStopReason(stopReason, executed.stopReason);
      }
      if (executed?.providerMode) {
        providerMode = executed.providerMode;
      }
      if (!executed || !isCollectedListingOutcome(outcome)) {
        continue;
      }
      raw += executed.jobs.length;
      pagesFetched += executed.pagesFetched;
      for (const job of executed.jobs) {
        const identity = sourceListingIdentity('kariyer_net', job.sourceJobId);
        collected.set(identity, preferCollectedJob(collected.get(identity), job));
        recordProvenance(provenances, identity, {
          keyword: unit.keyword,
          origin: unit.origin,
          location: unit.location,
          page: Number.isFinite(job.listPage) ? (job.listPage as number) : 1,
        });
      }
    }

    const counts = countQueryOutcomes(outcomes);
    if (planned.plannerDeferred > 0 && !stopReason) {
      stopReason = 'query_budget';
    }
    await this.runState.writeQueryCursor(
      planned.search.id,
      'kariyer_net',
      {
        fingerprint: planned.fingerprint,
        nextIndex: nextQueryStartIndex({
          unitCount: planned.units.length,
          startIndex: planned.startIndex,
          attempted: counts.completed + counts.failed + counts.partialBlocked,
          leftoverCount: counts.blocked + counts.deferred,
        }),
      },
      planned.startIndex,
    );

    let accepted = 0;
    const jobsForNormalize = [...collected.values()];
    const now = new Date();
    for (const rawJob of jobsForNormalize) {
      const normalized = normalizeSourceJob('kariyer_net', rawJob);
      if (!normalized) {
        continue;
      }
      if (!isWithinSourceMaxAge(normalized.publishedAt, this.maxAgeDays(), now)) {
        continue;
      }
      const identity = sourceListingIdentity(
        normalized.sourceId,
        normalized.sourceJobId,
      );
      if (!uniqueJobs.has(identity)) {
        accepted += 1;
      }
      uniqueJobs.set(identity, normalized);
    }

    const catalog = await this.jobsService.listDetailFetchStates(
      jobsForNormalize.map((job) => ({
        sourceId: 'kariyer_net' as const,
        sourceJobId: job.sourceJobId,
      })),
    );
    const withCatalogText = jobsForNormalize.map((job) => {
      const identity = sourceListingIdentity('kariyer_net', job.sourceJobId);
      const stored = catalog.get(identity)?.description?.trim();
      if (stored && !job.description?.trim()) {
        return { ...job, description: stored };
      }
      return job;
    });
    const report = selectDetailCandidates({
      sourceId: 'kariyer_net',
      search: planned.search,
      jobs: withCatalogText,
      provenances,
      catalog,
      evaluateMatch: (job, currentSearch) =>
        this.matchingService.evaluateMatch(job, currentSearch),
      maxDetails: this.maxDetailRequests('kariyer_net'),
    });
    const detailIntents = report.ranked.map((candidate) =>
      toDetailIntent('kariyer_net', candidate),
    );
    this.logDetailSelection({
      runId: input.runId,
      sourceId: 'kariyer_net',
      savedSearchId: planned.search.id,
      queryCompleted: counts.completed,
      queryBlocked: counts.blocked,
      queryFailed: counts.failed,
      queryDeferred: counts.deferred,
      queryPartialBlocked: counts.partialBlocked,
      queryAttempted: counts.attempted,
      report,
    });

    return {
      accepted,
      raw,
      outcome: sourceOutcome({
        queriesAttempted: counts.attempted,
        queriesCompleted: counts.completed,
        queriesBlocked: counts.blocked,
        queriesFailed: counts.failed,
        queriesDeferred: counts.deferred,
        queriesPartialBlocked: counts.partialBlocked,
        stopReason,
      }),
      stopReason,
      ...toQueryTelemetry(counts),
      sourceChallengeObserved:
        counts.blocked > 0 ||
        counts.partialBlocked > 0 ||
        stopReason === 'blocked_after_success' ||
        stopReason === 'challenge',
      detailsSkipped: report.skipped.length,
      detailsBackoff: report.backoffCount,
      detailIntents,
      provenances,
      providerMode,
      kariyerNet: {
        pagesFetched,
        jobsCollected: collected.size,
        stopReason,
      },
    };
  }

  private async fetchFromSource(
    search: SavedSearch,
    sourceId: SourceId,
    uniqueJobs: Map<string, NormalizedJob>,
    options: { runId: string; scanKind: ScanKind },
  ): Promise<{
    accepted: number;
    raw: number;
    outcome: 'skipped' | 'ok' | 'partial' | 'failed';
    stopReason: string | null;
    queriesPlanned: number;
    queriesAttempted: number;
    queriesCompleted: number;
    queriesBlocked: number;
    queriesFailed: number;
    queriesDeferred: number;
    queriesPartialBlocked: number;
    sourceChallengeObserved: boolean;
    detailsSkipped: number;
    detailsBackoff: number;
    detailIntents: readonly DetailIntent[];
    provenances: ReadonlyMap<string, readonly SourceQueryProvenance[]>;
    providerMode: string | null;
    kariyerNet?: {
      pagesFetched: number;
      jobsCollected: number;
      stopReason: string | null;
    };
  }> {
    const adapter = this.sourceRegistry.get(sourceId);

    if (!adapter || !adapter.isEnabled()) {
      this.logger.log({
        message: 'Skipping disabled or unknown source',
        runId: options.runId,
        source: sourceId,
        savedSearchId: search.id,
        providerMode: adapter?.providerMode ?? null,
      });
      return {
        accepted: 0,
        raw: 0,
        outcome: 'skipped',
        stopReason: null,
        ...EMPTY_QUERY_TELEMETRY,
        sourceChallengeObserved: false,
        detailsSkipped: 0,
        detailsBackoff: 0,
        detailIntents: [],
        provenances: new Map(),
        providerMode: adapter?.providerMode ?? null,
      };
    }

    const units = buildSourceQueryUnits(search);
    const fingerprint = sourceQueryPlanFingerprint(search);
    const cursor = await this.runState.readQueryCursor(
      search.id,
      sourceId,
      fingerprint,
    );
    const startIndex = cursor.nextIndex;
    const planned = selectQueryUnits(units, {
      startIndex,
      maxQueries: this.maxQueriesPerSearchSource(),
    });
    const startedAt = Date.now();
    const deadline = startedAt + this.timeBudgetMs();
    const collected = new Map<string, SourceJobRaw>();
    const provenances = new Map<string, SourceQueryProvenance[]>();
    let raw = 0;
    let accepted = 0;
    let pagesFetched = 0;
    let stopReason: string | null = null;
    let providerMode = adapter.providerMode ?? null;
    const outcomes: QueryUnitOutcome[] = [];
    let haltRemaining: Extract<QueryUnitOutcome, 'blocked' | 'deferred'> | null =
      null;

    for (const unit of planned.selected) {
      if (haltRemaining) {
        outcomes.push(haltRemaining);
        continue;
      }

      if (Date.now() >= deadline) {
        haltRemaining = 'deferred';
        outcomes.push('deferred');
        stopReason = preferStopReason(stopReason, 'time_budget');
        continue;
      }

      try {
        const result = await adapter.search(
          toSourceQuery(search, unit, this.maxAgeDays()),
        );
        providerMode = result.providerMode ?? providerMode;
        raw += result.jobs.length;
        pagesFetched += result.pagesFetched ?? 0;
        if (result.stopReason) {
          stopReason = preferStopReason(stopReason, result.stopReason);
        }
        for (const job of result.jobs) {
          const identity = sourceListingIdentity(result.sourceId, job.sourceJobId);
          collected.set(identity, preferCollectedJob(collected.get(identity), job));
          recordProvenance(provenances, identity, {
            keyword: unit.keyword,
            origin: unit.origin,
            location: unit.location,
            page: Number.isFinite(job.listPage) ? (job.listPage as number) : 1,
          });
        }
        outcomes.push(listingQueryOutcome(result.stopReason, result.jobs.length));
        if (
          result.stopReason === 'blocked_after_success' ||
          result.stopReason === 'challenge'
        ) {
          haltRemaining = 'deferred';
        }
      } catch (error) {
        const errorCategory = sourceErrorCategory(error);
        const blocking = isSourceCircuitBreakError(error);
        outcomes.push(blocking ? 'blocked' : 'failed');
        if (blocking) {
          haltRemaining = 'deferred';
          stopReason = preferStopReason(stopReason, 'blocked_after_success');
        }
        this.logger.error({
          message: blocking
            ? 'Source query blocked; skipping remaining units'
            : 'Source query failed; keeping other query results',
          runId: options.runId,
          source: sourceId,
          savedSearchId: search.id,
          providerMode,
          queryOrigin: unit.origin,
          errorCategory,
        });
      }
    }

    const counts = countQueryOutcomes(outcomes);
    if (planned.deferred.length > 0 && !stopReason) {
      stopReason = 'query_budget';
    }
    await this.runState.writeQueryCursor(
      search.id,
      sourceId,
      {
        fingerprint,
        nextIndex: nextQueryStartIndex({
          unitCount: units.length,
          startIndex,
          attempted: counts.completed + counts.failed + counts.partialBlocked,
          leftoverCount: counts.blocked + counts.deferred,
        }),
      },
      startIndex,
    );

    const jobsForNormalize = [...collected.values()];
    const now = new Date();
    for (const rawJob of jobsForNormalize) {
      const normalized = normalizeSourceJob(sourceId, rawJob);
      if (!normalized) {
        continue;
      }

      if (!isWithinSourceMaxAge(normalized.publishedAt, this.maxAgeDays(), now)) {
        this.logger.log({
          message: 'Discarded job older than source max age',
          runId: options.runId,
          source: sourceId,
          savedSearchId: search.id,
          title: normalized.title,
        });
        continue;
      }

      accepted += 1;
      uniqueJobs.set(
        sourceListingIdentity(normalized.sourceId, normalized.sourceJobId),
        normalized,
      );
    }

    const catalog = await this.jobsService.listDetailFetchStates(
      jobsForNormalize.map((job) => ({
        sourceId,
        sourceJobId: job.sourceJobId,
      })),
    );
    const withCatalogText = jobsForNormalize.map((job) => {
      const identity = sourceListingIdentity(sourceId, job.sourceJobId);
      const stored = catalog.get(identity)?.description?.trim();
      if (stored && !job.description?.trim()) {
        return { ...job, description: stored };
      }
      return job;
    });
    const report = selectDetailCandidates({
      sourceId,
      search,
      jobs: withCatalogText,
      provenances,
      catalog,
      evaluateMatch: (job, currentSearch) =>
        this.matchingService.evaluateMatch(job, currentSearch),
      maxDetails: this.maxDetailRequests(sourceId),
    });
    const detailIntents = report.ranked.map((candidate) =>
      toDetailIntent(sourceId, candidate),
    );
    this.logDetailSelection({
      runId: options.runId,
      sourceId,
      savedSearchId: search.id,
      queryCompleted: counts.completed,
      queryBlocked: counts.blocked,
      queryFailed: counts.failed,
      queryDeferred: counts.deferred,
      queryPartialBlocked: counts.partialBlocked,
      queryAttempted: counts.attempted,
      report,
    });

    const outcome = sourceOutcome({
      queriesAttempted: counts.attempted,
      queriesCompleted: counts.completed,
      queriesBlocked: counts.blocked,
      queriesFailed: counts.failed,
      queriesDeferred: counts.deferred,
      queriesPartialBlocked: counts.partialBlocked,
      stopReason,
    });

    this.logger.log({
      message: 'Source fetch completed',
      runId: options.runId,
      source: sourceId,
      savedSearchId: search.id,
      providerMode,
      scanKind: options.scanKind,
      durationMs: Date.now() - startedAt,
      ...toQueryTelemetry(counts),
      fetched: raw,
      normalized: accepted,
      pagesFetched,
      jobsCollected: collected.size,
      detailCandidates: report.ranked.length,
      detailSelected: report.selected.length,
      detailSkipped: report.skipped.length,
      detailBackoff: report.backoffCount,
      stopReason,
    });

    return {
      accepted,
      raw,
      outcome,
      stopReason,
      ...toQueryTelemetry(counts),
      sourceChallengeObserved:
        counts.blocked > 0 ||
        counts.partialBlocked > 0 ||
        stopReason === 'blocked_after_success' ||
        stopReason === 'challenge',
      detailsSkipped: report.skipped.length,
      detailsBackoff: report.backoffCount,
      detailIntents,
      provenances,
      providerMode,
      kariyerNet:
        sourceId === 'kariyer_net'
          ? {
              pagesFetched,
              jobsCollected: collected.size,
              stopReason,
            }
          : undefined,
    };
  }

  private async enqueueAndDrainDetails(input: {
    runId: string;
    uniqueJobs: readonly NormalizedJob[];
    persisted: MatchableJob[];
    intents: readonly DetailIntent[];
    searches: readonly SavedSearch[];
    deferKariyerNetDetailsDueToChallenge: boolean;
  }): Promise<{
    jobsInserted: number;
    jobsUpdated: number;
    detailsFetched: number;
    detailsFailed: number;
    detailsSelected: number;
    detailsAttempted: number;
    detailsSkipped: number;
    detailsBackoff: number;
    detailsQueued: number;
    detailsRequested: number;
    detailsDeferredDueToChallenge: number;
    descriptionsExtracted: number;
    detailErrorByJobId: Map<string, string | null>;
  }> {
    void input.searches;
    const idByIdentity = new Map(
      input.persisted.map((job) => [
        sourceListingIdentity(job.sourceId, job.sourceJobId ?? ''),
        job.id,
      ]),
    );
    const enqueueItems: DetailQueueEnqueueInput[] = [];
    for (const intent of input.intents) {
      const jobId = idByIdentity.get(intent.identity);
      if (!jobId) {
        continue;
      }
      enqueueItems.push({ ...intent, jobId });
    }
    const queued = enqueueItems.length
      ? await this.runState.enqueueDetails(enqueueItems)
      : { queuedCount: 0 };

    void input.uniqueJobs;
    const seenThisRun = new Set(input.persisted.map((job) => job.id));

    const sourceIds = uniqueSourceIds(
      this.sourceRegistry.list().map((adapter) => adapter.sourceId),
    );

    let jobsInserted = 0;
    let jobsUpdated = 0;
    let detailsFetched = 0;
    let detailsFailed = 0;
    let detailsSelected = 0;
    let detailsAttempted = 0;
    let detailsSkipped = 0;
    let detailsRequested = 0;
    let descriptionsExtracted = 0;
    const kariyerQueuedCount = enqueueItems.filter(
      (item) => item.sourceId === 'kariyer_net',
    ).length;
    const detailsDeferredDueToChallenge = input.deferKariyerNetDetailsDueToChallenge
      ? kariyerQueuedCount
      : 0;
    const detailErrorByJobId = new Map<string, string | null>();
    const nowIso = new Date().toISOString();
    const persistedById = new Map(input.persisted.map((job) => [job.id, job]));
    const selectedSamples: {
      jobId: string;
      title: string;
      origin: string | null;
      location: string | null;
      priorityReason: string;
    }[] = [];

    for (const sourceId of sourceIds) {
      const adapter = this.sourceRegistry.get(sourceId);
      if (!adapter?.isEnabled() || !adapter.enrichMissingDescriptions) {
        continue;
      }

      if (
        sourceId === 'kariyer_net' &&
        input.deferKariyerNetDetailsDueToChallenge
      ) {
        this.logger.log({
          message:
            'Skipping Kariyer.net detail HTTP after a listing challenge; leaving jobs on the detail queue',
          runId: input.runId,
          detailsDeferredDueToChallenge,
        });
        continue;
      }

      const due = await this.runState.listDueDetails(
        sourceId,
        nowIso,
        this.maxDetailRequests(sourceId),
      );
      detailsSelected += due.length;
      const toFetch: { item: DetailQueueItem; raw: SourceJobRaw }[] = [];

      for (const item of due) {
        let listing = persistedById.get(item.jobId) ?? null;
        if (!listing) {
          const catalog = await this.jobsService.getListingById(item.jobId);
          listing = catalog ? toMatchableJob(catalog.id, catalog) : null;
        }
        if (listing?.description?.trim()) {
          await this.runState.completeDetail(item.jobId);
          detailsSkipped += 1;
          continue;
        }

        try {
          assertAllowedJobSourceUrl(item.sourceUrl);
        } catch {
          await this.runState.failDetail(item.jobId, 'invalid_url', nowIso);
          detailErrorByJobId.set(item.jobId, 'invalid_url');
          detailsFailed += 1;
          continue;
        }

        toFetch.push({
          item,
          raw: {
            sourceJobId: item.sourceJobId,
            canonicalUrl: item.sourceUrl,
            title: listing?.title ?? item.sourceJobId,
            companyName: listing?.companyName ?? 'Unknown',
            location: listing?.location ?? item.queryLocation ?? undefined,
            description: listing?.description ?? undefined,
            workModel: listing?.workModel ?? undefined,
            experienceLevel: listing?.experienceLevel ?? undefined,
            technologies: listing?.technologies,
          },
        });
      }

      if (toFetch.length === 0) {
        continue;
      }

      detailsAttempted += toFetch.length;
      let enrichedJobs: SourceJobRaw[] = toFetch.map((entry) => entry.raw);
      let outcomes: readonly SourceDetailFetchOutcome[] = [];
      try {
        const result = await adapter.enrichMissingDescriptions(
          toFetch.map((entry) => entry.raw),
        );
        enrichedJobs = [...result.jobs];
        outcomes = result.outcomes ?? [];
        detailsRequested +=
          result.detailsRequested ??
          (outcomes.length > 0 ? outcomes.length : toFetch.length);
      } catch (error) {
        this.logger.warn({
          message: 'Description enrichment failed; keeping list-card jobs',
          runId: input.runId,
          source: sourceId,
          error: error instanceof Error ? error.message : 'unknown',
        });
        for (const entry of toFetch) {
          await this.runState.failDetail(entry.item.jobId, 'unavailable', nowIso);
          detailErrorByJobId.set(entry.item.jobId, 'unavailable');
          detailsFailed += 1;
        }
        detailsRequested += toFetch.length;
        continue;
      }

      const bySourceJobId = new Map(
        enrichedJobs.map((job) => [job.sourceJobId, job]),
      );
      const outcomeBySourceJobId = new Map(
        outcomes.map((item) => [item.sourceJobId, item]),
      );
      for (const entry of toFetch) {
        const detail = bySourceJobId.get(entry.item.sourceJobId);
        const outcome =
          outcomeBySourceJobId.get(entry.item.sourceJobId) ??
          fallbackOutcome(
            {
              detailsFetched: detail?.description?.trim() ? 1 : 0,
              detailsFailed: detail?.description?.trim() ? 0 : 1,
            },
            entry.item.sourceJobId,
          );
        const description = detail?.description?.trim() ?? '';
        const extracted =
          outcome.descriptionExtracted && Boolean(description);
        if (!extracted) {
          const category = outcome.errorCategory ?? 'empty';
          await this.runState.failDetail(entry.item.jobId, category, nowIso);
          detailErrorByJobId.set(entry.item.jobId, category);
          detailsFailed += 1;
          continue;
        }

        const incoming = normalizeSourceJob(sourceId, {
          ...entry.raw,
          ...detail,
          description,
        });
        if (!incoming) {
          await this.runState.failDetail(entry.item.jobId, 'parse', nowIso);
          detailErrorByJobId.set(entry.item.jobId, 'parse');
          detailsFailed += 1;
          continue;
        }

        const existing = persistedById.get(entry.item.jobId);
        const merged = mergeNormalizedJobUpdate(incoming, {
          description: existing?.description ?? null,
          publishedAt: existing?.publishedAt ?? null,
        });
        const upserted = await this.jobsService.upsertNormalized(merged);
        if (!seenThisRun.has(upserted.id)) {
          if (upserted.inserted) {
            jobsInserted += 1;
          } else {
            jobsUpdated += 1;
          }
          seenThisRun.add(upserted.id);
        }
        const matchable = toMatchableJob(upserted.id, merged);
        const persistedIndex = input.persisted.findIndex(
          (job) => job.id === upserted.id,
        );
        if (persistedIndex >= 0) {
          input.persisted[persistedIndex] = matchable;
        } else {
          input.persisted.push(matchable);
        }
        persistedById.set(upserted.id, matchable);
        await this.runState.completeDetail(entry.item.jobId);
        detailsFetched += 1;
        descriptionsExtracted += 1;
        if (selectedSamples.length < 8) {
          selectedSamples.push({
            jobId: entry.item.jobId,
            title: clipLogTitle(entry.raw.title),
            origin: entry.item.queryTermKind,
            location: entry.item.queryLocation,
            priorityReason: entry.item.reason,
          });
        }
      }
    }

    this.logger.log({
      message: 'Detail queue drained',
      runId: input.runId,
      detailsQueued: queued.queuedCount,
      detailsSelected,
      detailsAttempted,
      detailsFetched,
      detailsFailed,
      detailsSkipped,
      detailsRequested,
      detailsDeferredDueToChallenge,
      descriptionsExtracted,
      selectedSample: selectedSamples,
    });

    return {
      jobsInserted,
      jobsUpdated,
      detailsFetched,
      detailsFailed,
      detailsSelected,
      detailsAttempted,
      detailsSkipped,
      detailsBackoff: 0,
      detailsQueued: queued.queuedCount,
      detailsRequested,
      detailsDeferredDueToChallenge,
      descriptionsExtracted,
      detailErrorByJobId,
    };
  }

  private logDetailSelection(input: {
    runId: string;
    sourceId: SourceId;
    savedSearchId: string;
    queryAttempted: number;
    queryCompleted: number;
    queryBlocked: number;
    queryFailed: number;
    queryDeferred: number;
    queryPartialBlocked?: number;
    report: ReturnType<typeof selectDetailCandidates>;
  }): void {
    const skippedHighPriority = input.report.skipped
      .filter((item) => item.reason === 'budget')
      .slice(0, 5)
      .map((item) => ({
        identity: item.identity,
        title: item.title,
        reason: item.reason,
      }));
    const selectedSample = input.report.selected.slice(0, 8).map((item) => ({
      identity: item.identity,
      title: clipLogTitle(item.job.title),
      origin: item.provenances[0]?.origin ?? null,
      location: item.provenances[0]?.location ?? null,
      priorityReason: item.priorityReason,
    }));

    this.logger.log({
      message: 'Description detail candidates selected',
      runId: input.runId,
      source: input.sourceId,
      savedSearchId: input.savedSearchId,
      candidateCount: input.report.ranked.length,
      byPriority: input.report.byPriority,
      selectedCount: input.report.selected.length,
      skippedCount: input.report.skipped.length,
      backoffCount: input.report.backoffCount,
      skippedHasDescription: input.report.skippedHasDescription,
      selectedSample,
      skippedHighPrioritySample: skippedHighPriority,
      queriesAttempted: input.queryAttempted,
      queriesCompleted: input.queryCompleted,
      queriesBlocked: input.queryBlocked,
      queriesFailed: input.queryFailed,
      queriesDeferred: input.queryDeferred,
      queriesPartialBlocked: input.queryPartialBlocked ?? 0,
    });
  }

  private maxDetailRequests(sourceId: SourceId): number {
    if (sourceId === 'kariyer_net') {
      return Math.min(
        25,
        readPositiveIntEnv(
          this.config.get<string>('KARIYER_NET_MAX_DETAIL_REQUESTS'),
          KARIYER_NET_DEFAULT_MAX_DETAIL_REQUESTS,
        ),
      );
    }

    return KARIYER_NET_DEFAULT_MAX_DETAIL_REQUESTS;
  }

  private maxQueriesPerSearchSource(): number {
    return readPositiveIntEnv(
      this.config.get<string>('DISCOVERY_MAX_QUERIES_PER_SEARCH_SOURCE'),
      DEFAULT_MAX_QUERIES_PER_SEARCH_SOURCE,
    );
  }

  private timeBudgetMs(): number {
    return readPositiveIntEnv(
      this.config.get<string>('DISCOVERY_TIME_BUDGET_MS_PER_SEARCH_SOURCE'),
      DEFAULT_TIME_BUDGET_MS_PER_SEARCH_SOURCE,
    );
  }

  private logSavedSearchMatchDebug(input: {
    searches: readonly SavedSearch[];
    catalogJobs: readonly MatchableJob[];
    allJobs: readonly MatchableJob[];
    fetchStats: readonly SearchSourceFetchStat[];
    createdMatches: readonly JobSearchMatch[];
    lastDiscoveryAt: string;
  }): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const createdBySearch = new Map<string, number>();
    for (const match of input.createdMatches) {
      createdBySearch.set(
        match.savedSearchId,
        (createdBySearch.get(match.savedSearchId) ?? 0) + 1,
      );
    }

    const fetchedBySearchSource = new Map<string, number>();
    for (const stat of input.fetchStats) {
      fetchedBySearchSource.set(
        `${stat.savedSearchId}:${stat.source}`,
        (fetchedBySearchSource.get(`${stat.savedSearchId}:${stat.source}`) ?? 0) +
          stat.fetchedJobCount,
      );
    }

    for (const search of input.searches) {
      let keywordMatched = 0;
      let locationMatched = 0;
      let locationRejected = 0;
      let linkedinMatched = 0;
      let kariyerMatched = 0;
      let fuzzyMatched = 0;
      const rejectionReasonCounts: Record<string, number> = {};
      const queryTerms = search.keywords
        .flatMap((term) => term.split(','))
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      for (const job of input.allJobs) {
        const decision = this.matchingService.evaluateMatch(job, search);
        if (decision.keyword === 'pass') {
          keywordMatched += 1;
          const haystacks = [job.title, job.description ?? '', ...job.technologies];
          if (
            queryTerms.some((term) =>
              haystacks.some((text) => queryMatchKind(text, term) === 'fuzzy'),
            )
          ) {
            fuzzyMatched += 1;
          }
        }
        if (decision.location === 'pass') {
          locationMatched += 1;
        }
        if (decision.location === 'fail') {
          locationRejected += 1;
        }
        if (decision.matched && job.sourceId === 'linkedin') {
          linkedinMatched += 1;
        }
        if (decision.matched && job.sourceId === 'kariyer_net') {
          kariyerMatched += 1;
        }
        if (decision.matched) {
          continue;
        }
        for (const reason of decision.reasons) {
          rejectionReasonCounts[reason] =
            (rejectionReasonCounts[reason] ?? 0) + 1;
        }
      }

      this.logger.log({
        message: 'Saved search match debug',
        savedSearchId: search.id,
        userId: search.userId,
        queryTerms,
        selectedSubdivisions: coalesceSubdivisionNames(search),
        linkedinFetched:
          fetchedBySearchSource.get(`${search.id}:linkedin`) ?? 0,
        kariyerFetched:
          fetchedBySearchSource.get(`${search.id}:kariyer_net`) ?? 0,
        linkedinMatched,
        kariyerMatched,
        fuzzyMatched,
        locationRejected,
        matchesCreated: createdBySearch.get(search.id) ?? 0,
        catalogJobsChecked: input.catalogJobs.length,
        keywordMatched,
        locationMatched,
        lastDiscoveryAt: input.lastDiscoveryAt,
        rejectionReasonCounts,
        locationFilter: hasExplicitSearchLocationFilter(search)
          ? 'explicit'
          : 'none',
        keywords: search.keywords,
      });
    }
  }

  private logDiscoveryCounts(counts: {
    usersProcessed: number;
    searchesProcessed: number;
    jobsFetched: number;
    jobsInserted: number;
    matchesCreated: number;
    catalogJobsChecked: number;
    rawProviderJobs: number;
    normalizedJobs: number;
    visibleMatchesCreated: number;
    notifiedJobCount: number;
  }): void {
    this.logger.log({
      message: 'Discovery summary',
      usersProcessed: counts.usersProcessed,
      searchesProcessed: counts.searchesProcessed,
      jobsFetched: counts.jobsFetched,
      jobsInserted: counts.jobsInserted,
      matchesCreated: counts.matchesCreated,
      catalogJobsChecked: counts.catalogJobsChecked,
      rawProviderJobs: counts.rawProviderJobs,
      normalizedJobs: counts.normalizedJobs,
    });

    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.log({
      message: 'Discovery run',
      rawProviderJobs: counts.rawProviderJobs,
      normalizedJobs: counts.normalizedJobs,
      jobsInserted: counts.jobsInserted,
      matchesCreated: counts.matchesCreated,
      visibleMatchesCreated: counts.visibleMatchesCreated,
      notificationCount: counts.notifiedJobCount,
    });
  }

  private maxAgeDays(): number {
    return readPositiveIntEnv(
      this.config.get<string>('JOB_SOURCE_MAX_AGE_DAYS'),
      DEFAULT_JOB_SOURCE_MAX_AGE_DAYS,
    );
  }

  private inactiveAfterDays(): number {
    return readPositiveIntEnv(
      this.config.get<string>('JOB_INACTIVE_AFTER_DAYS'),
      DEFAULT_JOB_INACTIVE_AFTER_DAYS,
    );
  }

  private async markStaleJobsInactive(): Promise<void> {
    try {
      const cutoff = inactiveNotSeenCutoff(this.inactiveAfterDays());
      const marked = await this.jobsService.markInactiveNotSeenSince(
        cutoff.toISOString(),
      );
      if (marked > 0) {
        this.logger.log({
          message: 'Marked jobs inactive after not being observed',
          marked,
          inactiveAfterDays: this.inactiveAfterDays(),
        });
      }
    } catch (error) {
      this.logger.warn({
        message: 'Failed to mark stale jobs inactive; listings were still stored',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

const PARTIAL_STOP_REASONS = new Set([
  'pagination_loop',
  'blocked_after_success',
  'query_budget',
  'time_budget',
  'max_pages',
]);

function sourceOutcome(input: {
  queriesAttempted: number;
  queriesCompleted: number;
  queriesBlocked: number;
  queriesFailed: number;
  queriesDeferred: number;
  queriesPartialBlocked?: number;
  stopReason: string | null;
}): 'ok' | 'partial' | 'failed' {
  const partialBlocked = input.queriesPartialBlocked ?? 0;

  if (
    input.queriesCompleted === 0 &&
    input.queriesFailed > 0 &&
    input.queriesBlocked === 0 &&
    partialBlocked === 0 &&
    input.queriesDeferred === 0
  ) {
    return 'failed';
  }

  if (
    input.queriesFailed > 0 ||
    input.queriesBlocked > 0 ||
    input.queriesDeferred > 0 ||
    partialBlocked > 0 ||
    isPartialStopReason(input.stopReason)
  ) {
    return 'partial';
  }

  return 'ok';
}

function isPartialStopReason(reason: string | null | undefined): boolean {
  return Boolean(reason && PARTIAL_STOP_REASONS.has(reason));
}

function listingQueryOutcome(
  stopReason: string | null | undefined,
  jobCount: number,
): QueryUnitOutcome {
  if (stopReason === 'blocked_after_success') {
    return 'partial_blocked';
  }

  if (stopReason === 'challenge') {
    return jobCount > 0 ? 'partial_blocked' : 'blocked';
  }

  return 'completed';
}

function isCollectedListingOutcome(outcome: QueryUnitOutcome): boolean {
  return outcome === 'completed' || outcome === 'partial_blocked';
}

function preferStopReason(
  current: string | null,
  next: string | null,
): string | null {
  if (next === 'blocked_after_success' || current === 'blocked_after_success') {
    return 'blocked_after_success';
  }

  if (next === 'time_budget' || current === 'time_budget') {
    return 'time_budget';
  }

  if (next === 'query_budget' || current === 'query_budget') {
    return 'query_budget';
  }

  if (next === 'pagination_loop' || current === 'pagination_loop') {
    return 'pagination_loop';
  }

  return next ?? current;
}

function toSourceQuery(
  search: SavedSearch,
  unit: SourceQueryUnit,
  maxAgeDays: number,
): SourceSearchQuery {
  return {
    keywords: [unit.keyword],
    technologies: [],
    locations: unit.location ? [unit.location] : [],
    workModels: [],
    experienceLevels: search.experienceLevels,
    savedSearchId: search.id,
    maxAgeDays,
  };
}

function uniqueMatches(
  matches: readonly JobSearchMatch[],
): JobSearchMatch[] {
  const byKey = new Map<string, JobSearchMatch>();

  for (const match of matches) {
    const key = `${match.jobId}:${match.savedSearchId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, match);
      continue;
    }

    if (
      existing.matchStatus !== MATCH_STATUS.verified &&
      match.matchStatus === MATCH_STATUS.verified
    ) {
      byKey.set(key, match);
    }
  }

  return [...byKey.values()];
}

function mergeNotificationJobs(
  catalog: readonly PersistedJobForNotification[],
  live: readonly PersistedJobForNotification[],
): PersistedJobForNotification[] {
  const byId = new Map(catalog.map((job) => [job.id, job]));
  for (const job of live) {
    byId.set(job.id, job);
  }
  return [...byId.values()];
}

function catalogJobsForNotification(
  catalogJobs: readonly MatchableJob[],
  catalogCreated: readonly JobSearchMatch[],
): PersistedJobForNotification[] {
  const matchedIds = new Set(catalogCreated.map((match) => match.jobId));
  return catalogJobs
    .filter((job) => matchedIds.has(job.id))
    .map((job) => ({
      id: job.id,
      sourceId: job.sourceId,
      isActive: true,
      publishedAt: null,
    }));
}

function mergeJobLists(
  catalog: readonly MatchableJob[],
  persisted: readonly MatchableJob[],
): MatchableJob[] {
  const byId = new Map<string, MatchableJob>();
  for (const job of catalog) {
    byId.set(job.id, job);
  }
  for (const job of persisted) {
    byId.set(job.id, job);
  }
  return [...byId.values()];
}

function preferCollectedJob(
  existing: SourceJobRaw | undefined,
  incoming: SourceJobRaw,
): SourceJobRaw {
  if (!existing) {
    return incoming;
  }

  if (incoming.description?.trim() && !existing.description?.trim()) {
    return {
      ...incoming,
      listPage: existing.listPage ?? incoming.listPage,
    };
  }

  return {
    ...existing,
    listPage: existing.listPage ?? incoming.listPage,
  };
}

function toMatchableJob(id: string, job: NormalizedJob): MatchableJob {
  return {
    id,
    sourceId: job.sourceId,
    title: job.title,
    companyName: job.companyName,
    description: job.description,
    location: job.location,
    workModel: job.workModel,
    experienceLevel: job.experienceLevel,
    technologies: job.technologies,
    sourceJobId: job.sourceJobId,
    canonicalUrl: job.canonicalUrl,
    isActive: job.isActive,
    publishedAt: job.publishedAt,
  };
}

function toDetailIntent(sourceId: SourceId, candidate: DetailCandidate): DetailIntent {
  const primary =
    candidate.provenances.find((item) => item.origin === 'profession_variant') ??
    candidate.provenances[0];
  return {
    identity: candidate.identity,
    sourceId,
    sourceJobId: candidate.job.sourceJobId,
    sourceUrl: candidate.job.canonicalUrl,
    title: candidate.job.title,
    priority: candidate.priority,
    reason: queueReasonFrom(candidate.priorityReason),
    queryTermKind: primary?.origin ?? null,
    queryTerm: primary?.keyword ?? null,
    queryLocation: primary?.location ?? null,
  };
}

function queueReasonFrom(
  reason: DetailCandidate['priorityReason'],
): DetailQueueReason {
  if (reason === 'profession_variant' || reason === 'user_query') {
    return reason;
  }
  return 'catalog_empty';
}

function clipLogTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`;
}

function fallbackOutcome(
  result: { detailsFetched: number; detailsFailed?: number },
  sourceJobId: string,
): SourceDetailFetchOutcome {
  const detailFetched = result.detailsFetched > 0;
  return {
    sourceJobId,
    requestSucceeded: detailFetched,
    detailFetched,
    descriptionExtracted: detailFetched,
    errorCategory: detailFetched ? null : 'empty',
    httpStatus: detailFetched ? 200 : null,
  };
}

function provenancesFromQueueItem(
  jobId: string,
  item: DetailQueueItem | undefined,
): Map<string, SearchScopedProvenance[]> {
  const map = new Map<string, SearchScopedProvenance[]>();
  if (
    !item?.queryTerm ||
    (item.queryTermKind !== 'user' && item.queryTermKind !== 'profession_variant')
  ) {
    return map;
  }

  map.set(jobId, [
    {
      savedSearchId: '',
      keyword: item.queryTerm,
      origin: item.queryTermKind,
      location: item.queryLocation,
    },
  ]);
  return map;
}

function provenancesByPersistedJob(
  persisted: readonly MatchableJob[],
  byIdentity: ReadonlyMap<string, readonly SearchScopedProvenance[]>,
): Map<string, SearchScopedProvenance[]> {
  const mapped = new Map<string, SearchScopedProvenance[]>();
  for (const job of persisted) {
    const identity = sourceListingIdentity(job.sourceId, job.sourceJobId ?? '');
    mapped.set(job.id, [...(byIdentity.get(identity) ?? [])]);
  }
  return mapped;
}

function uniqueSourceIds(values: readonly SourceId[]): SourceId[] {
  return [...new Set(values)];
}
