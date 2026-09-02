import type { SourceId } from '../../common/domain.types.js';
import type { JobAlertEmail, JobAlertParseResult } from '../types/job-alert.types.js';

export interface JobAlertParser {
  readonly sourceId: SourceId;
  canParse(email: JobAlertEmail): boolean;
  parse(email: JobAlertEmail): JobAlertParseResult;
}
