import { Temporal } from '@js-temporal/polyfill';

export interface CompleteWindowCandidate {
  startDate: Date | null;
  startTime: string | null;
  endDate: Date | null;
  endTime: string | null;
  timezone: string | null;
}

export type DeadlineStatus = 'OPEN' | 'CLOSED' | 'UPCOMING' | 'UNKNOWN';
export type PublicApplicationStatus = 'ABERTA' | 'ENCERRADA' | 'PREVISTA' | 'INDETERMINADA';

const PUBLIC_STATUS: Record<DeadlineStatus, PublicApplicationStatus> = {
  OPEN: 'ABERTA',
  CLOSED: 'ENCERRADA',
  UPCOMING: 'PREVISTA',
  UNKNOWN: 'INDETERMINADA',
};

export function publicApplicationStatus(status: DeadlineStatus): PublicApplicationStatus {
  return PUBLIC_STATUS[status];
}

function instant(date: Date | null, time: string | null, timezone: string | null): number | null {
  if (!date || !time || !timezone) return null;
  try {
    const civilDate = date.toISOString().slice(0, 10);
    return Temporal.PlainDateTime.from(`${civilDate}T${time}`)
      .toZonedDateTime(timezone, { disambiguation: 'reject' })
      .toInstant().epochMilliseconds;
  } catch {
    return null;
  }
}

export function completeWindowInterval(
  window: CompleteWindowCandidate,
): { start: number; end: number } | null {
  const start = instant(window.startDate, window.startTime, window.timezone);
  const end = instant(window.endDate, window.endTime, window.timezone);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

export function isWindowOpen(window: CompleteWindowCandidate, nowMs: number): boolean {
  return windowStatus(window, nowMs) === 'OPEN';
}

export function windowStatus(window: CompleteWindowCandidate, nowMs: number): DeadlineStatus {
  const interval = completeWindowInterval(window);
  if (!interval || !Number.isFinite(nowMs)) return 'UNKNOWN';
  if (nowMs < interval.start) return 'UPCOMING';
  if (nowMs >= interval.end) return 'CLOSED';
  return 'OPEN';
}

export function processStatus(windows: CompleteWindowCandidate[], nowMs: number): DeadlineStatus {
  const statuses = windows.map((window) => windowStatus(window, nowMs));
  if (statuses.includes('OPEN')) return 'OPEN';
  if (statuses.includes('UNKNOWN')) return 'UNKNOWN';
  if (statuses.includes('UPCOMING')) return 'UPCOMING';
  return statuses.length ? 'CLOSED' : 'UNKNOWN';
}

export function nextConfirmedDeadline(
  windows: CompleteWindowCandidate[],
  nowMs: number,
): number | null {
  const upcoming = windows
    .map(completeWindowInterval)
    .filter(
      (interval): interval is { start: number; end: number } =>
        interval !== null && interval.end > nowMs,
    )
    .map((interval) => interval.end);
  return upcoming.length ? Math.min(...upcoming) : null;
}
