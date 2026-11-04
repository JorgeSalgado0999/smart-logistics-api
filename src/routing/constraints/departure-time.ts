/** 24-hour "HH:MM", e.g. "08:00" or "17:30". */
export const DEPARTURE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight, 0 to 1439. */
export type MinuteOfDay = number;

/**
 * Parses a 24-hour "HH:MM" departure time into minutes since midnight.
 * Throws RangeError for anything else, including "7:00" and "24:00".
 */
export function parseDepartureTime(value: string): MinuteOfDay {
  const match = DEPARTURE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(
      `Departure time must be 24-hour HH:MM (got "${value}")`,
    );
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

interface TimeWindow {
  /** Inclusive. */
  readonly start: MinuteOfDay;
  /** Exclusive. */
  readonly end: MinuteOfDay;
}

/** Peak traffic: 07:00-09:00 and 17:00-19:00, start included, end excluded. */
export const PEAK_WINDOWS: readonly TimeWindow[] = [
  { start: 7 * 60, end: 9 * 60 },
  { start: 17 * 60, end: 19 * 60 },
];

export function isPeakHour(minute: MinuteOfDay): boolean {
  return PEAK_WINDOWS.some(({ start, end }) => minute >= start && minute < end);
}
