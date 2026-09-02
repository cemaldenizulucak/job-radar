import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { ApplicationStatus } from '../common/domain.types.js';
import { isRecord, readRequiredString } from '../common/request.js';
import {
  ApplicationsService,
  parseApplicationStatus,
} from './applications.service.js';
import type { ApplicationRecord } from './applications.types.js';

@Controller('v1/applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ): Promise<{ items: ApplicationRecord[] }> {
    return this.applicationsService
      .listForUser(user.id, parseOptionalStatus(status))
      .then((items) => ({ items }));
  }

  @Post()
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<ApplicationRecord> {
    return this.applicationsService.upsert(
      user.id,
      readRequiredString(body, 'jobId'),
      parseStatusFromBody(body),
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ApplicationRecord> {
    return this.applicationsService.updateStatus(
      id,
      user.id,
      parseStatusFromBody(body),
    );
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.applicationsService.remove(id, user.id);
    return { ok: true };
  }
}

function parseOptionalStatus(
  status: string | undefined,
): ApplicationStatus | undefined {
  if (!status || status.trim().length === 0) {
    return undefined;
  }

  return parseApplicationStatus(status);
}

function parseStatusFromBody(body: unknown): ApplicationStatus {
  if (!isRecord(body)) {
    return parseApplicationStatus(undefined);
  }

  return parseApplicationStatus(body.status);
}
