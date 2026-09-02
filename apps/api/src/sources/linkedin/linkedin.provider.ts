import type { SourceAdapterCapabilities } from '../job-source.adapter.js';
import type {
  LinkedInProviderMode,
  LinkedInProviderResult,
  LinkedInSearchInput,
} from './linkedin.types.js';

/**
 * LinkedIn access boundary. Discovery and matching never call LinkedIn
 * directly. Live access uses LinkedInWebProvider (public listing pages).
 */
export interface LinkedInProvider {
  readonly mode: LinkedInProviderMode;
  readonly capabilities: SourceAdapterCapabilities;
  isEnabled(): boolean;
  search(input: LinkedInSearchInput): Promise<LinkedInProviderResult>;
}
