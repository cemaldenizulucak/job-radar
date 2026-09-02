import { Inject, Injectable } from '@nestjs/common';

import type { SourceId } from '../common/domain.types.js';
import type { JobSourceAdapter } from './job-source.adapter.js';
import { JOB_SOURCE_ADAPTERS } from './source.tokens.js';

@Injectable()
export class SourceRegistry {
  private readonly adaptersById: ReadonlyMap<SourceId, JobSourceAdapter>;

  constructor(
    @Inject(JOB_SOURCE_ADAPTERS)
    adapters: JobSourceAdapter[],
  ) {
    this.adaptersById = new Map(
      adapters.map((adapter) => [adapter.sourceId, adapter]),
    );
  }

  get(sourceId: SourceId): JobSourceAdapter | undefined {
    return this.adaptersById.get(sourceId);
  }

  list(): JobSourceAdapter[] {
    return [...this.adaptersById.values()];
  }

  listEnabled(): JobSourceAdapter[] {
    return this.list().filter((adapter) => adapter.isEnabled());
  }
}
