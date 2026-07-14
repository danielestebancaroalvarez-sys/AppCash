import type {
  AppNotification,
  AppUser,
  Category,
  FixedItem,
  Period,
  ProductStat,
  Receipt,
  ReceiptItem,
  SavingsGoal,
  Transaction,
} from '@/types/models';

/**
 * Human sheets (edit these freely in Google Sheets).
 * System sheets (prefixed _sys_) store app internals — leave alone unless debugging.
 */
export const HUMAN_SHEETS = [
  'Users',
  'Categories',
  'Fixed',
  'Purchases',
  'Savings',
] as const;

export const SYSTEM_SHEETS = [
  '_sys_receipts',
  '_sys_receipt_items',
  '_sys_notifications',
  '_sys_market',
  '_sys_config',
] as const;

export const SHEET_NAMES = [...HUMAN_SHEETS, ...SYSTEM_SHEETS] as const;

/**
 * Tabs created and written by sync.
 * Receipts / market / notifications stay on the phone — no `_sys_*` clutter in the workbook.
 */
export const SYNC_SHEETS = [...HUMAN_SHEETS] as const;
export type SyncSheetName = (typeof SYNC_SHEETS)[number];

/** Old Spanish tab titles — still readable on pull. */
export const LEGACY_SHEET_ALIASES: Record<SheetName, string[]> = {
  Users: ['Usuarios'],
  Categories: ['Categorias'],
  Fixed: ['Gastos_fijos'],
  Purchases: ['Compras'],
  Savings: ['Ahorros'],
  _sys_receipts: ['_sys_recibos'],
  _sys_receipt_items: ['_sys_items_recibo'],
  _sys_notifications: ['_sys_avisos'],
  _sys_market: ['_sys_mercado'],
  _sys_config: ['_sys_config'],
};

export type HumanSheetName = (typeof HUMAN_SHEETS)[number];
export type SystemSheetName = (typeof SYSTEM_SHEETS)[number];
export type SheetName = (typeof SHEET_NAMES)[number];

export const SHEET_HEADERS: Record<SheetName, string[]> = {
  Users: ['id', 'name', 'email', 'role', 'photo'],
  Categories: ['id', 'name', 'type', 'icon', 'color'],
  Fixed: [
    'id',
    'name',
    'who',
    'category',
    'amount',
    'period',
    'direction',
    'auto_debit',
    'notify_days',
    'active',
    'next_due',
  ],
  Purchases: [
    'id',
    'date',
    'time',
    'who',
    'category',
    'item',
    'qty',
    'unit_price',
    'line_total',
    'type',
  ],
  Savings: [
    'id',
    'name',
    'target',
    'current',
    'deadline',
    'who',
    'kind',
    'color',
    'icon',
    'plan',
    'contribution',
    'frequency',
    'yield_mode',
    'annual_rate',
    'reminder',
    'updated_at',
  ],
  _sys_receipts: [
    'id',
    'user_id',
    'store',
    'total_aud',
    'photo_uri_or_drive_id',
    'purchased_at',
    'raw_gemini_json',
    'updated_at',
  ],
  _sys_receipt_items: [
    'id',
    'receipt_id',
    'name',
    'qty',
    'unit_price_aud',
    'line_total_aud',
    'category_guess',
    'updated_at',
  ],
  _sys_notifications: [
    'id',
    'user_id',
    'title',
    'body',
    'due_at',
    'related_fixed_id',
    'status',
    'updated_at',
  ],
  _sys_market: [
    'id',
    'product_name_normalized',
    'avg_price',
    'buy_frequency_days',
    'last_seen',
    'purchase_count',
    'updated_at',
  ],
  _sys_config: ['key', 'value'],
};

export type PurchaseRow = {
  id: string;
  date: string;
  time: string;
  who: string;
  category: string;
  item: string;
  qty: number;
  unit_price: number;
  line_total: number;
  /** income | expense | variable — empty defaults to expense */
  type: string;
};

/** @deprecated Prefer PurchaseRow */
export type PurchaseSheetRow = {
  Fecha: string;
  Quién: string;
  Descripción: string;
  Categoría: string;
  Monto: number;
  id: string;
};

export type SavingsRow = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  who: string;
  updated_at: string;
  kind: string;
  color: string;
  icon: string;
  plan: string;
  contribution: number;
  frequency: string;
  yield_mode: string;
  annual_rate: number;
  reminder: boolean;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  photo: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
};

export type FixedRow = {
  id: string;
  name: string;
  who: string;
  category: string;
  amount: number;
  period: string;
  direction: string;
  auto_debit: boolean;
  notify_days: number;
  active: boolean;
  next_due: string;
};

/** @deprecated aliases kept for call sites mid-migration */
export type CompraRow = PurchaseRow;
export type AhorroRow = SavingsRow;
export type UsuarioRow = UserRow;
export type CategoriaRow = CategoryRow;
export type GastoFijoRow = FixedRow;

/** Accept full Sheets URL or bare spreadsheet ID. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function spreadsheetEditUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

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
      sheets: HUMAN_SHEETS.map((titleName) => ({ properties: { title: titleName } })),
    }),
  });
  const spreadsheetId = data.spreadsheetId as string;
  await ensureHeaders(accessToken, spreadsheetId);
  return spreadsheetId;
}

/** Ensure Purchases (or legacy Compras) exists — used when reading mixed workbooks. */
export async function resolvePurchaseTabName(
  accessToken: string,
  spreadsheetId: string
): Promise<'Purchases' | 'Compras'> {
  const meta = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}?fields=sheets.properties.title`
  );
  const titles = new Set(
    ((meta.sheets as Array<{ properties?: { title?: string } }>) ?? []).map(
      (s) => s.properties?.title ?? ''
    )
  );
  if (titles.has('Purchases')) return 'Purchases';
  if (titles.has('Compras')) return 'Compras';
  await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: 'Purchases' } } }],
    }),
  });
  return 'Purchases';
}

/** Hide legacy `_sys_*` tabs so only the five human ledger sheets stay visible. */
export async function hideSystemSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  const meta = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}?fields=sheets.properties(sheetId,title,hidden)`
  );
  const sheets =
    (meta.sheets as Array<{
      properties?: { sheetId?: number; title?: string; hidden?: boolean };
    }>) ?? [];
  const requests = [];
  for (const s of sheets) {
    const title = s.properties?.title ?? '';
    const sheetId = s.properties?.sheetId;
    if (sheetId == null) continue;
    const isSys =
      title.startsWith('_sys_') ||
      SYSTEM_SHEETS.includes(title as (typeof SYSTEM_SHEETS)[number]) ||
      (LEGACY_SHEET_ALIASES._sys_receipts ?? []).includes(title) ||
      (LEGACY_SHEET_ALIASES._sys_receipt_items ?? []).includes(title) ||
      (LEGACY_SHEET_ALIASES._sys_notifications ?? []).includes(title) ||
      (LEGACY_SHEET_ALIASES._sys_market ?? []).includes(title) ||
      (LEGACY_SHEET_ALIASES._sys_config ?? []).includes(title);
    if (isSys && !s.properties?.hidden) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId, hidden: true },
          fields: 'hidden',
        },
      });
    }
  }
  if (!requests.length) return;
  await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
}

export async function ensureWorkbookStructure(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  const meta = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}?fields=sheets.properties.title`
  );
  const titles = new Set(
    ((meta.sheets as Array<{ properties?: { title?: string } }>) ?? []).map(
      (s) => s.properties?.title ?? ''
    )
  );
  const requests = HUMAN_SHEETS.filter((name) => !titles.has(name)).map((title) => ({
    addSheet: { properties: { title } },
  }));
  if (requests.length) {
    await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }
  await ensureHeaders(accessToken, spreadsheetId);
  try {
    await hideSystemSheets(accessToken, spreadsheetId);
  } catch {
    // hide is best-effort — sync still works if sheets stay visible
  }
}

export async function ensureHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  const existing = await batchReadSheets(accessToken, spreadsheetId, [...HUMAN_SHEETS], false);
  const data = [];
  for (const name of HUMAN_SHEETS) {
    const values = existing[name] ?? [];
    if (!values.length) {
      data.push({ range: `${name}!A1`, values: [SHEET_HEADERS[name]] });
    }
  }
  if (!data.length) return;
  await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
}

/** @deprecated Prefer ensureWorkbookStructure */
export async function ensurePurchaseSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  await ensureWorkbookStructure(accessToken, spreadsheetId);
}

/**
 * Read English tabs. When `includeLegacy` is true, fall back to Spanish tab names
 * if the English tab is empty (migration path).
 */
export async function batchReadSheets(
  accessToken: string,
  spreadsheetId: string,
  sheets: SheetName[] = [...SHEET_NAMES],
  includeLegacy = true
): Promise<Record<SheetName, string[][]>> {
  const ranges: string[] = [];
  const rangeMeta: Array<{ sheet: SheetName; legacy: boolean }> = [];
  for (const s of sheets) {
    ranges.push(`${s}!A:Z`);
    rangeMeta.push({ sheet: s, legacy: false });
    if (includeLegacy) {
      for (const legacy of LEGACY_SHEET_ALIASES[s] ?? []) {
        if (legacy === s) continue;
        ranges.push(`${legacy}!A:Z`);
        rangeMeta.push({ sheet: s, legacy: true });
      }
    }
  }

  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  let data: { valueRanges?: Array<{ range?: string; values?: string[][] }> };
  try {
    data = await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchGet?${qs}`);
  } catch {
    // Some legacy titles may 400 the whole batch — retry English-only
    if (!includeLegacy) throw new Error('Sheets batch read failed');
    return batchReadSheets(accessToken, spreadsheetId, sheets, false);
  }

  const valueRanges = data.valueRanges ?? [];
  const out = {} as Record<SheetName, string[][]>;
  for (const s of sheets) out[s] = [];

  rangeMeta.forEach((meta, i) => {
    const values = valueRanges[i]?.values ?? [];
    const hasData = values.length > 1 || (values.length === 1 && values[0]?.some((c) => String(c).trim()));
    if (!meta.legacy) {
      out[meta.sheet] = values;
    } else if ((!out[meta.sheet] || out[meta.sheet].length <= 1) && hasData && values.length > 1) {
      out[meta.sheet] = values;
    }
  });

  return out;
}

export async function batchWriteAllSheets(
  accessToken: string,
  spreadsheetId: string,
  sheets: Array<{ sheet: SheetName; rows: string[][] }>
): Promise<void> {
  if (!sheets.length) return;

  await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    body: JSON.stringify({
      ranges: sheets.map((s) => `${s.sheet}!A:Z`),
    }),
  });

  await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: sheets.map(({ sheet, rows }) => ({
        range: `${sheet}!A1`,
        values: [SHEET_HEADERS[sheet], ...rows],
      })),
    }),
  });
}

function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[normalizeHeader(h)] = row[i] ?? '';
  });
  return obj;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function asNum(v: string): number {
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function asBool(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'si' || t === 'sí' || t === 'yes';
}

function yesNo(v: boolean): string {
  return v ? 'yes' : 'no';
}

export function periodLabel(p: Period): string {
  switch (p) {
    case 'weekly':
      return 'weekly';
    case 'fortnightly':
      return 'fortnightly';
    case 'yearly':
      return 'yearly';
    case 'monthly':
    default:
      return 'monthly';
  }
}

export function parsePeriod(v: string): Period {
  const t = v.trim().toLowerCase();
  if (t === 'semanal' || t === 'weekly') return 'weekly';
  if (t === 'quincenal' || t === 'fortnightly') return 'fortnightly';
  if (t === 'anual' || t === 'yearly') return 'yearly';
  return 'monthly';
}

export function directionLabel(d: FixedItem['direction']): string {
  return d === 'in' ? 'income' : 'expense';
}

export function parseDirection(v: string): FixedItem['direction'] {
  const t = v.trim().toLowerCase();
  if (t === 'ingreso' || t === 'in' || t === 'income') return 'in';
  return 'out';
}

function dataRows(values: string[][]): Array<Record<string, string>> {
  if (!values.length) return [];
  const [header, ...rows] = values;
  return rows
    .filter((r) => r.some((c) => String(c).trim().length))
    .map((row) => rowToObject(header, row));
}

export function parseUsuarioRows(values: string[][]): UserRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    name: o.name || o.nombre || '',
    email: o.email || '',
    role: o.role || o.rol || 'member',
    photo: o.photo || o.foto || o.avatar_url || '',
  }));
}

export function parseCategoriaRows(values: string[][]): CategoryRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    name: o.name || o.nombre || '',
    type: o.type || o.tipo || 'expense',
    icon: o.icon || o.icono || 'cube',
    color: o.color || '#8B7CFF',
  }));
}

export function parseGastoFijoRows(values: string[][]): FixedRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    name: o.name || o.nombre || '',
    who: o.who || o.quien || '',
    category: o.category || o.categoria || '',
    amount: asNum(o.amount) || asNum(o.monto) || asNum(o.amount_aud),
    period: o.period || o.periodo || 'monthly',
    direction: o.direction || o.direccion || 'expense',
    auto_debit: asBool(o.auto_debit || o.debito_auto || 'yes'),
    notify_days: asNum(o.notify_days) || asNum(o.avisar_dias) || asNum(o.notify_days_before),
    active: o.active != null && o.active !== '' ? asBool(o.active) : o.activo != null && o.activo !== '' ? asBool(o.activo) : true,
    next_due: o.next_due || o.proximo_pago || '',
  }));
}

export function parseCompraRows(values: string[][]): PurchaseRow[] {
  return dataRows(values).map((o) => {
    const item =
      o['descripción'] ||
      o.descripcion ||
      o.description ||
      o.item ||
      o.name ||
      '';
    const total =
      asNum(o.monto) ||
      asNum(o.line_total) ||
      asNum(o.precio_total) ||
      asNum(o.amount) ||
      asNum(o.unit_price) ||
      asNum(o.precio_unidad);
    const qty = asNum(o.qty) || asNum(o.unidades) || 1;
    const unit = asNum(o.unit_price) || asNum(o.precio_unidad) || (qty ? total / qty : total);
    return {
      id: o.id || '',
      date: o.date || o.fecha || '',
      time: o.time || o.hora || '12:00',
      who: o.who || o.quien || o['quién'] || '',
      category: o.category || o.categoria || o['categoría'] || '',
      item,
      qty,
      unit_price: unit,
      line_total: total || unit * qty,
      type: o.type || o.tipo || '',
    };
  });
}

export function parseAhorroRows(values: string[][]): SavingsRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    name: o.name || o.nombre || '',
    target: asNum(o.target) || asNum(o.meta) || asNum(o.target_aud),
    current: asNum(o.current) || asNum(o.actual) || asNum(o.current_aud),
    deadline: o.deadline || o.fecha_limite || '',
    who: o.who || o.quien || '',
    updated_at: o.updated_at || o.actualizado || '',
    kind: o.kind || o.categoria || o.category || 'other',
    color: o.color || '#3DE7FF',
    icon: o.icon || '',
    plan: o.plan || o.plan_mode || 'contribution',
    contribution: asNum(o.contribution) || asNum(o.aporte) || asNum(o.contribution_aud),
    frequency: o.frequency || o.frecuencia || o.contribution_frequency || 'monthly',
    yield_mode: o.yield_mode || o.rentabilidad || 'none',
    annual_rate: asNum(o.annual_rate) || asNum(o.tasa),
    reminder: asBool(o.reminder || o.recordatorio || 'no'),
  }));
}

export function serializeRows(sheet: SheetName, rows: Array<Record<string, unknown>>): string[][] {
  const headers = SHEET_HEADERS[sheet];
  return rows.map((row) =>
    headers.map((h) => {
      const v = row[h];
      if (typeof v === 'boolean') return yesNo(v);
      if (v == null) return '';
      return String(v);
    })
  );
}

export function transactionTypeLabel(type: Transaction['type']): string {
  switch (type) {
    case 'income_sporadic':
      return 'income';
    case 'expense_sporadic':
      return 'expense';
    case 'variable':
      return 'variable';
    case 'fixed':
      return 'fixed';
    case 'savings_contrib':
      return 'savings';
    default:
      return type;
  }
}

export function labelToTxType(tipo: string): Transaction['type'] {
  const t = tipo.trim().toLowerCase();
  if (t === 'ingreso' || t === 'income' || t === 'income_sporadic') return 'income_sporadic';
  if (t === 'fijo' || t === 'fixed') return 'fixed';
  if (t === 'variable') return 'variable';
  if (t === 'ahorro' || t === 'savings' || t === 'savings_contrib') return 'savings_contrib';
  return 'expense_sporadic';
}

export function asCategoryType(v: string): Category['type'] {
  const t = v.trim().toLowerCase();
  if (t === 'income' || t === 'ingreso') return 'income';
  if (t === 'savings' || t === 'ahorro') return 'savings';
  return 'expense';
}

export function categoryTypeLabel(t: Category['type']): string {
  switch (t) {
    case 'income':
      return 'income';
    case 'savings':
      return 'savings';
    default:
      return 'expense';
  }
}

export type {
  AppNotification,
  AppUser,
  Category,
  FixedItem,
  ProductStat,
  Receipt,
  ReceiptItem,
  SavingsGoal,
  Transaction,
};
