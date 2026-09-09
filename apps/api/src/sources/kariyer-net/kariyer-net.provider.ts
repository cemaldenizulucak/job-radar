import type { SourceAdapterCapabilities } from '../job-source.adapter.js';
import type { SourceDetailFetchOutcome } from '../detail-fetch.types.js';
import type {
  KariyerNetProviderMode,
  KariyerNetProviderResult,
  KariyerNetRawJob,
  KariyerNetSearchInput,
} from './kariyer-net.types.js';

/**
 * Kariyer.net access boundary. Discovery and matching never call Kariyer.net
 * directly. Live access uses KariyerNetWebProvider (public listing pages).
 */
export interface KariyerNetProvider {
  readonly mode: KariyerNetProviderMode;
  readonly capabilities: SourceAdapterCapabilities;
  isEnabled(): boolean;
  search(input: KariyerNetSearchInput): Promise<KariyerNetProviderResult>;
  enrichMissingDescriptions?(
    jobs: readonly KariyerNetRawJob[],
  ): Promise<{
    jobs: readonly KariyerNetRawJob[];
    detailsFetched: number;
    detailsFailed: number;
    detailsRequested?: number;
    descriptionsExtracted?: number;
    outcomes?: readonly SourceDetailFetchOutcome[];
  }>;
}
