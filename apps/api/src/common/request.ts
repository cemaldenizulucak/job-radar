import { BadRequestException } from '@nestjs/common';

export function requireUserId(userId: string | undefined): string {
  const trimmed = userId?.trim();
  if (!trimmed) {
    throw new BadRequestException('userId is required.');
  }

  return trimmed;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRequiredString(body: unknown, field: string): string {
  if (!isRecord(body) || typeof body[field] !== 'string') {
    throw new BadRequestException(`${field} is required.`);
  }

  const trimmed = body[field].trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(`${field} is required.`);
  }

  return trimmed;
}
