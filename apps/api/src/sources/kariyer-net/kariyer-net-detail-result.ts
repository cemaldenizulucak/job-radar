import { isUsableJobDescription } from '../../jobs/listing-description.js';
import type { DetailFetchErrorCategory } from '../detail-fetch.types.js';
import {
  parseKariyerNetJobDetailHtml,
  type KariyerNetDetailParseResult,
} from './kariyer-net-html.parser.js';
import { KARIYER_NET_DEFAULT_BASE_URL } from './kariyer-net-web.config.js';

export type KariyerNetDetailClassification = {
  requestSucceeded: boolean;
  detailFetched: boolean;
  descriptionExtracted: boolean;
  errorCategory: DetailFetchErrorCategory | null;
  httpStatus: number;
  description: string | null;
  publishedAt: string | null;
};

export function classifyKariyerNetDetailResponse(input: {
  httpStatus: number;
  html: string;
  canonicalUrl: string;
  baseUrl?: string;
}): KariyerNetDetailClassification {
  const httpStatus = input.httpStatus;
  const parsed = parseKariyerNetJobDetailHtml(
    input.html,
    input.canonicalUrl,
    input.baseUrl ?? KARIYER_NET_DEFAULT_BASE_URL,
  );

  if (!isSuccessfulHttpStatus(httpStatus)) {
    return {
      requestSucceeded: false,
      detailFetched: false,
      descriptionExtracted: false,
      errorCategory: errorCategoryForFailedStatus(httpStatus, parsed),
      httpStatus,
      description: null,
      publishedAt: null,
    };
  }

  if (parsed.kind === 'challenge') {
    return failedClassification(httpStatus, 'challenge', true);
  }

  if (parsed.kind === 'mismatch') {
    return failedClassification(httpStatus, 'mismatch', true);
  }

  if (!parsed.listingVerified) {
    return failedClassification(httpStatus, 'mismatch', true);
  }

  const description = isUsableJobDescription(parsed.description)
    ? parsed.description
    : null;
  if (!description) {
    return {
      requestSucceeded: true,
      detailFetched: false,
      descriptionExtracted: false,
      errorCategory: 'empty',
      httpStatus,
      description: null,
      publishedAt: parsed.publishedAt,
    };
  }

  return {
    requestSucceeded: true,
    detailFetched: true,
    descriptionExtracted: true,
    errorCategory: null,
    httpStatus,
    description,
    publishedAt: parsed.publishedAt,
  };
}

function failedClassification(
  httpStatus: number,
  errorCategory: DetailFetchErrorCategory,
  requestSucceeded: boolean,
): KariyerNetDetailClassification {
  return {
    requestSucceeded,
    detailFetched: false,
    descriptionExtracted: false,
    errorCategory,
    httpStatus,
    description: null,
    publishedAt: null,
  };
}

function isSuccessfulHttpStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function errorCategoryForFailedStatus(
  status: number,
  parsed: KariyerNetDetailParseResult,
): DetailFetchErrorCategory {
  if (status === 429) {
    return 'rate_limit';
  }

  if (status === 401 || status === 403) {
    return parsed.kind === 'challenge' ? 'challenge' : 'blocked';
  }

  if (status >= 500) {
    return 'unavailable';
  }

  return 'blocked';
}
