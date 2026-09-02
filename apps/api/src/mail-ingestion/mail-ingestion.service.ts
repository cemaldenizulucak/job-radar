import { Inject, Injectable } from '@nestjs/common';

import { normalizeSourceJob } from '../discovery/job-normalizer.js';
import type { NormalizedJob } from '../jobs/jobs.types.js';
import type { SourceJobRaw } from '../sources/job-source.adapter.js';
import type { IngestedEmailStore } from './ingested-email.store.js';
import { JobAlertParserRegistry } from './job-alert-parser.registry.js';
import { INGESTED_EMAIL_STORE } from './mail-ingestion.tokens.js';
import type {
  JobAlertEmail,
  MailIngestionResult,
} from './types/job-alert.types.js';

@Injectable()
export class MailIngestionService {
  constructor(
    private readonly parsers: JobAlertParserRegistry,
    @Inject(INGESTED_EMAIL_STORE)
    private readonly ingestedEmails: IngestedEmailStore,
  ) {}

  async ingest(email: JobAlertEmail): Promise<MailIngestionResult> {
    const externalMessageId = email.externalMessageId.trim();
    const alreadyProcessed =
      await this.ingestedEmails.findByExternalMessageId(externalMessageId);

    if (alreadyProcessed) {
      return {
        status: 'already_processed',
        externalMessageId,
        sourceId: alreadyProcessed.sourceId,
        alertName: null,
        jobs: [],
      };
    }

    const parser = this.parsers.findParser(email);
    if (!parser) {
      return {
        status: 'unrecognized_sender',
        externalMessageId,
        sourceId: null,
        alertName: null,
        jobs: [],
        reason: 'No job-alert parser is registered for this sender.',
      };
    }

    const parsed = parser.parse(email);
    if (parsed.status !== 'parsed') {
      return {
        status: 'unsupported',
        externalMessageId,
        sourceId: parsed.sourceId,
        alertName: parsed.alertName,
        jobs: [],
        reason: parsed.reason,
      };
    }

    const jobs = toNormalizedJobs(parsed.sourceId, parsed.jobs);
    await this.ingestedEmails.save({
      externalMessageId,
      sourceId: parsed.sourceId,
      processedAt: new Date(),
      jobCount: jobs.length,
    });

    return {
      status: 'ingested',
      externalMessageId,
      sourceId: parsed.sourceId,
      alertName: parsed.alertName,
      jobs,
    };
  }
}

function toNormalizedJobs(
  sourceId: NormalizedJob['sourceId'],
  jobs: readonly SourceJobRaw[],
): NormalizedJob[] {
  const normalized: NormalizedJob[] = [];

  for (const raw of jobs) {
    const job = normalizeSourceJob(sourceId, raw);
    if (job) {
      normalized.push(job);
    }
  }

  return normalized;
}
