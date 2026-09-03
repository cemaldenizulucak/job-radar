import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SourceId } from '../common/domain.types.js';
import { resolveSavedSearchLocation } from '../common/search-location.js';
import { DuplicateGroupsService } from '../duplicates/duplicate-groups.service.js';
import { LocationsService } from '../locations/locations.service.js';
import { DuplicatesService } from '../duplicates/duplicates.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { NormalizedJob } from '../jobs/jobs.types.js';
import { sourceListingIdentity } from '../jobs/job-identity.js';
import { MatchingService } from '../matching/matching.service.js';
import type { JobSearchMatch, MatchableJob } from '../matching/matching.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { selectVisibleNewMatches } from '../notifications/discovery-notification.js';
import type { PersistedJobForNotification } from '../notifications/notifications.types.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { SavedSearch } from '../searches/searches.types.js';
import { SearchesService } from '../searches/searches.service.js';
import type { SourceSearchQuery } from '../sources/job-source.adapter.js';
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
import {
  EMPTY_DISCOVERY_SUMMARY,
  type DiscoveryRunSummary,
} from './discovery.types.js';
import { normalizeSourceJob } from './job-normalizer.js';

type SearchSourceFetchStat = {
  savedSearchId: string;
  source: SourceId;
  fetchedJobCount: number;
  normalizedJobCount: number;
};

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly runGate = new DiscoveryRunGate();

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
      return this.execute(searches, { markStale: true });
    });
  }

  async runForSavedSearch(savedSearch: SavedSearch): Promise<DiscoveryRunSummary> {
    if (!savedSearch.isActive) {
      return { ...EMPTY_DISCOVERY_SUMMARY };
    }

    return this.runGate.runForSearch(savedSearch.id, () =>
      this.execute([savedSearch], { markStale: false }),
    );
  }

  private async execute(
    searches: readonly SavedSearch[],
    options: { markStale: boolean },
  ): Promise<DiscoveryRunSummary> {
    if (searches.length === 0) {
      return { ...EMPTY_DISCOVERY_SUMMARY };
    }

    await this.locationsService.primeSubdivisionCaches(
      searches
        .map((search) => search.countryCode)
        .filter((code): code is string => Boolean(code)),
    );

    const fetched = await this.fetchNormalizedJobs(searches);
    let jobsInserted = 0;
    const persisted: MatchableJob[] = [];
    const persistedForNotification: PersistedJobForNotification[] = [];

    for (const job of fetched.uniqueJobs) {
      const result = await this.jobsService.upsertNormalized(job);
      const matchable = toMatchableJob(result.id, job);
      if (result.inserted) {
        jobsInserted += 1;
      }

      persisted.push(matchable);
      persistedForNotification.push({
        id: result.id,
        sourceId: job.sourceId,
        isActive: job.isActive,
        publishedAt: job.publishedAt,
      });
    }

    const matchableJobs = await this.mergeCatalogJobs(persisted);
    const matches = this.matchingService.matchJobsToSearches(
      matchableJobs,
      searches,
    );
    const createdMatches = await this.jobsService.saveMatches(matches);
    const visible = selectVisibleNewMatches(
      createdMatches,
      persistedForNotification,
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
    this.logSavedSearchOutcomes(searches, matchableJobs, fetched.perSearch);
    this.logDiscoveryCounts({
      usersProcessed,
      searchesProcessed: searches.length,
      jobsFetched: fetched.jobsFetched,
      jobsInserted,
      matchesCreated,
      rawProviderJobs: fetched.rawProviderJobs,
      normalizedJobs: fetched.uniqueJobs.length,
      visibleMatchesCreated: visible.matches.length,
      notifiedJobCount,
    });

    this.logger.log({
      message: 'Discovery Kariyer.net collection',
      kariyerNetPagesFetched: fetched.kariyerNetPagesFetched,
      kariyerNetJobsCollected: fetched.kariyerNetJobsCollected,
      stopReason: fetched.stopReason,
    });

    return {
      usersProcessed,
      searchesProcessed: searches.length,
      jobsFetched: fetched.jobsFetched,
      jobsInserted,
      matchesCreated,
      duplicateGroupsCreated,
      notificationsCreated,
      kariyerNetPagesFetched: fetched.kariyerNetPagesFetched,
      kariyerNetJobsCollected: fetched.kariyerNetJobsCollected,
      stopReason: fetched.stopReason,
      sourceAttempts: fetched.sourceAttempts,
      sourceFailures: fetched.sourceFailures,
      rawProviderJobs: fetched.rawProviderJobs,
      normalizedJobs: fetched.uniqueJobs.length,
      notifiedJobCount,
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

  private async mergeCatalogJobs(
    persisted: readonly MatchableJob[],
  ): Promise<MatchableJob[]> {
    const byId = new Map(persisted.map((job) => [job.id, job]));

    try {
      const catalog = await this.jobsService.listMatchableActiveJobs();
      for (const job of catalog) {
        if (!byId.has(job.id)) {
          byId.set(job.id, job);
        }
      }
    } catch (error) {
      this.logger.warn({
        message: 'Failed to load catalog jobs for rematch; using this run only',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    return [...byId.values()];
  }

  private async fetchNormalizedJobs(
    searches: readonly SavedSearch[],
  ): Promise<{
    jobsFetched: number;
    uniqueJobs: NormalizedJob[];
    rawProviderJobs: number;
    kariyerNetPagesFetched: number;
    kariyerNetJobsCollected: number;
    stopReason: string | null;
    sourceAttempts: number;
    sourceFailures: number;
    perSearch: readonly SearchSourceFetchStat[];
  }> {
    const uniqueJobs = new Map<string, NormalizedJob>();
    let jobsFetched = 0;
    let rawProviderJobs = 0;
    let kariyerNetPagesFetched = 0;
    let kariyerNetJobsCollected = 0;
    let stopReason: string | null = null;
    let sourceAttempts = 0;
    let sourceFailures = 0;
    const perSearch: SearchSourceFetchStat[] = [];
    const catalogSourceIds = this.sourceRegistry
      .list()
      .map((adapter) => adapter.sourceId);

    for (const search of searches) {
      const sourceIds =
        search.sourceIds.length > 0 ? search.sourceIds : catalogSourceIds;

      for (const sourceId of sourceIds) {
        const fetched = await this.fetchFromSource(search, sourceId, uniqueJobs);
        perSearch.push({
          savedSearchId: search.id,
          source: sourceId,
          fetchedJobCount: fetched.raw,
          normalizedJobCount: fetched.accepted,
        });
        jobsFetched += fetched.accepted;
        rawProviderJobs += fetched.raw;
        if (fetched.outcome !== 'skipped') {
          sourceAttempts += 1;
        }
        if (fetched.outcome === 'failed') {
          sourceFailures += 1;
        }
        if (fetched.kariyerNet) {
          kariyerNetPagesFetched += fetched.kariyerNet.pagesFetched;
          kariyerNetJobsCollected += fetched.kariyerNet.jobsCollected;
          stopReason = preferKariyerStopReason(
            stopReason,
            fetched.kariyerNet.stopReason,
          );
        }
      }
    }

    return {
      jobsFetched,
      uniqueJobs: [...uniqueJobs.values()],
      rawProviderJobs,
      kariyerNetPagesFetched,
      kariyerNetJobsCollected,
      stopReason,
      sourceAttempts,
      sourceFailures,
      perSearch,
    };
  }

  private async fetchFromSource(
    search: SavedSearch,
    sourceId: SourceId,
    uniqueJobs: Map<string, NormalizedJob>,
  ): Promise<{
    accepted: number;
    raw: number;
    outcome: 'skipped' | 'ok' | 'failed';
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
        source: sourceId,
        savedSearchId: search.id,
      });
      return { accepted: 0, raw: 0, outcome: 'skipped' };
    }

    const startedAt = Date.now();

    try {
      const result = await adapter.search(toSourceQuery(search, this.maxAgeDays()));
      let accepted = 0;
      const now = new Date();

      for (const raw of result.jobs) {
        const normalized = normalizeSourceJob(result.sourceId, raw);
        if (!normalized) {
          continue;
        }

        if (!isWithinSourceMaxAge(normalized.publishedAt, this.maxAgeDays(), now)) {
          this.logger.log({
            message: 'Discarded job older than source max age',
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

      this.logger.log({
        message: 'Source fetch completed',
        source: sourceId,
        savedSearchId: search.id,
        durationMs: Date.now() - startedAt,
        fetched: result.jobs.length,
        normalized: accepted,
        pagesFetched: result.pagesFetched ?? null,
        jobsCollected: result.jobsCollected ?? result.jobs.length,
        stopReason: result.stopReason ?? null,
      });

      return {
        accepted,
        raw: result.jobs.length,
        outcome: 'ok',
        kariyerNet:
          sourceId === 'kariyer_net'
            ? {
                pagesFetched: result.pagesFetched ?? 0,
                jobsCollected: result.jobsCollected ?? result.jobs.length,
                stopReason: result.stopReason ?? null,
              }
            : undefined,
      };
    } catch (error) {
      this.logger.error({
        message: 'Source adapter failed; continuing discovery',
        source: sourceId,
        savedSearchId: search.id,
        durationMs: Date.now() - startedAt,
        fetched: 0,
        normalized: 0,
        errorCategory: sourceErrorCategory(error),
      });
      return { accepted: 0, raw: 0, outcome: 'failed' };
    }
  }

  private logSavedSearchOutcomes(
    searches: readonly SavedSearch[],
    jobs: readonly MatchableJob[],
    fetchStats: readonly SearchSourceFetchStat[],
  ): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    for (const search of searches) {
      const sourceStats = fetchStats.filter(
        (stat) => stat.savedSearchId === search.id,
      );
      let matchedCount = 0;
      let rejectedCount = 0;
      const rejectReasons: Record<string, number> = {};

      for (const job of jobs) {
        const decision = this.matchingService.evaluateMatch(job, search);
        if (decision.matched) {
          matchedCount += 1;
          continue;
        }

        rejectedCount += 1;
        for (const reason of decision.reasons) {
          rejectReasons[reason] = (rejectReasons[reason] ?? 0) + 1;
        }
      }

      for (const stat of sourceStats) {
        this.logger.log({
          message: 'Saved search discovery',
          userId: search.userId,
          savedSearchId: search.id,
          searchName: search.name,
          source: stat.source,
          fetchedJobCount: stat.fetchedJobCount,
          normalizedJobCount: stat.normalizedJobCount,
          matchedCount,
          rejectedCount,
          rejectReasons,
        });
      }
    }
  }

  private logDiscoveryCounts(counts: {
    usersProcessed: number;
    searchesProcessed: number;
    jobsFetched: number;
    jobsInserted: number;
    matchesCreated: number;
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

function preferKariyerStopReason(
  current: string | null,
  next: string | null,
): string | null {
  if (next === 'blocked_after_success' || current === 'blocked_after_success') {
    return 'blocked_after_success';
  }

  return next ?? current;
}

function toSourceQuery(
  search: SavedSearch,
  maxAgeDays: number,
): SourceSearchQuery {
  const resolved = resolveSavedSearchLocation(search);

  return {
    keywords: search.keywords,
    technologies: search.technologies,
    locations: [...resolved.locations],
    workModels: [],
    experienceLevels: search.experienceLevels,
    savedSearchId: search.id,
    maxAgeDays,
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
  };
}
