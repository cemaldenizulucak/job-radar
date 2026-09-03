import { z } from 'zod';

import { authCopy } from '../copy';

const passwordSchema = z.string().min(8, authCopy.passwordMin);

export const loginSchema = z.object({
  email: z.email(authCopy.emailInvalid),
  password: passwordSchema,
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, authCopy.nameRequired),
  email: z.email(authCopy.emailInvalid),
  password: passwordSchema,
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
