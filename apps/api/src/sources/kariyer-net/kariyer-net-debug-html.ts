import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isKariyerNetDevLogEnabled, logKariyerNetDev } from './kariyer-net-dev-log.js';

export const KARIYER_NET_DEBUG_HTML_RELATIVE_PATH =
  '.debug/kariyer-net-last-response.html';

export function isKariyerNetDebugHtmlEnabled(
  raw: string | undefined = process.env.KARIYER_NET_DEBUG_HTML,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (!isKariyerNetDevLogEnabled(nodeEnv)) {
    return false;
  }

  return raw?.trim().toLowerCase() === 'true';
}

export function resolveKariyerNetDebugHtmlPath(
  fromModuleUrl = import.meta.url,
): string {
  const here = dirname(fileURLToPath(fromModuleUrl));
  return join(here, '../../../', KARIYER_NET_DEBUG_HTML_RELATIVE_PATH);
}

export async function writeKariyerNetDebugHtml(
  html: string,
  filePath = resolveKariyerNetDebugHtmlPath(),
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, html, 'utf8');
  logKariyerNetDev({
    message: 'Wrote Kariyer.net debug HTML snapshot',
    path: KARIYER_NET_DEBUG_HTML_RELATIVE_PATH,
    responseLength: html.length,
  });
}
