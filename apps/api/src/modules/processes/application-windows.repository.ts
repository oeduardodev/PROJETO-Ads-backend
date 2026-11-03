import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { validateTimezone } from '../campuses/campuses.repository.js';
import { normalizeLabel } from '../institutions/normalization.js';
import { normalizeSourceUrl } from '../sources/source-url.js';

function civilDate(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error('Date must use YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Date must be a valid calendar day');
  }
  return parsed;
}

function clockTime(value: string | undefined, date: Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!date || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/u.test(value)) {
    throw new Error('Time requires a date and HH:mm format');
  }
  return value;
}

export interface ApplicationWindowInput {
  processId: string;
  offeringId?: string;
  label?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  timezone?: string;
  instructionsUrl?: string;
}

@Injectable()
export class ApplicationWindowsRepository {
  constructor(private readonly database: PrismaService) {}

  create(input: ApplicationWindowInput) {
    const startDate = civilDate(input.startDate);
    const endDate = civilDate(input.endDate);
    const startTime = clockTime(input.startTime, startDate);
    const endTime = clockTime(input.endTime, endDate);
    if (startDate && endDate && startDate > endDate)
      throw new Error('Window end date precedes start date');
    if (
      startDate &&
      endDate &&
      startDate.getTime() === endDate.getTime() &&
      startTime &&
      endTime &&
      startTime > endTime
    ) {
      throw new Error('Window end time precedes start time');
    }
    return this.database.applicationWindow.create({
      data: {
        process: { connect: { id: input.processId } },
        offering: input.offeringId ? { connect: { id: input.offeringId } } : undefined,
        label: input.label ? normalizeLabel(input.label) : undefined,
        startDate,
        startTime,
        endDate,
        endTime,
        timezone: input.timezone ? validateTimezone(input.timezone) : undefined,
        instructionsUrl: input.instructionsUrl
          ? normalizeSourceUrl(input.instructionsUrl).url
          : undefined,
      },
    });
  }
}
