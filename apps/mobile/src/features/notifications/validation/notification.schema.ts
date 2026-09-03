import { z } from 'zod';

export const notificationDiscoveryDataSchema = z
  .object({
    discoveryRunId: z.string().min(1).optional(),
    savedSearchId: z.string().min(1).nullable().optional(),
    newJobCount: z.number().optional(),
    createdAt: z.string().optional(),
  })
  .nullable();

export const notificationItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
  data: notificationDiscoveryDataSchema.optional(),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationItemSchema),
});
