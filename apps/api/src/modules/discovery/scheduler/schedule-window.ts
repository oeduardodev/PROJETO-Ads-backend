export interface ScheduleWindowInput {
  frequencyMinutes: number;
  lastCheckedAt: Date | null;
}

const MINUTE_MS = 60_000;

export function scheduleWindowVersion(input: ScheduleWindowInput, now: Date): number | null {
  const intervalMs = input.frequencyMinutes * MINUTE_MS;
  if (!Number.isSafeInteger(input.frequencyMinutes) || input.frequencyMinutes < 1) {
    throw new TypeError('frequencyMinutes must be a positive safe integer');
  }
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new TypeError('now must be a valid date');

  const checkedAtMs = input.lastCheckedAt?.getTime();
  if (checkedAtMs !== undefined && !Number.isFinite(checkedAtMs)) {
    throw new TypeError('lastCheckedAt must be a valid date');
  }

  if (checkedAtMs !== undefined && nowMs < checkedAtMs + intervalMs) return null;

  const windowStartMs =
    checkedAtMs === undefined
      ? Math.floor(nowMs / intervalMs) * intervalMs
      : checkedAtMs + Math.floor((nowMs - checkedAtMs) / intervalMs) * intervalMs;
  return Math.max(1, Math.floor(windowStartMs / MINUTE_MS));
}

export function sourceQueuePriority(priority: number, health: string): number {
  if (!Number.isSafeInteger(priority) || priority < 0) {
    throw new TypeError('source priority must be a nonnegative safe integer');
  }
  const maxSourcePriority = 1_000_000;
  const healthPenalty = health === 'DEGRADED' ? 1_050_000 : 0;
  return Math.min(priority, maxSourcePriority) + healthPenalty + 1;
}
