import { z } from 'zod';

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.');

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: passwordSchema,
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.email('Enter a valid email address.'),
  password: passwordSchema,
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
