import { z } from 'zod';

export const notificationItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationItemSchema),
});
