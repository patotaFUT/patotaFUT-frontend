import { eventContent } from './events.content';
import type { EventInput } from './events.contracts';
import { eventToday, isCalendarDate, isClockTime } from './events.calendar';
export type EventFieldErrors = Partial<Record<keyof EventInput, string>>;
export function validateEvent(
  input: EventInput,
  originalDate?: string,
  now: Date = new Date(),
): EventFieldErrors {
  const errors: EventFieldErrors = {};
  if (input.name.trim() === '' || input.name.length > 200)
    errors.name = eventContent.invalidName;
  if (!isCalendarDate(input.date)) errors.date = eventContent.invalidDate;
  else if (input.date !== originalDate && input.date < eventToday(now))
    errors.date = eventContent.pastDate;
  if (!isClockTime(input.startTime))
    errors.startTime = eventContent.invalidTime;
  if (!isClockTime(input.endTime)) errors.endTime = eventContent.invalidTime;
  else if (isClockTime(input.startTime) && input.endTime <= input.startTime)
    errors.endTime = eventContent.invalidEnd;
  return errors;
}
export function formationError(
  size: number,
  count: number,
): string | undefined {
  return Number.isSafeInteger(size) && size > 0 && Math.floor(count / size) >= 2
    ? undefined
    : eventContent.minimum;
}
