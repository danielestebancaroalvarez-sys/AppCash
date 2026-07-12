import { useMemo } from 'react';
import { addWeeks, eachDayOfInterval, format } from 'date-fns';
import { useFinanceStore, useWeekRange } from '@/stores/finance-store';
import { getWeekRange, inRange } from '@/lib/dates';
import { prorateWeekly } from '@/lib/dashboard/prorate';
import { recommendUpcoming } from '@/lib/insights/market';
import type { AppUser, Category, FixedItem, SavingsGoal, Transaction } from '@/types/models';
import { Palette } from '@/constants/theme';

export type CategorySegment = { id: string; label: string; value: number; color: string };

export type PersonSpend = {
  id: string;
  name: string;
  user: AppUser;
  spent: number;
  planned: number;
  extra: number;
  categories: Array<{ label: string; value: number; color: string }>;
};

export type TrendWeek = {
  start: Date;
  end: Date;
  label: string;
  income: number;
  expenses: number;
  balance: number;
};

export type PeriodStats = {
  start: Date;
  end: Date;
  label: string;
  incomeFixed: number;
  incomeSporadic: number;
  expenseFixed: number;
  expenseVariable: number;
  savingsContrib: number;
  incomeTotal: number;
  expenseTotal: number;
  flow: number;
  free: number;
  totalSavingsAccumulated: number;
  segments: CategorySegment[];
  dailyBars: Array<{ label: string; value: number }>;
  byUser: PersonSpend[];
  trend: TrendWeek[];
  topMerchants: Array<{ name: string; value: number }>;
  upcomingBills: FixedItem[];
  marketThisWeek: number;
  marketAverage: number;
  marketWeekBars: Array<{ label: string; value: number }>;
  marketTopCategories: Array<{ label: string; value: number; pct: number }>;
  goals: SavingsGoal[];
  upcomingBuys: ReturnType<typeof recommendUpcoming>;
};

function isIncomeTx(t: Transaction): boolean {
  return t.type === 'income_sporadic';
}

function weekIncomeExpenses(
  transactions: Transaction[],
  fixedItems: FixedItem[],
  start: Date,
  end: Date
) {
  const weekTx = transactions.filter((t) => inRange(t.date, start, end));
  const incomeSporadic = weekTx.filter(isIncomeTx).reduce((a, t) => a + t.amount_aud, 0);
  const expenseVariable = weekTx
    .filter((t) => t.type === 'expense_sporadic' || t.type === 'variable')
    .reduce((a, t) => a + t.amount_aud, 0);
  const savingsContrib = weekTx
    .filter((t) => t.type === 'savings_contrib')
    .reduce((a, t) => a + t.amount_aud, 0);
  const incomeFixed = fixedItems
    .filter((f) => f.active && f.direction === 'in')
    .reduce((a, f) => a + prorateWeekly(f.amount_aud, f.period), 0);
  const expenseFixed = fixedItems
    .filter((f) => f.active && f.direction === 'out')
    .reduce((a, f) => a + prorateWeekly(f.amount_aud, f.period), 0);
  const income = incomeFixed + incomeSporadic;
  const expenses = expenseFixed + expenseVariable + savingsContrib;
  return { income, expenses, balance: income - expenses };
}

export function usePeriodStats(): PeriodStats {
  const transactions = useFinanceStore((s) => s.transactions);
  const fixedItems = useFinanceStore((s) => s.fixedItems);
  const categories = useFinanceStore((s) => s.categories);
  const users = useFinanceStore((s) => s.users);
  const savingsGoals = useFinanceStore((s) => s.savingsGoals);
  const receipts = useFinanceStore((s) => s.receipts);
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const productStats = useFinanceStore((s) => s.productStats);
  const { start, end, label } = useWeekRange();

  return useMemo(() => {
    const weekTx = transactions.filter((t) => inRange(t.date, start, end));
    const incomeSporadic = weekTx.filter(isIncomeTx).reduce((a, t) => a + t.amount_aud, 0);
    const expenseVariable = weekTx
      .filter((t) => t.type === 'expense_sporadic' || t.type === 'variable')
      .reduce((a, t) => a + t.amount_aud, 0);
    const savingsContrib = weekTx
      .filter((t) => t.type === 'savings_contrib')
      .reduce((a, t) => a + t.amount_aud, 0);
    const incomeFixed = fixedItems
      .filter((f) => f.active && f.direction === 'in')
      .reduce((a, f) => a + prorateWeekly(f.amount_aud, f.period), 0);
    const expenseFixed = fixedItems
      .filter((f) => f.active && f.direction === 'out')
      .reduce((a, f) => a + prorateWeekly(f.amount_aud, f.period), 0);

    const incomeTotal = incomeFixed + incomeSporadic;
    const expenseTotal = expenseFixed + expenseVariable;
    const flow = incomeTotal - expenseTotal - savingsContrib;
    const free = Math.max(0, incomeTotal - expenseFixed - expenseVariable - savingsContrib);

    const byCat = new Map<string, number>();
    for (const t of weekTx.filter(
      (x) => x.type === 'expense_sporadic' || x.type === 'variable' || x.type === 'fixed'
    )) {
      byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount_aud);
    }
    const segments: CategorySegment[] = [...byCat.entries()]
      .map(([id, value]) => {
        const cat = categories.find((c) => c.id === id);
        return {
          id,
          label: cat?.name ?? 'Other',
          value,
          color: cat?.color ?? Palette.violet,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const days = eachDayOfInterval({ start, end });
    const dailyBars = days.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const value = weekTx
        .filter((t) => t.date === key && !isIncomeTx(t))
        .reduce((a, t) => a + t.amount_aud, 0);
      return { label: format(d, 'EEE').slice(0, 2), value };
    });

    const byUser: PersonSpend[] = users.map((u) => {
      const userTx = weekTx.filter((t) => t.user_id === u.id && !isIncomeTx(t) && t.type !== 'savings_contrib');
      const spent = userTx.reduce((a, t) => a + t.amount_aud, 0);
      const planned = userTx.filter((t) => t.type === 'fixed').reduce((a, t) => a + t.amount_aud, 0);
      const extra = userTx
        .filter((t) => t.type === 'expense_sporadic' || t.type === 'variable')
        .reduce((a, t) => a + t.amount_aud, 0);
      const catMap = new Map<string, number>();
      for (const t of userTx) {
        catMap.set(t.category_id, (catMap.get(t.category_id) ?? 0) + t.amount_aud);
      }
      const cats = [...catMap.entries()]
        .map(([id, value]) => {
          const cat = categories.find((c) => c.id === id);
          return { label: cat?.name ?? 'Other', value, color: cat?.color ?? Palette.violet };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);
      return {
        id: u.id,
        name: u.name,
        user: u,
        spent,
        planned,
        extra,
        categories: cats,
      };
    });

    const trend: TrendWeek[] = [];
    for (let i = 3; i >= 0; i--) {
      const anchor = addWeeks(start, -i);
      const range = getWeekRange(anchor);
      const ie = weekIncomeExpenses(transactions, fixedItems, range.start, range.end);
      trend.push({
        start: range.start,
        end: range.end,
        label: format(range.start, 'd/M'),
        ...ie,
      });
    }

    const merchantMap = new Map<string, number>();
    for (const t of weekTx.filter((x) => !isIncomeTx(x) && x.type !== 'savings_contrib')) {
      const name = (t.merchant || 'Other').trim() || 'Other';
      merchantMap.set(name, (merchantMap.get(name) ?? 0) + t.amount_aud);
    }
    const topMerchants = [...merchantMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const upcomingBills = [...fixedItems]
      .filter((f) => f.active && f.direction === 'out')
      .sort((a, b) => a.next_due.localeCompare(b.next_due))
      .slice(0, 6);

    const totalSavingsAccumulated = savingsGoals.reduce((a, g) => a + g.current_aud, 0);

    const receiptTotals = receipts.map((r) => ({
      date: r.purchased_at.slice(0, 10),
      total: r.total_aud,
      id: r.id,
    }));
    const marketThisWeek = receiptTotals
      .filter((r) => inRange(r.date, start, end))
      .reduce((a, r) => a + r.total, 0);

    const marketWeekBars: Array<{ label: string; value: number }> = [];
    for (let i = 8; i >= 0; i--) {
      const anchor = addWeeks(start, -i);
      const range = getWeekRange(anchor);
      const value = receiptTotals
        .filter((r) => inRange(r.date, range.start, range.end))
        .reduce((a, r) => a + r.total, 0);
      marketWeekBars.push({ label: format(range.start, 'd'), value });
    }
    const nonZero = marketWeekBars.filter((b) => b.value > 0);
    const marketAverage =
      nonZero.length > 0 ? nonZero.reduce((a, b) => a + b.value, 0) / nonZero.length : 0;

    const weekReceiptIds = new Set(
      receipts.filter((r) => inRange(r.purchased_at.slice(0, 10), start, end)).map((r) => r.id)
    );
    const catGuess = new Map<string, number>();
    for (const item of receiptItems.filter((i) => weekReceiptIds.has(i.receipt_id))) {
      const key = item.category_guess || 'Other';
      catGuess.set(key, (catGuess.get(key) ?? 0) + item.line_total_aud);
    }
    const marketCatTotal = [...catGuess.values()].reduce((a, b) => a + b, 0) || 1;
    const marketTopCategories = [...catGuess.entries()]
      .map(([label, value]) => ({
        label,
        value,
        pct: Math.round((value / marketCatTotal) * 100),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      start,
      end,
      label,
      incomeFixed,
      incomeSporadic,
      expenseFixed,
      expenseVariable,
      savingsContrib,
      incomeTotal,
      expenseTotal,
      flow,
      free,
      totalSavingsAccumulated,
      segments,
      dailyBars,
      byUser,
      trend,
      topMerchants,
      upcomingBills,
      marketThisWeek,
      marketAverage,
      marketWeekBars,
      marketTopCategories,
      goals: savingsGoals,
      upcomingBuys: recommendUpcoming(productStats, 14).slice(0, 5),
    };
  }, [
    transactions,
    fixedItems,
    categories,
    users,
    savingsGoals,
    receipts,
    receiptItems,
    productStats,
    start,
    end,
    label,
  ]);
}

export function categoryName(categories: Category[], id: string): string {
  return categories.find((c) => c.id === id)?.name ?? '—';
}
