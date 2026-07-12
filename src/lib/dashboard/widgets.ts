import { getSetting, setSetting } from '@/lib/db';

export const WIDGET_PREF_KEY = 'dashboard_widgets_v1';

export type DashboardWidgetId =
  | 'period_budget'
  | 'period_expenses'
  | 'trend'
  | 'expenses_by_person'
  | 'savings_goals'
  | 'converter'
  | 'market'
  | 'daily_spend'
  | 'upcoming_buys'
  | 'upcoming_bills'
  | 'cashflow'
  | 'top_merchants'
  | 'goals_pace';

export type WidgetDef = {
  id: DashboardWidgetId;
  label: string;
  hint: string;
  defaultOn: boolean;
};

/** Fixed display / settings order. */
export const DASHBOARD_WIDGETS: WidgetDef[] = [
  {
    id: 'period_budget',
    label: 'Period Budget',
    hint: 'Fixed, variable and savings vs income',
    defaultOn: true,
  },
  {
    id: 'period_expenses',
    label: 'Period Expenses',
    hint: 'Category donut and bars',
    defaultOn: true,
  },
  {
    id: 'trend',
    label: 'Trend',
    hint: 'Income vs expenses across weeks',
    defaultOn: true,
  },
  {
    id: 'expenses_by_person',
    label: 'Expenses by Person',
    hint: 'Who spent what this period',
    defaultOn: true,
  },
  {
    id: 'savings_goals',
    label: 'Savings Goals',
    hint: 'Progress toward targets',
    defaultOn: true,
  },
  {
    id: 'cashflow',
    label: 'Cashflow Summary',
    hint: 'Fixed and sporadic in/out',
    defaultOn: true,
  },
  {
    id: 'market',
    label: 'Market',
    hint: 'Grocery week vs average',
    defaultOn: true,
  },
  {
    id: 'daily_spend',
    label: 'Daily Spend',
    hint: 'Day-by-day outflow',
    defaultOn: true,
  },
  {
    id: 'upcoming_buys',
    label: 'Upcoming Buys',
    hint: 'Likely purchases from receipts',
    defaultOn: true,
  },
  {
    id: 'upcoming_bills',
    label: 'Upcoming Bills',
    hint: 'Next fixed payments due',
    defaultOn: true,
  },
  {
    id: 'top_merchants',
    label: 'Top Merchants',
    hint: 'Where money went this period',
    defaultOn: true,
  },
  {
    id: 'goals_pace',
    label: 'Goals Pace',
    hint: 'On track vs behind',
    defaultOn: true,
  },
  {
    id: 'converter',
    label: 'Converter COP ↔ AUD',
    hint: 'Live exchange rate',
    defaultOn: true,
  },
];

export type WidgetPrefs = Record<DashboardWidgetId, boolean>;

export function defaultWidgetPrefs(): WidgetPrefs {
  const prefs = {} as WidgetPrefs;
  for (const w of DASHBOARD_WIDGETS) {
    prefs[w.id] = w.defaultOn;
  }
  return prefs;
}

export function parseWidgetPrefs(raw: string | null): WidgetPrefs {
  const base = defaultWidgetPrefs();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<DashboardWidgetId, boolean>>;
    for (const w of DASHBOARD_WIDGETS) {
      if (typeof parsed[w.id] === 'boolean') base[w.id] = parsed[w.id]!;
    }
  } catch {
    // keep defaults
  }
  return base;
}

export async function loadWidgetPrefs(): Promise<WidgetPrefs> {
  const raw = await getSetting(WIDGET_PREF_KEY);
  return parseWidgetPrefs(raw);
}

export async function saveWidgetPrefs(prefs: WidgetPrefs): Promise<void> {
  await setSetting(WIDGET_PREF_KEY, JSON.stringify(prefs));
}

export async function setWidgetEnabled(id: DashboardWidgetId, enabled: boolean): Promise<WidgetPrefs> {
  const prefs = await loadWidgetPrefs();
  prefs[id] = enabled;
  await saveWidgetPrefs(prefs);
  return prefs;
}
