import type {
  AppNotification,
  AppUser,
  Category,
  FixedItem,
  ProductStat,
  Receipt,
  ReceiptItem,
  SavingsGoal,
  SavingsSim,
  Transaction,
} from '@/types/models';

export const SHEET_NAMES = [
  'users',
  'categories',
  'fixed_items',
  'transactions',
  'receipts',
  'receipt_items',
  'savings_goals',
  'savings_sims',
  'notifications',
  'product_stats',
  'settings',
] as const;

export type SheetName = (typeof SHEET_NAMES)[number];

export const SHEET_HEADERS: Record<SheetName, string[]> = {
  users: ['id', 'name', 'email', 'avatar_url', 'role', 'updated_at'],
  categories: ['id', 'name', 'type', 'icon', 'color', 'is_system', 'updated_at'],
  fixed_items: [
    'id',
    'user_id',
    'category_id',
    'name',
    'amount_aud',
    'period',
    'direction',
    'auto_debit',
    'notify_days_before',
    'active',
    'next_due',
    'updated_at',
  ],
  transactions: [
    'id',
    'user_id',
    'type',
    'category_id',
    'amount_aud',
    'date',
    'note',
    'merchant',
    'receipt_id',
    'created_at',
    'updated_at',
  ],
  receipts: [
    'id',
    'user_id',
    'store',
    'total_aud',
    'photo_uri_or_drive_id',
    'purchased_at',
    'raw_gemini_json',
    'updated_at',
  ],
  receipt_items: [
    'id',
    'receipt_id',
    'name',
    'qty',
    'unit_price_aud',
    'line_total_aud',
    'category_guess',
    'updated_at',
  ],
  savings_goals: ['id', 'name', 'target_aud', 'current_aud', 'deadline', 'user_id', 'updated_at'],
  savings_sims: ['id', 'goal_id', 'weekly_amount', 'result_weeks', 'created_at', 'updated_at'],
  notifications: [
    'id',
    'user_id',
    'title',
    'body',
    'due_at',
    'related_fixed_id',
    'status',
    'updated_at',
  ],
  product_stats: [
    'id',
    'product_name_normalized',
    'avg_price',
    'buy_frequency_days',
    'last_seen',
    'purchase_count',
    'updated_at',
  ],
  settings: ['key', 'value'],
};

async function sheetsFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function createAppSpreadsheet(accessToken: string, title = 'AppCash'): Promise<string> {
  const data = await sheetsFetch(accessToken, '', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: SHEET_NAMES.map((titleName) => ({ properties: { title: titleName } })),
    }),
  });
  const spreadsheetId = data.spreadsheetId as string;
  await ensureHeaders(accessToken, spreadsheetId);
  return spreadsheetId;
}

export async function ensureHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  const data = [];
  for (const name of SHEET_NAMES) {
    data.push({
      range: `${name}!A1`,
      values: [SHEET_HEADERS[name]],
    });
  }
  await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data,
    }),
  });
}

export async function readSheet(
  accessToken: string,
  spreadsheetId: string,
  sheet: SheetName
): Promise<string[][]> {
  const data = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A:Z`
  );
  return (data.values as string[][]) ?? [];
}

export async function clearAndWriteSheet(
  accessToken: string,
  spreadsheetId: string,
  sheet: SheetName,
  rows: string[][]
): Promise<void> {
  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A:Z:clear`,
    { method: 'POST', body: '{}' }
  );
  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [SHEET_HEADERS[sheet], ...rows] }),
    }
  );
}

function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? '';
  });
  return obj;
}

function asBool(v: string): boolean {
  return v === '1' || v.toLowerCase() === 'true';
}

function asNum(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseSheetRows(sheet: SheetName, values: string[][]): unknown[] {
  if (!values.length) return [];
  const [header, ...rows] = values;
  return rows
    .filter((r) => r.some((c) => String(c).trim().length))
    .map((row) => {
      const o = rowToObject(header, row);
      switch (sheet) {
        case 'users':
          return {
            id: o.id,
            name: o.name,
            email: o.email,
            avatar_url: o.avatar_url,
            role: o.role,
            updated_at: o.updated_at,
          } satisfies AppUser;
        case 'categories':
          return {
            id: o.id,
            name: o.name,
            type: asCategoryType(o.type),
            icon: o.icon,
            color: o.color,
            is_system: asBool(o.is_system),
            updated_at: o.updated_at,
          } satisfies Category;
        case 'fixed_items':
          return {
            id: o.id,
            user_id: o.user_id,
            category_id: o.category_id,
            name: o.name,
            amount_aud: asNum(o.amount_aud),
            period: asPeriod(o.period),
            direction: asDirection(o.direction),
            auto_debit: asBool(o.auto_debit),
            notify_days_before: asNum(o.notify_days_before),
            active: asBool(o.active),
            next_due: o.next_due,
            updated_at: o.updated_at,
          } satisfies FixedItem;
        case 'transactions':
          return {
            id: o.id,
            user_id: o.user_id,
            type: asTxType(o.type),
            category_id: o.category_id,
            amount_aud: asNum(o.amount_aud),
            date: o.date,
            note: o.note,
            merchant: o.merchant,
            receipt_id: o.receipt_id,
            created_at: o.created_at,
            updated_at: o.updated_at,
          } satisfies Transaction;
        case 'receipts':
          return {
            id: o.id,
            user_id: o.user_id,
            store: o.store,
            total_aud: asNum(o.total_aud),
            photo_uri_or_drive_id: o.photo_uri_or_drive_id,
            purchased_at: o.purchased_at,
            raw_gemini_json: o.raw_gemini_json,
            updated_at: o.updated_at,
          } satisfies Receipt;
        case 'receipt_items':
          return {
            id: o.id,
            receipt_id: o.receipt_id,
            name: o.name,
            qty: asNum(o.qty),
            unit_price_aud: asNum(o.unit_price_aud),
            line_total_aud: asNum(o.line_total_aud),
            category_guess: o.category_guess,
            updated_at: o.updated_at,
          } satisfies ReceiptItem;
        case 'savings_goals':
          return {
            id: o.id,
            name: o.name,
            target_aud: asNum(o.target_aud),
            current_aud: asNum(o.current_aud),
            deadline: o.deadline,
            user_id: o.user_id,
            updated_at: o.updated_at,
          } satisfies SavingsGoal;
        case 'savings_sims':
          return {
            id: o.id,
            goal_id: o.goal_id,
            weekly_amount: asNum(o.weekly_amount),
            result_weeks: asNum(o.result_weeks),
            created_at: o.created_at,
            updated_at: o.updated_at,
          } satisfies SavingsSim;
        case 'notifications':
          return {
            id: o.id,
            user_id: o.user_id,
            title: o.title,
            body: o.body,
            due_at: o.due_at,
            related_fixed_id: o.related_fixed_id,
            status: asNotifStatus(o.status),
            updated_at: o.updated_at,
          } satisfies AppNotification;
        case 'product_stats':
          return {
            id: o.id,
            product_name_normalized: o.product_name_normalized,
            avg_price: asNum(o.avg_price),
            buy_frequency_days: asNum(o.buy_frequency_days),
            last_seen: o.last_seen,
            purchase_count: asNum(o.purchase_count),
            updated_at: o.updated_at,
          } satisfies ProductStat;
        case 'settings':
          return { key: o.key, value: o.value };
        default:
          return o;
      }
    });
}

export function serializeRows(sheet: SheetName, rows: Array<Record<string, unknown>>): string[][] {
  const headers = SHEET_HEADERS[sheet];
  return rows.map((row) =>
    headers.map((h) => {
      const v = row[h];
      if (typeof v === 'boolean') return v ? '1' : '0';
      if (v == null) return '';
      return String(v);
    })
  );
}

function asCategoryType(v: string): Category['type'] {
  if (v === 'income' || v === 'expense' || v === 'savings') return v;
  return 'expense';
}

function asPeriod(v: string): FixedItem['period'] {
  if (v === 'weekly' || v === 'fortnightly' || v === 'monthly' || v === 'yearly') return v;
  return 'monthly';
}

function asDirection(v: string): FixedItem['direction'] {
  return v === 'in' ? 'in' : 'out';
}

function asTxType(v: string): Transaction['type'] {
  const allowed: Transaction['type'][] = [
    'fixed',
    'variable',
    'income_sporadic',
    'expense_sporadic',
    'savings_contrib',
  ];
  return (allowed.includes(v as Transaction['type']) ? v : 'expense_sporadic') as Transaction['type'];
}

function asNotifStatus(v: string): AppNotification['status'] {
  if (v === 'pending' || v === 'sent' || v === 'read') return v;
  return 'pending';
}
