import { Injectable } from '@nestjs/common';

import type { SourceId } from '../../common/domain.types.js';
import { extractEmailAddress } from '../email-address.js';
import type { JobAlertEmail, JobAlertParseResult } from '../types/job-alert.types.js';
import type { JobAlertParser } from './job-alert-parser.interface.js';

const KARIYER_SENDER_HINT = /kariyer\.net$/i;

@Injectable()
export class KariyerNetJobAlertParser implements JobAlertParser {
  readonly sourceId: SourceId = 'kariyer_net';

  canParse(email: JobAlertEmail): boolean {
    return KARIYER_SENDER_HINT.test(extractEmailAddress(email.sender));
  }

  parse(email: JobAlertEmail): JobAlertParseResult {
    if (!this.canParse(email)) {
      return {
        status: 'ignored',
        sourceId: this.sourceId,
        alertName: null,
        jobs: [],
        reason: 'Sender is not a Kariyer.net job alert.',
      };
    }

    return {
      status: 'unsupported',
      sourceId: this.sourceId,
      alertName: null,
      jobs: [],
      reason:
        'Kariyer.net job-alert parsing is not implemented until a real email sample is provided.',
    };
  }
}
