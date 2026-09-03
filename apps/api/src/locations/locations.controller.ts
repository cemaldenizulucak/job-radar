import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { LocationsService } from './locations.service.js';
import type {
  LocationCountry,
  LocationSubdivision,
} from './locations.types.js';

@Controller('v1/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('countries')
  async listCountries(): Promise<{ items: LocationCountry[] }> {
    return { items: await this.locationsService.listCountries() };
  }

  @Get('subdivisions')
  async listSubdivisions(
    @Query('countryCode') countryCode: string | undefined,
  ): Promise<{ items: LocationSubdivision[] }> {
    const code = countryCode?.trim() ?? '';
    if (!code) {
      throw new BadRequestException('countryCode is required.');
    }

    return { items: await this.locationsService.listSubdivisions(code) };
  }
}
