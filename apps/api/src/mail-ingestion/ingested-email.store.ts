import { Injectable } from '@nestjs/common';

import type { IngestedEmailRecord } from './types/job-alert.types.js';

export interface IngestedEmailStore {
  findByExternalMessageId(
    externalMessageId: string,
  ): Promise<IngestedEmailRecord | null>;
  save(record: IngestedEmailRecord): Promise<void>;
}

@Injectable()
export class InMemoryIngestedEmailStore implements IngestedEmailStore {
  private readonly records = new Map<string, IngestedEmailRecord>();

  findByExternalMessageId(
    externalMessageId: string,
  ): Promise<IngestedEmailRecord | null> {
    return Promise.resolve(this.records.get(externalMessageId) ?? null);
  }

  save(record: IngestedEmailRecord): Promise<void> {
    this.records.set(record.externalMessageId, record);
    return Promise.resolve();
  }
}
