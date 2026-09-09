import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SourceId } from '../common/domain.types.js';
import { hasExplicitSearchLocationFilter, coalesceSubdivisionNames } from '../common/search-location.js';
import { DuplicateGroupsService } from '../duplicates/duplicate-groups.service.js';
import { LocationsService } from '../locations/locations.service.js';
import { DuplicatesService } from '../duplicates/duplicates.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { NormalizedJob } from '../jobs/jobs.types.js';
import { sourceListingIdentity } from '../jobs/job-identity.js';
import { MatchingService } from '../matching/matching.service.js';
import { queryMatchKind } from '../matching/match-text.js';
import type { JobSearchMatch, MatchableJob } from '../matching/matching.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { selectVisibleNewMatches } from '../notifications/discovery-notification.js';
import type { PersistedJobForNotification } from '../notifications/notifications.types.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { SavedSearch } from '../searches/searches.types.js';
import { SearchesService } from '../searches/searches.service.js';
import type { SourceSearchQuery, SourceJobRaw } from '../sources/job-source.adapter.js';
import { sourceErrorCategory } from '../sources/source-errors.js';
import { SourceRegistry } from '../sources/source-registry.js';
import {
  DEFAULT_JOB_INACTIVE_AFTER_DAYS,
  DEFAULT_JOB_SOURCE_MAX_AGE_DAYS,
  inactiveNotSeenCutoff,
  isWithinSourceMaxAge,
  readPositiveIntEnv,
} from './discovery-window.js';
import { DiscoveryRunGate } from './discovery-run-gate.js';
import { DiscoveryScanCursorStore } from './discovery-scan-cursor.js';
import {
  EMPTY_DISCOVERY_SUMMARY,
  FAILED_DISCOVERY_RESULT,
  PENDING_DISCOVERY_RESULT,
  toImmediateDiscoveryResult,
  type DiscoveryRunSummary,
  type ImmediateDiscoveryResult,
  type ListingDiagnosis,
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
  DEFAULT_MAX_QUERIES_PER_SEARCH_SOURCE,
  DEFAULT_TIME_BUDGET_MS_PER_SEARCH_SOURCE,
  buildSourceQueryUnits,
  nextQueryStartIndex,
  resolveScanKind,
  selectQueryUnits,
  sourceQueryPlanFingerprint,
  type ScanKind,
  type SourceQueryUnit,
} from './source-query-plan.js';

type SearchSourceFetchStat = {
  savedSearchId: string;
  source: SourceId;
  fetchedJobCount: number;
  normalizedJobCount: number;
  queriesAttempted: number;
  queriesCompleted: number;
  queriesDeferred: number;
  detailsFetched: number;
  detailsFailed: number;
  providerMode: string | null;
};

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly runGate = new DiscoveryRunGate();
  private readonly immediateRuns = new Map<string, ImmediateDiscoveryResult>();
  private readonly scanCursors = new DiscoveryScanCursorStore();

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
  ) {
    void this.profilesService;
  }

  async run(): Promise<DiscoveryRunSummary> {
    return this.runGate.runExclusive(async () => {
      const searches = await this.searchesService.getActiveSearches();
      return this.execute(searches, { markStale: true, trigger: 'scheduled' });
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
      const diff = diffJobSearchMatches(existing, desired);

      if (!dryRun) {
        await this.jobsService.syncMatchesForSearches(searchIds, desired);
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
        keepCount: diff.keep.length,
        insertCount: diff.insert.length,
        deleteCount: diff.remove.length,
      });

      return {
        dryRun,
        searchesEvaluated: searches.length,
        jobsEvaluated: catalogJobs.length,
        existingMatches: existing.length,
        desiredMatches: desired.length,
        keepCount: diff.keep.length,
        insertCount: diff.insert.length,
        deleteCount: diff.remove.length,
        listingsUnchanged: true,
        applicationsUnchanged: true,
        sampleKept: diff.keep.slice(0, 10).map(annotate),
        sampleInserts: diff.insert.slice(0, 10).map(annotate),
        sampleDeletes: diff.remove.slice(0, 10).map(annotate),
      };
    });
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
    options: { markStale: boolean; trigger: 'scheduled' | 'user' },
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

    const matchableJobs = mergeJobLists(catalogJobs, persisted);
    const liveMatches = this.matchingService.matchJobsToSearches(
      persisted,
      searches,
    );
    const allMatches = uniqueMatches([...catalogMatches, ...liveMatches]);
    const createdMatches = await this.jobsService.syncMatchesForSearches(
      searches.map((search) => search.id),
      allMatches,
    );
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
      queriesAttempted: fetched.queriesAttempted,
      queriesCompleted: fetched.queriesCompleted,
      queriesDeferred: fetched.queriesDeferred,
      detailsFetched: fetched.detailsFetched,
      detailsFailed: fetched.detailsFailed,
      kariyerNetPagesFetched: fetched.kariyerNetPagesFetched,
      kariyerNetJobsCollected: fetched.kariyerNetJobsCollected,
      stopReason: fetched.stopReason,
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
      queriesAttempted: fetched.queriesAttempted,
      queriesCompleted: fetched.queriesCompleted,
      queriesDeferred: fetched.queriesDeferred,
      detailsFetched: fetched.detailsFetched,
      detailsFailed: fetched.detailsFailed,
      providerModes: fetched.providerModes,
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
    queriesAttempted: number;
    queriesCompleted: number;
    queriesDeferred: number;
    detailsFetched: number;
    detailsFailed: number;
    providerModes: Record<string, string>;
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
    let queriesAttempted = 0;
    let queriesCompleted = 0;
    let queriesDeferred = 0;
    let detailsFetched = 0;
    let detailsFailed = 0;
    const providerModes: Record<string, string> = {};
    const scanKinds = new Set<ScanKind>();
    const perSearch: SearchSourceFetchStat[] = [];
    const catalogSourceIds = this.sourceRegistry
      .list()
      .map((adapter) => adapter.sourceId);

    for (const search of searches) {
      const scanKind = resolveScanKind({
        trigger: options.trigger,
        lastDiscoveredAt: search.lastDiscoveredAt,
      });
      scanKinds.add(scanKind);
      const sourceIds =
        search.sourceIds.length > 0 ? search.sourceIds : catalogSourceIds;

      for (const sourceId of sourceIds) {
        const fetched = await this.fetchFromSource(
          search,
          sourceId,
          uniqueJobs,
          { runId: options.runId, scanKind },
        );
        perSearch.push({
          savedSearchId: search.id,
          source: sourceId,
          fetchedJobCount: fetched.raw,
          normalizedJobCount: fetched.accepted,
          queriesAttempted: fetched.queriesAttempted,
          queriesCompleted: fetched.queriesCompleted,
          queriesDeferred: fetched.queriesDeferred,
          detailsFetched: fetched.detailsFetched,
          detailsFailed: fetched.detailsFailed,
          providerMode: fetched.providerMode,
        });
        jobsFetched += fetched.accepted;
        rawProviderJobs += fetched.raw;
        queriesAttempted += fetched.queriesAttempted;
        queriesCompleted += fetched.queriesCompleted;
        queriesDeferred += fetched.queriesDeferred;
        detailsFetched += fetched.detailsFetched;
        detailsFailed += fetched.detailsFailed;
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
        if (fetched.kariyerNet) {
          kariyerNetPagesFetched += fetched.kariyerNet.pagesFetched;
          kariyerNetJobsCollected += fetched.kariyerNet.jobsCollected;
        }
      }
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
      queriesAttempted,
      queriesCompleted,
      queriesDeferred,
      detailsFetched,
      detailsFailed,
      providerModes,
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
    queriesAttempted: number;
    queriesCompleted: number;
    queriesDeferred: number;
    detailsFetched: number;
    detailsFailed: number;
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
        queriesAttempted: 0,
        queriesCompleted: 0,
        queriesDeferred: 0,
        detailsFetched: 0,
        detailsFailed: 0,
        providerMode: adapter?.providerMode ?? null,
      };
    }

    const units = buildSourceQueryUnits(search);
    const fingerprint = sourceQueryPlanFingerprint(search);
    const startIndex = this.scanCursors.read(
      search.id,
      sourceId,
      fingerprint,
    ).nextIndex;
    const planned = selectQueryUnits(units, {
      startIndex,
      maxQueries: this.maxQueriesPerSearchSource(),
    });
    const startedAt = Date.now();
    const deadline = startedAt + this.timeBudgetMs();
    const collected = new Map<string, SourceJobRaw>();
    let raw = 0;
    let accepted = 0;
    let queriesCompleted = 0;
    let queriesFailed = 0;
    let pagesFetched = 0;
    let stopReason: string | null = null;
    let providerMode = adapter.providerMode ?? null;
    const deferredFromPlan = [...planned.deferred];

    for (const unit of planned.selected) {
      if (Date.now() >= deadline) {
        deferredFromPlan.push(unit);
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
          collected.set(
            sourceListingIdentity(result.sourceId, job.sourceJobId),
            job,
          );
        }
        queriesCompleted += 1;
      } catch (error) {
        queriesFailed += 1;
        this.logger.error({
          message: 'Source query failed; keeping other query results',
          runId: options.runId,
          source: sourceId,
          savedSearchId: search.id,
          providerMode,
          queryOrigin: unit.origin,
          errorCategory: sourceErrorCategory(error),
        });
      }
    }

    const queriesDeferred = deferredFromPlan.length;
    if (queriesDeferred > 0 && !stopReason) {
      stopReason = 'query_budget';
    }
    this.scanCursors.write(search.id, sourceId, {
      fingerprint,
      nextIndex: nextQueryStartIndex({
        unitCount: units.length,
        startIndex,
        attempted: queriesCompleted + queriesFailed,
        deferredCount: queriesDeferred,
      }),
    });

    let detailsFetched = 0;
    let detailsFailed = 0;
    let jobsForNormalize = [...collected.values()];
    if (adapter.enrichMissingDescriptions && jobsForNormalize.length > 0) {
      try {
        const enriched = await adapter.enrichMissingDescriptions(jobsForNormalize);
        jobsForNormalize = [...enriched.jobs];
        detailsFetched = enriched.detailsFetched;
        detailsFailed = enriched.detailsFailed;
      } catch (error) {
        this.logger.warn({
          message: 'Description enrichment failed; keeping list-card jobs',
          runId: options.runId,
          source: sourceId,
          savedSearchId: search.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

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

    const outcome = sourceOutcome({
      queriesAttempted: planned.selected.length,
      queriesCompleted,
      queriesFailed,
      queriesDeferred,
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
      queriesAttempted: planned.selected.length,
      queriesCompleted,
      queriesDeferred,
      fetched: raw,
      normalized: accepted,
      pagesFetched,
      detailsFetched,
      detailsFailed,
      jobsCollected: collected.size,
      stopReason,
    });

    return {
      accepted,
      raw,
      outcome,
      stopReason,
      queriesAttempted: planned.selected.length,
      queriesCompleted,
      queriesDeferred,
      detailsFetched,
      detailsFailed,
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
  queriesFailed: number;
  queriesDeferred: number;
  stopReason: string | null;
}): 'ok' | 'partial' | 'failed' {
  if (input.queriesAttempted === 0) {
    return 'ok';
  }

  if (input.queriesCompleted === 0 && input.queriesFailed > 0) {
    return 'failed';
  }

  if (
    input.queriesFailed > 0 ||
    input.queriesDeferred > 0 ||
    isPartialStopReason(input.stopReason)
  ) {
    return 'partial';
  }

  return 'ok';
}

function isPartialStopReason(reason: string | null | undefined): boolean {
  return Boolean(reason && PARTIAL_STOP_REASONS.has(reason));
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
  const seen = new Set<string>();
  const unique: JobSearchMatch[] = [];

  for (const match of matches) {
    const key = `${match.jobId}:${match.savedSearchId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(match);
  }

  return unique;
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
