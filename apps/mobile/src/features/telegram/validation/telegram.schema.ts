import { z } from 'zod';

export const telegramStatusSchema = z.object({
  connected: z.boolean(),
  displayName: z.string().nullable(),
  connectedAt: z.string().nullable(),
  botUsername: z.string().nullable(),
});

export const telegramLinkCodeSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
  botUsername: z.string().nullable(),
});
