import { Module } from '@nestjs/common';

import { InMemoryIngestedEmailStore } from './ingested-email.store.js';
import { JobAlertParserRegistry } from './job-alert-parser.registry.js';
import {
  INGESTED_EMAIL_STORE,
  JOB_ALERT_PARSERS,
} from './mail-ingestion.tokens.js';
import { MailIngestionService } from './mail-ingestion.service.js';
import { KariyerNetJobAlertParser } from './parsers/kariyer-net-job-alert.parser.js';
import { LinkedInJobAlertParser } from './parsers/linkedin-job-alert.parser.js';

@Module({
  providers: [
    LinkedInJobAlertParser,
    KariyerNetJobAlertParser,
    {
      provide: JOB_ALERT_PARSERS,
      useFactory: (
        linkedIn: LinkedInJobAlertParser,
        kariyerNet: KariyerNetJobAlertParser,
      ) => [linkedIn, kariyerNet],
      inject: [LinkedInJobAlertParser, KariyerNetJobAlertParser],
    },
    {
      provide: INGESTED_EMAIL_STORE,
      useClass: InMemoryIngestedEmailStore,
    },
    JobAlertParserRegistry,
    MailIngestionService,
  ],
  exports: [MailIngestionService],
})
export class MailIngestionModule {}
