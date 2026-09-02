import type { SourceId } from '../../common/domain.types.js';
import type { NormalizedJob } from '../../jobs/jobs.types.js';
import type { SourceJobRaw } from '../../sources/job-source.adapter.js';

export type JobAlertEmail = {
  sender: string;
  subject: string;
  body: string;
  receivedAt: Date;
  externalMessageId: string;
};

export type JobAlertParseStatus = 'parsed' | 'unsupported' | 'ignored';

export type JobAlertParseResult = {
  status: JobAlertParseStatus;
  sourceId: SourceId;
  alertName: string | null;
  jobs: readonly SourceJobRaw[];
  reason?: string;
};

export type MailIngestionStatus =
  | 'ingested'
  | 'already_processed'
  | 'unsupported'
  | 'unrecognized_sender';

export type MailIngestionResult = {
  status: MailIngestionStatus;
  externalMessageId: string;
  sourceId: SourceId | null;
  alertName: string | null;
  jobs: readonly NormalizedJob[];
  reason?: string;
};

export type IngestedEmailRecord = {
  externalMessageId: string;
  sourceId: SourceId | null;
  processedAt: Date;
  jobCount: number;
};
