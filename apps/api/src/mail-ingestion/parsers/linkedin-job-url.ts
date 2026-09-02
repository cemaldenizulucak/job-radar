export const LINKEDIN_JOB_ALERT_SENDER = 'jobalerts-noreply@linkedin.com';

const LINKEDIN_JOB_VIEW_ID =
  /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/(?:[a-z]{2}\/)?(?:comm\/)?jobs\/view\/(\d+)/i;

export function extractLinkedInJobId(url: string): string | null {
  const match = decodeHtmlEntities(url).match(LINKEDIN_JOB_VIEW_ID);
  const id = match?.[1];
  return id && id.length > 0 ? id : null;
}

export function canonicalLinkedInJobUrl(sourceJobId: string): string {
  return `https://www.linkedin.com/jobs/view/${sourceJobId}`;
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

export function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
