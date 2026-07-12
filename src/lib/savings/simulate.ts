import { addMonths, addWeeks, format } from 'date-fns';
import type { ContributionFrequency, SavingsYieldMode } from '@/types/models';

export type ProjectionPoint = { label: string; value: number; monthIndex: number };

export type SavingsProjection = {
  months: number;
  weeks: number;
  arriveDate: string;
  arriveLabel: string;
  points: ProjectionPoint[];
  monthlyEquivalent: number;
  remaining: number;
  reached: boolean;
};

function periodsPerYear(freq: ContributionFrequency): number {
  switch (freq) {
    case 'weekly':
      return 52;
    case 'fortnightly':
      return 26;
    case 'monthly':
    default:
      return 12;
  }
}

export function toMonthly(amount: number, freq: ContributionFrequency): number {
  return (amount * periodsPerYear(freq)) / 12;
}

/** Convert an extra monthly AUD amount into the goal's contribution frequency. */
export function extraMonthlyToFrequency(
  extraMonthly: number,
  freq: ContributionFrequency
): number {
  if (extraMonthly <= 0) return 0;
  switch (freq) {
    case 'weekly':
      return (extraMonthly * 12) / 52;
    case 'fortnightly':
      return (extraMonthly * 12) / 26;
    case 'monthly':
    default:
      return extraMonthly;
  }
}

export function formatDuration(months: number): string {
  if (!Number.isFinite(months)) return '—';
  if (months <= 0) return 'Done';
  if (months < 1) return '<1 month';
  const whole = Math.round(months);
  const y = Math.floor(whole / 12);
  const m = whole % 12;
  if (y <= 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y} yr ${m} mo`;
}

function pointLabel(months: number): string {
  if (months <= 0) return 'Hoy';
  if (months < 12) return `${months}m`;
  const y = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${y}y${rem}m` : `${y}y`;
}

function buildCurvePoints(
  balances: number[],
  target: number,
  maxPoints = 10
): ProjectionPoint[] {
  if (!balances.length) return [{ label: 'Hoy', value: 0, monthIndex: 0 }];

  const lastIdx = balances.length - 1;
  const indices = new Set<number>([0, lastIdx]);

  if (lastIdx > 1) {
    const steps = Math.min(maxPoints - 2, lastIdx - 1);
    for (let i = 1; i <= steps; i++) {
      indices.add(Math.round((i * lastIdx) / (steps + 1)));
    }
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((idx) => ({
      label: pointLabel(idx),
      value: Math.min(balances[idx], target),
      monthIndex: idx,
    }));
}

/**
 * Project savings with optional simple annual interest (monthly compounding).
 * `contribution` is the amount per `frequency` period (not always monthly).
 */
export function projectSavings(opts: {
  current: number;
  target: number;
  contribution: number;
  frequency: ContributionFrequency;
  yieldMode?: SavingsYieldMode;
  annualRate?: number;
  from?: Date;
  maxMonths?: number;
}): SavingsProjection {
  const remaining = Math.max(0, opts.target - opts.current);
  const monthly = Math.max(0, toMonthly(opts.contribution, opts.frequency));
  const rate = opts.yieldMode === 'yield' ? Math.max(0, opts.annualRate ?? 0) / 12 : 0;
  const maxMonths = opts.maxMonths ?? 600;
  const from = opts.from ?? new Date();

  if (remaining <= 0) {
    return {
      months: 0,
      weeks: 0,
      arriveDate: format(from, 'yyyy-MM-dd'),
      arriveLabel: format(from, 'dd MMM yyyy'),
      points: [
        { label: 'Hoy', value: opts.current, monthIndex: 0 },
        { label: 'Done', value: opts.target, monthIndex: 0 },
      ],
      monthlyEquivalent: monthly,
      remaining: 0,
      reached: true,
    };
  }

  if (monthly <= 0 && rate <= 0) {
    return {
      months: Infinity,
      weeks: Infinity,
      arriveDate: '',
      arriveLabel: 'Need a contribution',
      points: [{ label: 'Hoy', value: opts.current, monthIndex: 0 }],
      monthlyEquivalent: 0,
      remaining,
      reached: false,
    };
  }

  // Fast path: no interest → exact month count
  if (rate <= 0) {
    const months = Math.max(1, Math.ceil(remaining / monthly));
    const capped = Math.min(months, maxMonths);
    const balances: number[] = [opts.current];
    for (let m = 1; m <= capped; m++) {
      balances.push(Math.min(opts.current + monthly * m, opts.target));
    }
    const arrive = addMonths(from, capped);
    return {
      months: capped,
      weeks: Math.ceil(capped * (52 / 12)),
      arriveDate: format(arrive, 'yyyy-MM-dd'),
      arriveLabel: format(arrive, 'dd MMM yyyy'),
      points: buildCurvePoints(balances, opts.target),
      monthlyEquivalent: monthly,
      remaining,
      reached: months <= maxMonths,
    };
  }

  let balance = opts.current;
  const balances: number[] = [balance];
  let months = 0;

  while (balance < opts.target && months < maxMonths) {
    months += 1;
    balance = balance * (1 + rate) + monthly;
    balances.push(Math.min(balance, opts.target));
  }

  const arrive = addMonths(from, months);
  return {
    months,
    weeks: Math.ceil(months * (52 / 12)),
    arriveDate: format(arrive, 'yyyy-MM-dd'),
    arriveLabel: format(arrive, 'dd MMM yyyy'),
    points: buildCurvePoints(balances, opts.target),
    monthlyEquivalent: monthly,
    remaining,
    reached: balance >= opts.target,
  };
}

/** Required contribution per period to hit a deadline (no interest). */
export function requiredContribution(opts: {
  current: number;
  target: number;
  deadlineIso: string;
  frequency: ContributionFrequency;
  from?: Date;
}): number {
  const from = opts.from ?? new Date();
  const deadline = new Date(
    opts.deadlineIso.length === 10 ? `${opts.deadlineIso}T12:00:00` : opts.deadlineIso
  );
  const ms = deadline.getTime() - from.getTime();
  if (ms <= 0) return Math.max(0, opts.target - opts.current);

  const days = ms / (1000 * 60 * 60 * 24);
  const remaining = Math.max(0, opts.target - opts.current);
  let periods: number;
  switch (opts.frequency) {
    case 'weekly':
      periods = Math.max(1, days / 7);
      break;
    case 'fortnightly':
      periods = Math.max(1, days / 14);
      break;
    case 'monthly':
    default:
      periods = Math.max(1, days / 30.437);
      break;
  }
  return remaining / periods;
}

export function bumpContributionDate(freq: ContributionFrequency, from = new Date()): Date {
  switch (freq) {
    case 'weekly':
      return addWeeks(from, 1);
    case 'fortnightly':
      return addWeeks(from, 2);
    default:
      return addMonths(from, 1);
  }
}
