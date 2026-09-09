import { Injectable } from '@nestjs/common';

export const TELEGRAM_LINK_CODE_LIMIT = 5;
export const TELEGRAM_LINK_CODE_WINDOW_MS = 15 * 60 * 1000;
export const TELEGRAM_WEBHOOK_LINK_LIMIT = 8;
export const TELEGRAM_WEBHOOK_LINK_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class MemoryRateLimiter {
  readonly #hits = new Map<string, number[]>();

  consume(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const recent = (this.#hits.get(key) ?? []).filter(
      (stamp) => now - stamp < windowMs,
    );
    if (recent.length >= limit) {
      this.#hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.#hits.set(key, recent);
    return true;
  }
}
