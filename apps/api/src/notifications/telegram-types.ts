import type { SourceId } from '../common/domain.types.js';
import type { MatchStatus } from '../matching/match-status.js';

export type TelegramJobFields = {
  id: string;
  sourceId: SourceId;
  title: string;
  companyName: string;
  location: string | null;
  canonicalUrl?: string | null;
};

export type TelegramJobItem = {
  jobId: string;
  userId: string;
  title: string;
  companyName: string;
  location: string | null;
  sourceId: SourceId;
  matchStatus: MatchStatus;
  searchNames: string[];
  listingUrl: string | null;
};

export type TelegramNotifyInput = {
  matches: readonly { jobId: string; savedSearchId: string; matchStatus?: MatchStatus }[];
  jobs: readonly TelegramJobFields[];
  searches: readonly { id: string; name: string; userId: string }[];
};

export type TelegramLedgerStatus = 'pending' | 'sending' | 'sent';

export type TelegramLedgerRow = {
  id: string;
  userId: string;
  jobId: string;
  status: TelegramLedgerStatus;
  payload: TelegramJobItem;
  claimedAt: string | null;
  sentAt: string | null;
};
