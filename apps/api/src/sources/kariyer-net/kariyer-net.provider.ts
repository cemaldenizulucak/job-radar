import type { SourceAdapterCapabilities } from '../job-source.adapter.js';
import type {
  KariyerNetProviderMode,
  KariyerNetProviderResult,
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
}
