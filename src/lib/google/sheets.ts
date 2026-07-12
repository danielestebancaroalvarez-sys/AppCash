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
  'Usuarios',
  'Categorias',
  'Gastos_fijos',
  'Compras',
  'Ahorros',
] as const;

export const SYSTEM_SHEETS = [
  '_sys_recibos',
  '_sys_items_recibo',
  '_sys_avisos',
  '_sys_mercado',
  '_sys_config',
] as const;

export const SHEET_NAMES = [...HUMAN_SHEETS, ...SYSTEM_SHEETS] as const;

export type HumanSheetName = (typeof HUMAN_SHEETS)[number];
export type SystemSheetName = (typeof SYSTEM_SHEETS)[number];
export type SheetName = (typeof SHEET_NAMES)[number];

export const SHEET_HEADERS: Record<SheetName, string[]> = {
  // ——— Editable ———
  Usuarios: ['id', 'nombre', 'email', 'rol'],
  Categorias: ['id', 'nombre', 'tipo', 'icono', 'color'],
  Gastos_fijos: [
    'id',
    'nombre',
    'quien',
    'categoria',
    'monto',
    'periodo',
    'direccion',
    'debito_auto',
    'avisar_dias',
    'activo',
    'proximo_pago',
  ],
  Compras: [
    'id',
    'fecha',
    'hora',
    'quien',
    'categoria',
    'tipo',
    'unidades',
    'precio_unidad',
    'precio_total',
  ],
  Ahorros: [
    'id',
    'nombre',
    'meta',
    'actual',
    'fecha_limite',
    'quien',
    'categoria',
    'color',
    'plan',
    'aporte',
    'frecuencia',
    'rentabilidad',
    'tasa',
    'recordatorio',
    'actualizado',
  ],

  // ——— System (do not edit by hand) ———
  _sys_recibos: [
    'id',
    'user_id',
    'store',
    'total_aud',
    'photo_uri_or_drive_id',
    'purchased_at',
    'raw_gemini_json',
    'updated_at',
  ],
  _sys_items_recibo: [
    'id',
    'receipt_id',
    'name',
    'qty',
    'unit_price_aud',
    'line_total_aud',
    'category_guess',
    'updated_at',
  ],
  _sys_avisos: [
    'id',
    'user_id',
    'title',
    'body',
    'due_at',
    'related_fixed_id',
    'status',
    'updated_at',
  ],
  _sys_mercado: [
    'id',
    'product_name_normalized',
    'avg_price',
    'buy_frequency_days',
    'last_seen',
    'purchase_count',
    'updated_at',
  ],
  _sys_config: ['clave', 'valor'],
};

export type CompraRow = {
  id: string;
  fecha: string;
  hora: string;
  quien: string;
  categoria: string;
  tipo: string;
  unidades: number;
  precio_unidad: number;
  precio_total: number;
};

export type AhorroRow = {
  id: string;
  nombre: string;
  meta: number;
  actual: number;
  fecha_limite: string;
  quien: string;
  actualizado: string;
  categoria: string;
  color: string;
  plan: string;
  aporte: number;
  frecuencia: string;
  rentabilidad: string;
  tasa: number;
  recordatorio: boolean;
};

export type UsuarioRow = { id: string; nombre: string; email: string; rol: string };
export type CategoriaRow = {
  id: string;
  nombre: string;
  tipo: string;
  icono: string;
  color: string;
};
export type GastoFijoRow = {
  id: string;
  nombre: string;
  quien: string;
  categoria: string;
  monto: number;
  periodo: string;
  direccion: string;
  debito_auto: boolean;
  avisar_dias: number;
  activo: boolean;
  proximo_pago: string;
};

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
      sheets: SHEET_NAMES.map((titleName) => ({ properties: { title: titleName } })),
    }),
  });
  const spreadsheetId = data.spreadsheetId as string;
  await ensureHeaders(accessToken, spreadsheetId);
  return spreadsheetId;
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
  const requests = SHEET_NAMES.filter((name) => !titles.has(name)).map((title) => ({
    addSheet: { properties: { title } },
  }));
  if (requests.length) {
    await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }
  await ensureHeaders(accessToken, spreadsheetId);
}

export async function ensureHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  const existing = await batchReadSheets(accessToken, spreadsheetId);
  const data = [];
  for (const name of SHEET_NAMES) {
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

export async function batchReadSheets(
  accessToken: string,
  spreadsheetId: string,
  sheets: SheetName[] = [...SHEET_NAMES]
): Promise<Record<SheetName, string[][]>> {
  const ranges = sheets.map((s) => `${s}!A:Z`);
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const data = await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchGet?${qs}`);
  const out = {} as Record<SheetName, string[][]>;
  const valueRanges = (data.valueRanges as Array<{ range?: string; values?: string[][] }>) ?? [];
  sheets.forEach((sheet, i) => {
    const match = valueRanges.find(
      (vr) => (vr.range ?? '').includes(sheet) || (vr.range ?? '').startsWith(sheet)
    );
    out[sheet] = match?.values ?? valueRanges[i]?.values ?? [];
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
  return v ? 'si' : 'no';
}

export function periodLabel(p: Period): string {
  switch (p) {
    case 'weekly':
      return 'semanal';
    case 'fortnightly':
      return 'quincenal';
    case 'yearly':
      return 'anual';
    case 'monthly':
    default:
      return 'mensual';
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
  return d === 'in' ? 'ingreso' : 'gasto';
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

export function parseUsuarioRows(values: string[][]): UsuarioRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    nombre: o.nombre || o.name || '',
    email: o.email || '',
    rol: o.rol || o.role || 'member',
  }));
}

export function parseCategoriaRows(values: string[][]): CategoriaRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    nombre: o.nombre || o.name || '',
    tipo: o.tipo || o.type || 'expense',
    icono: o.icono || o.icon || 'tag',
    color: o.color || '#8B7CFF',
  }));
}

export function parseGastoFijoRows(values: string[][]): GastoFijoRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    nombre: o.nombre || o.name || '',
    quien: o.quien || '',
    categoria: o.categoria || '',
    monto: asNum(o.monto) || asNum(o.amount_aud),
    periodo: o.periodo || o.period || 'mensual',
    direccion: o.direccion || o.direction || 'gasto',
    debito_auto: asBool(o.debito_auto || o.auto_debit || 'si'),
    avisar_dias: asNum(o.avisar_dias) || asNum(o.notify_days_before),
    activo: o.activo != null && o.activo !== '' ? asBool(o.activo) : true,
    proximo_pago: o.proximo_pago || o.next_due || '',
  }));
}

export function parseCompraRows(values: string[][]): CompraRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    fecha: o.fecha || '',
    hora: o.hora || '00:00',
    quien: o.quien || '',
    categoria: o.categoria || '',
    tipo: o.tipo || '',
    unidades: asNum(o.unidades) || 1,
    precio_unidad: asNum(o.precio_unidad),
    precio_total: asNum(o.precio_total) || asNum(o.precio_unidad),
  }));
}

export function parseAhorroRows(values: string[][]): AhorroRow[] {
  return dataRows(values).map((o) => ({
    id: o.id || '',
    nombre: o.nombre || '',
    meta: asNum(o.meta) || asNum(o.meta_aud) || asNum(o.target_aud),
    actual: asNum(o.actual) || asNum(o.actual_aud) || asNum(o.current_aud),
    fecha_limite: o.fecha_limite || o.deadline || '',
    quien: o.quien || '',
    actualizado: o.actualizado || o.updated_at || '',
    categoria: o.categoria || o.kind || 'other',
    color: o.color || '#3DE7FF',
    plan: o.plan || o.plan_mode || 'contribution',
    aporte: asNum(o.aporte) || asNum(o.contribution_aud),
    frecuencia: o.frecuencia || o.contribution_frequency || 'monthly',
    rentabilidad: o.rentabilidad || o.yield_mode || 'none',
    tasa: asNum(o.tasa) || asNum(o.annual_rate),
    recordatorio: asBool(o.recordatorio || o.reminder || 'no'),
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
      return 'ingreso';
    case 'expense_sporadic':
      return 'gasto';
    case 'variable':
      return 'variable';
    case 'fixed':
      return 'fijo';
    case 'savings_contrib':
      return 'ahorro';
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
      return 'ingreso';
    case 'savings':
      return 'ahorro';
    default:
      return 'gasto';
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
