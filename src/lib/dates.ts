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

/**
 * Normalize OCR dates to YYYY-MM-DD.
 * Accepts ISO, DD/MM/YYYY (AU), and clamps future dates to today.
 */
export function normalizeReceiptDate(raw: string, fallback = todayIsoDate()): string {
  const s = (raw || '').trim();
  if (!s) return fallback;

  let iso = '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    iso = s.slice(0, 10);
  } else {
    const au = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (au) {
      const day = au[1].padStart(2, '0');
      const month = au[2].padStart(2, '0');
      let year = au[3];
      if (year.length === 2) year = `20${year}`;
      iso = `${year}-${month}-${day}`;
    } else {
      // "26 Jul 2026" / "Jul 26, 2026"
      const parsed = Date.parse(s);
      if (!Number.isNaN(parsed)) {
        iso = format(new Date(parsed), 'yyyy-MM-dd');
      }
    }
  }

  if (!iso || Number.isNaN(Date.parse(`${iso}T12:00:00`))) return fallback;
  // OCR often invents a future year/day — keep purchases on/before today
  if (iso > fallback) return fallback;
  return iso;
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
