import { Injectable } from '@nestjs/common';

import type { SourceId, WorkModel } from '../../common/domain.types.js';
import type { SourceJobRaw } from '../../sources/job-source.adapter.js';
import { extractEmailAddress } from '../email-address.js';
import type { JobAlertEmail, JobAlertParseResult } from '../types/job-alert.types.js';
import type { JobAlertParser } from './job-alert-parser.interface.js';
import {
  LINKEDIN_JOB_ALERT_SENDER,
  canonicalLinkedInJobUrl,
  collapseWhitespace,
  extractLinkedInJobId,
  stripHtml,
} from './linkedin-job-url.js';

const SKIP_TITLE_PATTERN =
  /^(view(?:\s+job)?|see(?:\s+more|\s+all)?|apply(?:\s+now)?|open(?:\s+job)?|linkedin)$/i;

const SKIP_DETAIL_PATTERN =
  /^(easy apply|actively recruiting|promoted|view job|see more|be an easy applicant|be an early applicant|\d+\+?\s+(hour|day|week|month)s?\s+ago)$/i;

const SKIP_HEADER_PATTERN = /your job alert for|^\d+\s+new jobs?\b/i;

const ANCHOR_PATTERN =
  /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

const PLAIN_JOB_URL_PATTERN =
  /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/(?:[a-z]{2}\/)?(?:comm\/)?jobs\/view\/\d+[^\s<)"]*/gi;

@Injectable()
export class LinkedInJobAlertParser implements JobAlertParser {
  readonly sourceId: SourceId = 'linkedin';

  canParse(email: JobAlertEmail): boolean {
    return extractEmailAddress(email.sender) === LINKEDIN_JOB_ALERT_SENDER;
  }

  parse(email: JobAlertEmail): JobAlertParseResult {
    if (!this.canParse(email)) {
      return {
        status: 'ignored',
        sourceId: this.sourceId,
        alertName: null,
        jobs: [],
        reason: 'Sender is not a LinkedIn job alert.',
      };
    }

    const jobs = extractLinkedInJobs(email.body);
    return {
      status: 'parsed',
      sourceId: this.sourceId,
      alertName: extractAlertName(email.subject, email.body),
      jobs,
    };
  }
}

function extractLinkedInJobs(body: string): SourceJobRaw[] {
  const fromHtml = extractJobsFromHtmlAnchors(body);
  if (fromHtml.length > 0) {
    return fromHtml;
  }

  return extractJobsFromPlainText(body);
}

function extractJobsFromHtmlAnchors(body: string): SourceJobRaw[] {
  const jobs: SourceJobRaw[] = [];
  const seenIds = new Set<string>();
  const anchorRegex = new RegExp(ANCHOR_PATTERN.source, 'gi');

  for (const match of body.matchAll(anchorRegex)) {
    const href = match[1];
    const innerHtml = match[2];
    if (!href || innerHtml === undefined) {
      continue;
    }

    const sourceJobId = extractLinkedInJobId(href);
    if (!sourceJobId || seenIds.has(sourceJobId)) {
      continue;
    }

    const title = collapseWhitespace(stripHtml(innerHtml));
    if (!isLikelyJobTitle(title)) {
      continue;
    }

    const matchIndex = match.index ?? 0;
    const following = body.slice(
      matchIndex + match[0].length,
      nextLinkedInJobIndex(body, matchIndex + match[0].length),
    );
    const details = parseCompanyAndLocation(stripHtml(following));
    if (!details.companyName) {
      continue;
    }

    seenIds.add(sourceJobId);
    jobs.push(
      toSourceJob({
        sourceJobId,
        title,
        companyName: details.companyName,
        location: details.location,
        workModel: details.workModel,
      }),
    );
  }

  return jobs;
}

function extractJobsFromPlainText(body: string): SourceJobRaw[] {
  const text = stripHtml(body);
  const jobs: SourceJobRaw[] = [];
  const seenIds = new Set<string>();
  const urlRegex = new RegExp(PLAIN_JOB_URL_PATTERN.source, 'gi');
  let previousEnd = 0;

  for (const match of text.matchAll(urlRegex)) {
    const url = match[0];
    const sourceJobId = extractLinkedInJobId(url);
    const matchIndex = match.index ?? 0;
    if (!sourceJobId || seenIds.has(sourceJobId)) {
      previousEnd = matchIndex + url.length;
      continue;
    }

    const preceding = text.slice(previousEnd, matchIndex);
    const details = parsePlainTextJobBlock(preceding);
    previousEnd = matchIndex + url.length;

    if (!details || !isLikelyJobTitle(details.title)) {
      continue;
    }

    seenIds.add(sourceJobId);
    jobs.push(
      toSourceJob({
        sourceJobId,
        title: details.title,
        companyName: details.companyName,
        location: details.location,
        workModel: details.workModel,
      }),
    );
  }

  return jobs;
}

function nextLinkedInJobIndex(body: string, fromIndex: number): number {
  const remaining = body.slice(fromIndex);
  const urlRegex = new RegExp(PLAIN_JOB_URL_PATTERN.source, 'i');
  const match = remaining.match(urlRegex);
  if (!match || match.index === undefined) {
    return body.length;
  }

  return fromIndex + match.index;
}

function parsePlainTextJobBlock(block: string): {
  title: string;
  companyName: string;
  location: string | undefined;
  workModel: WorkModel | undefined;
} | null {
  const lines = meaningfulLines(block);
  if (lines.length < 2) {
    return null;
  }

  const last = lines[lines.length - 1];
  const companyOrCombined = lines[lines.length - 2];
  const maybeTitle = lines.length >= 3 ? lines[lines.length - 3] : undefined;
  if (!last || !companyOrCombined) {
    return null;
  }

  if (maybeTitle && isLocationLine(last)) {
    const workModel = detectWorkModel(last);
    return {
      title: maybeTitle,
      companyName: companyOrCombined,
      location: cleanLocation(last, workModel),
      workModel,
    };
  }

  const combined = parseCompanyAndLocation(last);
  if (!combined.companyName) {
    return null;
  }

  return {
    title: companyOrCombined,
    companyName: combined.companyName,
    location: combined.location,
    workModel: combined.workModel,
  };
}

function isLocationLine(line: string): boolean {
  return Boolean(detectWorkModel(line)) || /,\s*\S+/.test(line);
}

function parseCompanyAndLocation(text: string): {
  companyName: string | null;
  location: string | undefined;
  workModel: WorkModel | undefined;
} {
  const lines = meaningfulLines(text);
  if (lines.length === 0) {
    return { companyName: null, location: undefined, workModel: undefined };
  }

  const first = lines[0];
  if (!first) {
    return { companyName: null, location: undefined, workModel: undefined };
  }

  if (/[·•]/.test(first)) {
    const [companyPart, ...rest] = first.split(/[·•]/);
    const remainder = rest.join(' ').trim();
    const workModel = detectWorkModel(`${remainder}\n${lines.slice(1).join('\n')}`);
    return {
      companyName: collapseWhitespace(companyPart ?? ''),
      location: cleanLocation(remainder, workModel),
      workModel,
    };
  }

  const second = lines[1];
  const workModel = detectWorkModel(lines.join('\n'));
  if (second) {
    return {
      companyName: first,
      location: cleanLocation(second, workModel),
      workModel,
    };
  }

  const onlyWorkModel = detectWorkModel(first);
  if (onlyWorkModel && !hasCompanySignal(first)) {
    return { companyName: null, location: cleanLocation(first, onlyWorkModel), workModel: onlyWorkModel };
  }

  return {
    companyName: first,
    location: undefined,
    workModel,
  };
}

function hasCompanySignal(line: string): boolean {
  return !/^(hybrid|remote|on[\s-]?site)$/i.test(line);
}

function meaningfulLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => collapseWhitespace(line))
    .filter(
      (line) =>
        line.length > 0 &&
        !SKIP_DETAIL_PATTERN.test(line) &&
        !SKIP_HEADER_PATTERN.test(line),
    );
}

function detectWorkModel(text: string): WorkModel | undefined {
  const normalized = text.toLowerCase();
  if (/\bhybrid\b/.test(normalized)) {
    return 'hybrid';
  }

  if (/\bremote\b/.test(normalized)) {
    return 'remote';
  }

  if (/\bon[\s-]?site\b/.test(normalized)) {
    return 'onsite';
  }

  return undefined;
}

function cleanLocation(
  location: string,
  workModel: WorkModel | undefined,
): string | undefined {
  const cleaned = collapseWhitespace(
    location
      .replace(/\((?:hybrid|remote|on[\s-]?site)\)/gi, ' ')
      .replace(/\b(?:hybrid|remote|on[\s-]?site)\b/gi, ' '),
  );

  if (cleaned.length > 0) {
    return cleaned;
  }

  return workModel === 'remote' ? 'Remote' : undefined;
}

function isLikelyJobTitle(title: string): boolean {
  return title.length >= 3 && !SKIP_TITLE_PATTERN.test(title);
}

function extractAlertName(subject: string, body: string): string | null {
  const subjectMatch =
    subject.match(/job alert for\s+['"]?(.+?)['"]?\s*$/i) ??
    subject.match(/new jobs? for\s+['"](.+?)['"]/i);
  const fromSubject = collapseWhitespace(subjectMatch?.[1] ?? '');
  if (fromSubject) {
    return fromSubject;
  }

  const bodyMatch = stripHtml(body).match(/your job alert for\s+(.+)/i);
  const fromBody = collapseWhitespace(bodyMatch?.[1] ?? '');
  return fromBody.length > 0 ? fromBody.split('\n')[0] ?? fromBody : null;
}

function toSourceJob(input: {
  sourceJobId: string;
  title: string;
  companyName: string;
  location: string | undefined;
  workModel: WorkModel | undefined;
}): SourceJobRaw {
  return {
    sourceJobId: input.sourceJobId,
    canonicalUrl: canonicalLinkedInJobUrl(input.sourceJobId),
    title: input.title,
    companyName: input.companyName,
    location: input.location,
    workModel: input.workModel,
  };
}
