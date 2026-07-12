import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  differenceInCalendarDays,
} from 'date-fns';
import type { Period } from '@/types/models';

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIsoDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDisplayDate(iso: string): string {
  try {
    return format(parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

export function getWeekRange(anchor = new Date()): { start: Date; end: Date; label: string } {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return {
    start,
    end,
    label: `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`,
  };
}

export function shiftWeek(anchor: Date, weeks: number): Date {
  return addWeeks(anchor, weeks);
}

export function inRange(dateIso: string, start: Date, end: Date): boolean {
  const d = parseISO(dateIso.length === 10 ? `${dateIso}T12:00:00` : dateIso);
  return d >= start && d <= end;
}

export function nextDueFrom(period: Period, from = new Date()): string {
  let next: Date;
  switch (period) {
    case 'weekly':
      next = addWeeks(from, 1);
      break;
    case 'fortnightly':
      next = addWeeks(from, 2);
      break;
    case 'yearly':
      next = addYears(from, 1);
      break;
    case 'monthly':
    default:
      next = addMonths(from, 1);
      break;
  }
  return format(next, 'yyyy-MM-dd');
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(
    differenceInCalendarDays(
      parseISO(a.length === 10 ? `${a}T12:00:00` : a),
      parseISO(b.length === 10 ? `${b}T12:00:00` : b)
    )
  );
}

export function addDaysIso(isoDate: string, days: number): string {
  return format(addDays(parseISO(`${isoDate}T12:00:00`), days), 'yyyy-MM-dd');
}
