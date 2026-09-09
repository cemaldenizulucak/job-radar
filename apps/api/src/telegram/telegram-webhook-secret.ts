import { createHash, timingSafeEqual } from 'node:crypto';

export function telegramWebhookSecretsEqual(
  provided: string | undefined,
  expected: string | null,
): boolean {
  if (!expected || typeof provided !== 'string' || provided.length === 0) {
    return false;
  }

  const left = createHash('sha256').update(provided, 'utf8').digest();
  const right = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(left, right);
}
