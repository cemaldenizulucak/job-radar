import { Inject, Injectable } from '@nestjs/common';

import type { JobAlertParser } from './parsers/job-alert-parser.interface.js';
import { JOB_ALERT_PARSERS } from './mail-ingestion.tokens.js';
import type { JobAlertEmail } from './types/job-alert.types.js';

@Injectable()
export class JobAlertParserRegistry {
  constructor(
    @Inject(JOB_ALERT_PARSERS)
    private readonly parsers: JobAlertParser[],
  ) {}

  findParser(email: JobAlertEmail): JobAlertParser | undefined {
    return this.parsers.find((parser) => parser.canParse(email));
  }

  list(): JobAlertParser[] {
    return [...this.parsers];
  }
}
