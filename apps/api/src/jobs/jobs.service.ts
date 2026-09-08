import { randomUUID } from 'node:crypto';

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SourceId } from '../common/domain.types.js';
import {
  DEFAULT_JOB_SOURCE_MAX_AGE_DAYS,
  readPositiveIntEnv,
  sourceMaxAgeCutoff,
} from '../discovery/discovery-window.js';
import type { DuplicateCandidate } from '../duplicates/duplicates.types.js';
import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import type { JobSearchMatch, MatchableJob } from '../matching/matching.types.js';
import { MatchingService } from '../matching/matching.service.js';
import {
  mapSavedSearchRow,
  SAVED_SEARCH_SELECT,
} from '../searches/searches.mapper.js';
import type { SavedSearch } from '../searches/searches.types.js';
import { decideListingWrite } from './job-identity.js';
import { applyJobNewness, resolveJobNewWindowHours } from './job-newness.js';
import { clampJobFeedLimit, JOB_FEED_MAX_LIMIT } from './job-feed-visibility.js';
import {
  JOB_FEED_SELECT,
  MATCHABLE_JOB_SELECT,
  mapJobFeedRow,
  mapMatchableJobRow,
  type JobFeedRow,
} from './jobs.mapper.js';
import type {
  JobDetail,
  JobListItem,
  JobListQuery,
  JobListResult,
  JobTabs,
  MatchedSearchSummary,
  NormalizedJob,
} from './jobs.types.js';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type JobUpsertResult = {
  id: string;
  inserted: boolean;
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    @Optional() private readonly matchingService: MatchingService | null = null,
  ) {}

  async listForUser(query: JobListQuery): Promise<JobListResult> {
    const limit = clampJobFeedLimit(query.limit);
    const savedSearchId = parseSavedSearchId(query.savedSearchId);
    const matches = await this.loadMatchesSafe();
    const searchMeta = await this.loadUserSearchMeta(query.userId);
    if ((query.matchedOnly || savedSearchId) && searchMeta === null) {
      return emptyJobListResult();
    }

    const userSearchIds = searchMeta?.ids ?? null;
    const userMatches = filterMatchesForUser(matches, userSearchIds);
    const listMatches = savedSearchId
      ? userMatches.filter((match) => match.savedSearchId === savedSearchId)
      : userMatches;
    const matchedSearchIdsByJob = groupMatchIds(userMatches);
    const scopedQuery = { ...query, savedSearchId };
    const scopedJobIds = resolveScopedJobIds(scopedQuery, listMatches);

    if (scopedJobIds && scopedJobIds.length === 0) {
      return {
        ...emptyJobListResult(),
        lastDiscoveryAt: resolveLastDiscoveryAt(savedSearchId, searchMeta),
        totalCount: uniqueStrings(listMatches.map((match) => match.jobId)).length,
        savedSearchCounts: countMatchesBySearch(userMatches),
      };
    }

    const rows = await this.loadJobsFromTable(query, limit, scopedJobIds);
    const seenJobIds = await this.loadSeenJobIds(query.userId);
    const feedRows: JobFeedRow[] = [];

    this.logger.log({
      message: 'Job feed loaded from public.jobs',
      loadedJobCount: rows.length,
      sourceFilter: query.sourceId ?? null,
      savedSearchId: savedSearchId ?? null,
    });

    for (const row of rows) {
      const id = isRecord(row) ? readString(row, 'id') : null;
      const mapped = mapJobFeedRow(
        row,
        id ? (matchedSearchIdsByJob.get(id) ?? []) : [],
      );

      if (!mapped) {
        this.logger.warn({
          message: 'Dropped job feed row',
          jobId: id,
          source: isRecord(row) ? readString(row, 'source') : null,
        });
        continue;
      }

      feedRows.push(mapped);
    }

    const items = attachDuplicateGroupSizes(
      feedRows,
      await this.countDuplicateGroupSizes(
        feedRows
          .map((row) => row.duplicateGroupId)
          .filter((groupId): groupId is string => groupId !== null),
      ),
    );

    const page = applyJobNewness(
      items.slice(0, limit),
      userMatches,
      new Date(),
      this.getNewWindowHours(),
      seenJobIds,
    );

    this.logger.log({
      message: 'Job feed mapped',
      itemCount: page.length,
    });

    const totalCount =
      query.matchedOnly || savedSearchId
        ? uniqueStrings(listMatches.map((match) => match.jobId)).length
        : items.length;

    return {
      items: page,
      nextCursor: items.length > limit ? page[page.length - 1]?.id ?? null : null,
      lastDiscoveryAt: resolveLastDiscoveryAt(savedSearchId, searchMeta),
      totalCount,
      savedSearchCounts: countMatchesBySearch(userMatches),
    };
  }

  async getTabs(
    userId: string,
    matchedOnly = false,
    includeInactive = false,
  ): Promise<JobTabs> {
    const result = await this.listForUser({
      userId,
      limit: JOB_FEED_MAX_LIMIT,
      matchedOnly,
      includeInactive,
    });
    const items = result.items;
    const counts = savedSearchCounts(items);
    const names = await this.loadSearchNames(counts.map((item) => item.id));

    return {
      allCount: items.length,
      sources: [
        { id: 'all', label: 'All', count: items.length },
        {
          id: 'linkedin',
          label: 'LinkedIn',
          count: items.filter((item) => item.sourceId === 'linkedin').length,
        },
        {
          id: 'kariyer_net',
          label: 'Kariyer.net',
          count: items.filter((item) => item.sourceId === 'kariyer_net').length,
        },
      ],
      savedSearches: counts.map((item) => ({
        ...item,
        name: names.get(item.id) ?? item.name,
      })),
    };
  }

  async getByIdForUser(
    _userId: string,
    jobId: string,
  ): Promise<JobDetail | null> {
    const rows = await this.loadJobsByIds([jobId]);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const matches = await this.loadMatchesSafe();
    const userSearchIds = await this.loadUserSearchIds(_userId);
    const matchedSearchIds =
      groupMatchIds(filterMatchesForUser(matches, userSearchIds)).get(jobId) ??
      [];
    const mapped = mapJobFeedRow(row, matchedSearchIds);

    if (!mapped) {
      return null;
    }

    const sizes = await this.countDuplicateGroupSizes(
      mapped.duplicateGroupId ? [mapped.duplicateGroupId] : [],
    );
    const seenJobIds = await this.loadSeenJobIds(_userId);
    const [item] = applyJobNewness(
      attachDuplicateGroupSizes([mapped], sizes),
      filterMatchesForUser(matches, userSearchIds).filter(
        (match) => match.jobId === jobId,
      ),
      new Date(),
      this.getNewWindowHours(),
      seenJobIds,
    );
    if (!item) {
      return null;
    }

    const duplicateJobs = await this.loadDuplicateSiblings(
      mapped.duplicateGroupId,
      jobId,
    );
    const searchNames = await this.loadSearchNames(matchedSearchIds);
    const tracking = await this.loadUserTracking(_userId, jobId);
    const matchable = mapMatchableJobRow(row);
    const savedSearches = await this.loadSavedSearchesByIds(matchedSearchIds);

    return {
      ...item,
      description: mapped.description,
      experienceLevel: mapped.experienceLevel,
      technologies: mapped.technologies,
      matchedSearches: this.explainMatchedSearches(
        matchable,
        matchedSearchIds,
        searchNames,
        savedSearches,
      ),
      duplicateJobs,
      isFavorite: tracking.isFavorite,
      applicationStatus: tracking.applicationStatus,
      applicationId: tracking.applicationId,
    };
  }

  async getByIdForUserOrThrow(userId: string, jobId: string): Promise<JobDetail> {
    const job = await this.getByIdForUser(userId, jobId);
    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    return job;
  }

  async getMappedByIds(
    jobIds: readonly string[],
    userId?: string,
  ): Promise<JobListItem[]> {
    const uniqueIds = uniqueStrings(jobIds);
    if (uniqueIds.length === 0) {
      return [];
    }

    const rows = await this.loadJobsByIds(uniqueIds);
    const matches = await this.loadMatchesSafe();
    const userSearchIds = userId ? await this.loadUserSearchIds(userId) : null;
    const userMatches = filterMatchesForUser(matches, userSearchIds);
    const matchedSearchIdsByJob = groupMatchIds(userMatches);
    const feedRows: JobFeedRow[] = [];

    for (const row of rows) {
      const id = isRecord(row) ? readString(row, 'id') : null;
      const mapped = mapJobFeedRow(
        row,
        id ? (matchedSearchIdsByJob.get(id) ?? []) : [],
      );
      if (mapped) {
        feedRows.push(mapped);
      }
    }

    const seenJobIds = userId
      ? await this.loadSeenJobIds(userId)
      : new Set<string>();

    return applyJobNewness(
      attachDuplicateGroupSizes(
        feedRows,
        await this.countDuplicateGroupSizes(
          feedRows
            .map((row) => row.duplicateGroupId)
            .filter((groupId): groupId is string => groupId !== null),
        ),
      ),
      userMatches,
      new Date(),
      this.getNewWindowHours(),
      seenJobIds,
    );
  }

  async markSeenForUser(userId: string, jobId: string): Promise<JobDetail> {
    await this.getByIdForUserOrThrow(userId, jobId);
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .getClient()
      .from('user_job_states')
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
          seen_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id,job_id' },
      );

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to mark job as seen.');
    }

    const job = await this.getByIdForUserOrThrow(userId, jobId);
    return {
      ...job,
      isSeen: true,
      isNew: false,
    };
  }

  private getNewWindowHours(): number {
    return resolveJobNewWindowHours(
      this.config.get<string>('JOB_NEW_WINDOW_HOURS'),
    );
  }

  private maxAgeDays(): number {
    return readPositiveIntEnv(
      this.config.get<string>('JOB_SOURCE_MAX_AGE_DAYS'),
      DEFAULT_JOB_SOURCE_MAX_AGE_DAYS,
    );
  }

  private async loadSeenJobIds(userId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    if (!userId || userId === 'anonymous') {
      return ids;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('user_job_states')
      .select('job_id')
      .eq('user_id', userId);

    if (error) {
      this.logger.warn({
        message: 'user_job_states unavailable; treating all jobs as unseen',
      });
      return ids;
    }

    if (!Array.isArray(data)) {
      return ids;
    }

    for (const row of data) {
      if (!isRecord(row)) {
        continue;
      }

      const jobId = readString(row, 'job_id');
      if (jobId) {
        ids.add(jobId);
      }
    }

    return ids;
  }

  private async loadUserSearchIds(
    userId: string,
  ): Promise<ReadonlySet<string> | null> {
    const meta = await this.loadUserSearchMeta(userId);
    return meta ? meta.ids : null;
  }

  private async loadUserSearchMeta(
    userId: string,
  ): Promise<UserSearchMeta | null> {
    if (!userId || userId === 'anonymous') {
      return null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .select('id, last_discovered_at')
      .eq('user_id', userId);

    if (error) {
      this.logger.warn({
        message: 'Could not load user saved searches for match filtering',
      });
      return null;
    }

    const ids = new Set<string>();
    const lastDiscoveryAtById = new Map<string, string>();
    if (!Array.isArray(data)) {
      return { ids, lastDiscoveryAtById };
    }

    for (const row of data) {
      if (!isRecord(row)) {
        continue;
      }

      const id = readString(row, 'id');
      if (!id) {
        continue;
      }

      ids.add(id);
      const discoveredAt = readString(row, 'last_discovered_at');
      if (discoveredAt) {
        lastDiscoveryAtById.set(id, discoveredAt);
      }
    }

    return { ids, lastDiscoveryAtById };
  }

  private async countUnscopedFeedJobs(query: JobListQuery): Promise<number> {
    try {
      let request = this.supabase
        .getClient()
        .from('jobs')
        .select('id', { count: 'exact', head: true });

      if (!query.includeInactive) {
        request = request.eq('is_active', true);
      }

      const publishedCutoff = sourceMaxAgeCutoff(this.maxAgeDays()).toISOString();
      request = request.or(
        `published_at.is.null,published_at.gte."${publishedCutoff}"`,
      );

      if (query.sourceId && query.sourceId !== 'all') {
        request = request.eq('source', query.sourceId);
      }

      const { count, error } = await request;
      if (error || typeof count !== 'number') {
        return 0;
      }

      return count;
    } catch {
      return 0;
    }
  }

  private async loadSearchNames(
    searchIds: readonly string[],
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const uniqueIds = uniqueStrings(searchIds);
    if (uniqueIds.length === 0) {
      return names;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .select('id, name')
      .in('id', uniqueIds);

    if (error) {
      this.logger.warn({
        message: 'Saved search names unavailable; using ids',
      });
      return names;
    }

    if (!Array.isArray(data)) {
      return names;
    }

    for (const row of data) {
      if (!isRecord(row)) {
        continue;
      }

      const id = readString(row, 'id');
      const name = readString(row, 'name');
      if (id && name) {
        names.set(id, name);
      }
    }

    return names;
  }

  private async loadSavedSearchesByIds(
    searchIds: readonly string[],
  ): Promise<Map<string, SavedSearch>> {
    const searches = new Map<string, SavedSearch>();
    const uniqueIds = uniqueStrings(searchIds);
    if (uniqueIds.length === 0) {
      return searches;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .select(SAVED_SEARCH_SELECT)
      .in('id', uniqueIds);

    if (error) {
      this.logger.warn({
        message: 'Saved searches unavailable; match evidence omitted',
      });
      return searches;
    }

    if (!Array.isArray(data)) {
      return searches;
    }

    for (const row of data) {
      const search = mapSavedSearchRow(row);
      if (search) {
        searches.set(search.id, search);
      }
    }

    return searches;
  }

  private explainMatchedSearches(
    job: MatchableJob | null,
    matchedSearchIds: readonly string[],
    searchNames: ReadonlyMap<string, string>,
    savedSearches: ReadonlyMap<string, SavedSearch>,
  ): MatchedSearchSummary[] {
    return matchedSearchIds.map((id) => {
      const saved = savedSearches.get(id);
      const name = saved?.name ?? searchNames.get(id) ?? id;
      if (!this.matchingService || !job || !saved) {
        return emptyMatchedSearch(id, name);
      }

      const decision = this.matchingService.evaluateMatch(job, saved);
      if (!decision.matched) {
        return emptyMatchedSearch(id, name);
      }

      return {
        id,
        name,
        matchKind: decision.matchKind,
        terms: uniqueEvidenceTerms(decision.evidence),
        evidence: decision.evidence.map((item) => ({
          term: item.term,
          matchedText: item.matchedText,
          field: item.field,
          snippet: item.snippet,
          kind: item.kind,
        })),
      };
    });
  }

  private async loadUserTracking(
    userId: string,
    jobId: string,
  ): Promise<{
    isFavorite: boolean;
    applicationStatus: JobDetail['applicationStatus'];
    applicationId: string | null;
  }> {
    const empty = {
      isFavorite: false,
      applicationStatus: null,
      applicationId: null,
    };

    if (!userId || userId === 'anonymous') {
      return empty;
    }

    const [favoriteResult, applicationResult] = await Promise.all([
      this.supabase
        .getClient()
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .maybeSingle(),
      this.supabase
        .getClient()
        .from('applications')
        .select('id, status')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .maybeSingle(),
    ]);

    if (favoriteResult.error && favoriteResult.error.code !== 'PGRST116') {
      this.logger.warn({
        message: 'Favorite lookup failed; continuing without favorite state',
      });
    }

    if (applicationResult.error && applicationResult.error.code !== 'PGRST116') {
      this.logger.warn({
        message: 'Application lookup failed; continuing without status',
      });
    }

    const application = isRecord(applicationResult.data)
      ? applicationResult.data
      : null;
    const statusRaw = application ? readString(application, 'status') : null;

    return {
      isFavorite: favoriteResult.data !== null,
      applicationId: application ? readString(application, 'id') : null,
      applicationStatus:
        statusRaw === 'NEW' ||
        statusRaw === 'REVIEWING' ||
        statusRaw === 'APPLIED' ||
        statusRaw === 'INTERVIEW' ||
        statusRaw === 'OFFER' ||
        statusRaw === 'REJECTED'
          ? statusRaw
          : null,
    };
  }

  private async loadMatchesSafe(
    savedSearchId?: string,
  ): Promise<JobMatchRow[]> {
    try {
      return await this.loadMatches(savedSearchId);
    } catch {
      this.logger.warn({
        message: 'Job matches unavailable; returning jobs without match metadata',
      });
      return [];
    }
  }

  private async loadJobsFromTable(
    query: JobListQuery,
    limit: number,
    scopedJobIds?: readonly string[],
  ): Promise<unknown[]> {
    let request = this.supabase.getClient().from('jobs').select(JOB_FEED_SELECT);

    if (!query.includeInactive) {
      request = request.eq('is_active', true);
    }

    const publishedCutoff = sourceMaxAgeCutoff(this.maxAgeDays()).toISOString();
    request = request.or(
      `published_at.is.null,published_at.gte."${publishedCutoff}"`,
    );

    if (query.sourceId && query.sourceId !== 'all') {
      request = request.eq('source', query.sourceId);
    }

    if (scopedJobIds) {
      request = request.in('id', [...scopedJobIds]);
    }

    // Feed order is recency, not match score: published_at DESC NULLS LAST, then discovered_at DESC.
    const { data, error } = await request
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('discovered_at', { ascending: false })
      .limit(limit + 1);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load job listings.');
    }

    this.logger.log({
      message: 'public.jobs query completed',
      rowCount: Array.isArray(data) ? data.length : 0,
    });

    return Array.isArray(data) ? data : [];
  }

  private async loadMatches(
    savedSearchId?: string,
  ): Promise<JobMatchRow[]> {
    const query = this.supabase
      .getClient()
      .from('job_search_matches')
      .select('job_id, saved_search_id, matched_at');

    const { data, error } = savedSearchId
      ? await query.eq('saved_search_id', savedSearchId)
      : await query;

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load job matches.');
    }

    if (!Array.isArray(data)) {
      return [];
    }

    const matches: JobMatchRow[] = [];

    for (const row of data) {
      if (!isRecord(row)) {
        continue;
      }

      const jobId = readString(row, 'job_id');
      const searchId = readString(row, 'saved_search_id');
      if (jobId && searchId) {
        matches.push({
          jobId,
          savedSearchId: searchId,
          matchedAt: readDate(row, 'matched_at'),
        });
      }
    }

    return matches;
  }

  private async loadJobsByIds(jobIds: readonly string[]): Promise<unknown[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .select(JOB_FEED_SELECT)
      .in('id', [...jobIds]);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load job listings.');
    }

    return Array.isArray(data) ? data : [];
  }

  private async countDuplicateGroupSizes(
    groupIds: readonly string[],
  ): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    const uniqueGroupIds = uniqueStrings(groupIds);

    if (uniqueGroupIds.length === 0) {
      return sizes;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .select('id, duplicate_group_id')
      .in('duplicate_group_id', uniqueGroupIds);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException(
        'Failed to load duplicate group sizes.',
      );
    }

    if (!Array.isArray(data)) {
      return sizes;
    }

    for (const row of data) {
      if (!isRecord(row)) {
        continue;
      }

      const groupId = readString(row, 'duplicate_group_id');
      if (!groupId) {
        continue;
      }

      sizes.set(groupId, (sizes.get(groupId) ?? 0) + 1);
    }

    return sizes;
  }

  private async loadDuplicateSiblings(
    duplicateGroupId: string | null,
    jobId: string,
  ): Promise<
    {
      id: string;
      sourceId: JobListItem['sourceId'];
      title: string;
      companyName: string;
      canonicalUrl: string;
    }[]
  > {
    if (!duplicateGroupId) {
      return [];
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .select(JOB_FEED_SELECT)
      .eq('duplicate_group_id', duplicateGroupId);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load related jobs.');
    }

    if (!Array.isArray(data)) {
      return [];
    }

    const siblings: {
      id: string;
      sourceId: JobListItem['sourceId'];
      title: string;
      companyName: string;
      canonicalUrl: string;
    }[] = [];

    for (const row of data) {
      const mapped = mapJobFeedRow(row, []);
      if (!mapped || mapped.item.id === jobId) {
        continue;
      }

      siblings.push({
        id: mapped.item.id,
        sourceId: mapped.item.sourceId,
        title: mapped.item.title,
        companyName: mapped.item.companyName,
        canonicalUrl: mapped.item.canonicalUrl,
      });
    }

    return siblings;
  }

  async upsertNormalized(job: NormalizedJob): Promise<JobUpsertResult> {
    const existingId = await this.findIdBySourceIdentity(
      job.sourceId,
      job.sourceJobId,
    );
    const decision = decideListingWrite(existingId);
    const now = new Date().toISOString();

    if (decision === 'update' && existingId) {
      await this.updateExisting(existingId, job, now);
      return { id: existingId, inserted: false };
    }

    const id = randomUUID();
    await this.insertListing(id, job, now);
    return { id, inserted: true };
  }

  async listDuplicateCandidates(): Promise<DuplicateCandidate[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .select('id, source, title, company, original_url');

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load job listings.');
    }

    if (!Array.isArray(data)) {
      return [];
    }

    const candidates: DuplicateCandidate[] = [];

    for (const row of data) {
      const candidate = mapDuplicateCandidate(row);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  async listMatchableActiveJobs(): Promise<MatchableJob[]> {
    const pageSize = 1000;
    const jobs: MatchableJob[] = [];
    let from = 0;
    let rawCount = 0;

    for (;;) {
      const { data, error } = await this.supabase
        .getClient()
        .from('jobs')
        .select(MATCHABLE_JOB_SELECT)
        .eq('is_active', true)
        .range(from, from + pageSize - 1);

      if (error) {
        this.logSupabaseError(error);
        throw new InternalServerErrorException('Failed to load job listings.');
      }

      const rows = Array.isArray(data) ? data : [];
      rawCount += rows.length;

      for (const row of rows) {
        const mapped = mapMatchableJobRow(row);
        if (mapped) {
          jobs.push(mapped);
        }
      }

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
      if (from >= 50_000) {
        break;
      }
    }

    this.logger.log({
      message: 'Catalog jobs mapped for rematch',
      rawCount,
      mappedCount: jobs.length,
    });

    return jobs;
  }

  async saveMatches(matches: readonly JobSearchMatch[]): Promise<JobSearchMatch[]> {
    const created: JobSearchMatch[] = [];

    for (const match of matches) {
      const existing = await this.findMatch(match.jobId, match.savedSearchId);

      if (existing) {
        continue;
      }

      await this.insertMatch(match);
      created.push(match);
    }

    return created;
  }

  async syncMatchesForSearches(
    searchIds: readonly string[],
    matches: readonly JobSearchMatch[],
  ): Promise<JobSearchMatch[]> {
    const allowed = new Set(
      searchIds.filter((id) => id.trim().length > 0),
    );
    if (allowed.size === 0) {
      return [];
    }

    const desired = matches.filter((match) => allowed.has(match.savedSearchId));
    const desiredBySearch = new Map<string, Set<string>>();
    for (const searchId of allowed) {
      desiredBySearch.set(searchId, new Set());
    }
    for (const match of desired) {
      desiredBySearch.get(match.savedSearchId)?.add(match.jobId);
    }

    for (const [searchId, jobIds] of desiredBySearch) {
      const existing = await this.loadMatches(searchId);
      const staleJobIds = existing
        .map((row) => row.jobId)
        .filter((jobId) => !jobIds.has(jobId));
      await this.deleteMatches(searchId, staleJobIds);
    }

    return this.saveMatches(desired);
  }

  async listMatchesForSearches(
    searchIds: readonly string[],
  ): Promise<JobSearchMatch[]> {
    const allowed = new Set(searchIds.filter((id) => id.trim().length > 0));
    if (allowed.size === 0) {
      return [];
    }

    const matches: JobSearchMatch[] = [];
    for (const searchId of allowed) {
      const rows = await this.loadMatches(searchId);
      for (const row of rows) {
        matches.push({
          jobId: row.jobId,
          savedSearchId: row.savedSearchId,
        });
      }
    }

    return matches;
  }

  async markInactiveNotSeenSince(cutoffIso: string): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq('is_active', true)
      .lt('last_seen_at', cutoffIso)
      .select('id');

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException(
        'Failed to mark stale job listings inactive.',
      );
    }

    return Array.isArray(data) ? data.length : 0;
  }

  private async findIdBySourceIdentity(
    sourceId: SourceId,
    sourceJobId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .select('id')
      .eq('source', sourceId)
      .eq('source_job_id', sourceJobId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to look up job listing.');
    }

    const id = isRecord(data) ? data.id : null;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }

  private async insertListing(
    id: string,
    job: NormalizedJob,
    now: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('jobs')
      .insert({
        id,
        source: job.sourceId,
        source_job_id: job.sourceJobId,
        original_url: job.canonicalUrl,
        title: job.title,
        company: job.companyName,
        description: job.description,
        location: job.location,
        work_model: job.workModel,
        experience_level: job.experienceLevel,
        technologies: [...job.technologies],
        published_at: publishedAtForDatabase(job.publishedAt),
        discovered_at: now,
        last_seen_at: now,
        is_active: job.isActive,
        created_at: now,
        updated_at: now,
      });

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to store job listing.');
    }
  }

  private async updateExisting(
    id: string,
    job: NormalizedJob,
    now: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('jobs')
      .update({
        original_url: job.canonicalUrl,
        title: job.title,
        company: job.companyName,
        description: job.description,
        location: job.location,
        work_model: job.workModel,
        experience_level: job.experienceLevel,
        technologies: [...job.technologies],
        published_at: publishedAtForDatabase(job.publishedAt),
        last_seen_at: now,
        is_active: job.isActive,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to update job listing.');
    }
  }

  private async findMatch(
    jobId: string,
    savedSearchId: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('job_search_matches')
      .select('id')
      .eq('job_id', jobId)
      .eq('saved_search_id', savedSearchId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to look up job match.');
    }

    return data !== null;
  }

  private async deleteMatches(
    savedSearchId: string,
    jobIds: readonly string[],
  ): Promise<void> {
    const uniqueIds = uniqueStrings(jobIds);
    if (uniqueIds.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .getClient()
      .from('job_search_matches')
      .delete()
      .eq('saved_search_id', savedSearchId)
      .in('job_id', uniqueIds);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to update job matches.');
    }
  }

  private async insertMatch(match: JobSearchMatch): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .getClient()
      .from('job_search_matches')
      .insert({
        job_id: match.jobId,
        saved_search_id: match.savedSearchId,
        matched_at: now,
        match_score: 1,
        match_reason: 'Matched saved search filters',
      });

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to store job match.');
    }
  }

  private logSupabaseError(error: SafeSupabaseError): void {
    this.logger.error({
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

function mapDuplicateCandidate(value: unknown): DuplicateCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const sourceId = readString(value, 'source');
  const title = readString(value, 'title');
  const companyName = readString(value, 'company');
  const canonicalUrl = readString(value, 'original_url');

  if (
    !id ||
    !title ||
    !companyName ||
    !canonicalUrl ||
    (sourceId !== 'linkedin' && sourceId !== 'kariyer_net')
  ) {
    return null;
  }

  return {
    id,
    sourceId,
    title,
    companyName,
    canonicalUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readDate(row: Record<string, unknown>, key: string): Date | null {
  const value = row[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseSavedSearchId(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === 'all') {
    return undefined;
  }

  return trimmed;
}

function emptyJobListResult(): JobListResult {
  return {
    items: [],
    nextCursor: null,
    lastDiscoveryAt: null,
    totalCount: 0,
    savedSearchCounts: [],
  };
}

type UserSearchMeta = {
  ids: ReadonlySet<string>;
  lastDiscoveryAtById: ReadonlyMap<string, string>;
};

function resolveLastDiscoveryAt(
  savedSearchId: string | undefined,
  meta: UserSearchMeta | null,
): string | null {
  if (!meta) {
    return null;
  }

  if (savedSearchId) {
    return meta.lastDiscoveryAtById.get(savedSearchId) ?? null;
  }

  let latest: string | null = null;
  for (const iso of meta.lastDiscoveryAtById.values()) {
    if (!latest || iso > latest) {
      latest = iso;
    }
  }

  return latest;
}

function countMatchesBySearch(
  matches: readonly JobMatchRow[],
): { id: string; count: number }[] {
  const jobsBySearch = new Map<string, Set<string>>();

  for (const match of matches) {
    const jobs = jobsBySearch.get(match.savedSearchId) ?? new Set<string>();
    jobs.add(match.jobId);
    jobsBySearch.set(match.savedSearchId, jobs);
  }

  return [...jobsBySearch.entries()].map(([id, jobs]) => ({
    id,
    count: jobs.size,
  }));
}

type JobMatchRow = {
  jobId: string;
  savedSearchId: string;
  matchedAt: Date | null;
};

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueEvidenceTerms(
  evidence: readonly { term: string }[],
): string[] {
  return uniqueStrings(evidence.map((item) => item.term));
}

function emptyMatchedSearch(id: string, name: string): MatchedSearchSummary {
  return {
    id,
    name,
    matchKind: null,
    terms: [],
    evidence: [],
  };
}

function resolveScopedJobIds(
  query: JobListQuery,
  userMatches: readonly JobMatchRow[],
): string[] | undefined {
  if (!query.matchedOnly && !query.savedSearchId) {
    return undefined;
  }

  return uniqueStrings(userMatches.map((match) => match.jobId));
}

function filterMatchesForUser(
  matches: readonly JobMatchRow[],
  userSearchIds: ReadonlySet<string> | null,
): JobMatchRow[] {
  if (!userSearchIds) {
    return [...matches];
  }

  return matches.filter((match) => userSearchIds.has(match.savedSearchId));
}

function groupMatchIds(
  matches: readonly JobMatchRow[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const match of matches) {
    const ids = grouped.get(match.jobId) ?? [];
    if (!ids.includes(match.savedSearchId)) {
      ids.push(match.savedSearchId);
    }
    grouped.set(match.jobId, ids);
  }

  return grouped;
}

function attachDuplicateGroupSizes(
  rows: readonly JobFeedRow[],
  sizes: ReadonlyMap<string, number>,
): JobListItem[] {
  return rows.map((row) => ({
    ...row.item,
    duplicateGroupSize: row.duplicateGroupId
      ? (sizes.get(row.duplicateGroupId) ?? 1)
      : 1,
  }));
}

function savedSearchCounts(
  items: readonly JobListItem[],
): { id: string; name: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const searchId of item.matchedSearchIds) {
      counts.set(searchId, (counts.get(searchId) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([id, count]) => ({
    id,
    name: id,
    count,
  }));
}

function publishedAtForDatabase(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return null;
  }

  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}
