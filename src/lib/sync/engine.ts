import {
  asCategoryType,
  batchReadSheets,
  batchWriteAllSheets,
  categoryTypeLabel,
  createAppSpreadsheet,
  directionLabel,
  ensureWorkbookStructure,
  labelToTxType,
  parseAhorroRows,
  parseCategoriaRows,
  parseCompraRows,
  parseDirection,
  parseGastoFijoRows,
  parsePeriod,
  parseSpreadsheetId,
  parseUsuarioRows,
  periodLabel,
  serializeRows,
  spreadsheetEditUrl,
  transactionTypeLabel,
  type SheetName,
} from '@/lib/google/sheets';
import { loadGoogleSession, saveGoogleSession } from '@/lib/google/auth';
import {
  clearFinanceData,
  enqueueOutbox,
  getSetting,
  listCategories,
  listFixedItems,
  listNotifications,
  listOutbox,
  listProductStats,
  listReceiptItems,
  listReceipts,
  listSavingsGoals,
  listTransactions,
  listUsers,
  removeOutbox,
  bumpOutboxAttempt,
  replaceSheetRows,
  setSetting,
  upsertCategory,
  upsertFixedItem,
  upsertNotification,
  upsertProductStat,
  upsertReceipt,
  upsertReceiptItem,
  upsertSavingsGoal,
  upsertTransaction,
  upsertUser,
} from '@/lib/db';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import { ensureHouseholdDefaults } from '@/lib/db/seed';
import type {
  AppNotification,
  AppUser,
  Category,
  FixedItem,
  ProductStat,
  Receipt,
  ReceiptItem,
  SavingsGoal,
  Transaction,
} from '@/types/models';

const MIN_SYNC_GAP_MS = 70_000;
let lastSyncAtMs = 0;
let syncInFlight: Promise<{ ok: boolean; mode: 'local' | 'sheets'; message: string }> | null =
  null;

async function getAccess(): Promise<{ token: string; spreadsheetId: string } | null> {
  const session = await loadGoogleSession();
  if (!session?.accessToken || !session.spreadsheetId) return null;
  return { token: session.accessToken, spreadsheetId: session.spreadsheetId };
}

function friendlySheetsError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes('429') || message.includes('RATE_LIMIT') || message.includes('RESOURCE_EXHAUSTED')) {
    return (
      'Google Sheets rate limit hit (too many writes in 1 minute).\n\n' +
      'Your data is still saved on the phone. Wait ~1 minute, then tap Sync now.'
    );
  }
  return message;
}

export async function ensureSpreadsheet(): Promise<string | null> {
  const session = await loadGoogleSession();
  if (!session?.accessToken) return null;
  if (!session.spreadsheetId) return null;
  try {
    await ensureWorkbookStructure(session.accessToken, session.spreadsheetId);
  } catch {
    // offline
  }
  return session.spreadsheetId;
}

export async function createAndLinkSpreadsheet(): Promise<string | null> {
  const session = await loadGoogleSession();
  if (!session?.accessToken) return null;
  if (session.spreadsheetId) return session.spreadsheetId;

  const id = await createAppSpreadsheet(session.accessToken);
  await saveGoogleSession({ ...session, spreadsheetId: id });
  await setSetting('spreadsheet_id', id);
  try {
    await pushFullSnapshot();
    lastSyncAtMs = Date.now();
  } catch {
    // offline / quota
  }
  return id;
}

export async function linkSpreadsheetFromInput(raw: string): Promise<{
  ok: boolean;
  spreadsheetId?: string;
  message: string;
}> {
  const session = await loadGoogleSession();
  if (!session?.accessToken) {
    return { ok: false, message: 'Sign in with Google first.' };
  }
  const id = parseSpreadsheetId(raw);
  if (!id) {
    return {
      ok: false,
      message: 'Paste the full Google Sheets URL or the spreadsheet ID.',
    };
  }
  await ensureWorkbookStructure(session.accessToken, id);
  await saveGoogleSession({ ...session, spreadsheetId: id });
  await setSetting('spreadsheet_id', id);
  const result = await syncNow({ force: true, push: true, pull: true });
  return { ok: result.ok, spreadsheetId: id, message: result.message };
}

export async function unlinkSpreadsheetAndWipeLocal(): Promise<void> {
  const session = await loadGoogleSession();
  if (session) {
    await saveGoogleSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      email: session.email,
      name: session.name,
      photoUrl: session.photoUrl,
    });
  }
  await setSetting('spreadsheet_id', '');
  await clearFinanceData();
  await ensureHouseholdDefaults(session?.name || 'Me', session?.email || '', session?.photoUrl || '');
}

export function getSpreadsheetOpenUrl(spreadsheetId: string): string {
  return spreadsheetEditUrl(spreadsheetId);
}

async function buildSnapshots(): Promise<Array<{ sheet: SheetName; rows: string[][] }>> {
  const [users, categories, fixed, transactions, receipts, receiptItems, goals, notifs, products] =
    await Promise.all([
      listUsers(),
      listCategories(),
      listFixedItems(),
      listTransactions(),
      listReceipts(),
      listReceiptItems(),
      listSavingsGoals(),
      listNotifications(),
      listProductStats(),
    ]);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  const usuarios = users.map((u) => ({
    id: u.id,
    nombre: u.name,
    email: u.email,
    rol: u.role,
  }));

  const categorias = categories.map((c) => ({
    id: c.id,
    nombre: c.name,
    tipo: categoryTypeLabel(c.type),
    icono: c.icon,
    color: c.color,
  }));

  const gastos = fixed.map((f) => ({
    id: f.id,
    nombre: f.name,
    quien: userName(f.user_id),
    categoria: catName(f.category_id),
    monto: f.amount_aud,
    periodo: periodLabel(f.period),
    direccion: directionLabel(f.direction),
    debito_auto: f.auto_debit,
    avisar_dias: f.notify_days_before,
    activo: f.active,
    proximo_pago: f.next_due,
  }));

  const receiptById = new Map(receipts.map((r) => [r.id, r]));
  const txWithReceipt = new Set(
    transactions.filter((t) => t.receipt_id).map((t) => t.receipt_id as string)
  );

  const compras: Array<Record<string, unknown>> = [];
  for (const item of receiptItems) {
    const receipt = receiptById.get(item.receipt_id);
    if (!receipt) continue;
    const purchased = receipt.purchased_at || nowIso();
    const fecha = purchased.slice(0, 10);
    const hora = purchased.includes('T') ? purchased.slice(11, 16) : '12:00';
    const parentTx = transactions.find((t) => t.receipt_id === receipt.id);
    compras.push({
      id: item.id,
      fecha,
      hora,
      quien: userName(receipt.user_id),
      categoria: item.category_guess || (parentTx ? catName(parentTx.category_id) : ''),
      tipo: item.name,
      unidades: item.qty,
      precio_unidad: item.unit_price_aud,
      precio_total: item.line_total_aud,
    });
  }
  for (const tx of transactions) {
    if (tx.receipt_id && txWithReceipt.has(tx.receipt_id)) continue;
    const created = tx.created_at || `${tx.date}T12:00:00`;
    const hora = created.includes('T') ? created.slice(11, 16) : '12:00';
    compras.push({
      id: tx.id,
      fecha: tx.date,
      hora,
      quien: userName(tx.user_id),
      categoria: catName(tx.category_id),
      tipo: tx.merchant || tx.note || transactionTypeLabel(tx.type),
      unidades: 1,
      precio_unidad: tx.amount_aud,
      precio_total: tx.amount_aud,
    });
  }

  const ahorros = goals.map((g) => ({
    id: g.id,
    nombre: g.name,
    meta: g.target_aud,
    actual: g.current_aud,
    fecha_limite: g.deadline,
    quien: userName(g.user_id),
    categoria: g.kind,
    color: g.color,
    plan: g.plan_mode,
    aporte: g.contribution_aud,
    frecuencia: g.contribution_frequency,
    rentabilidad: g.yield_mode,
    tasa: g.annual_rate,
    recordatorio: g.reminder,
    actualizado: g.updated_at,
  }));

  const sysRecibos = receipts.map((r) => ({ ...r }));
  const sysItems = receiptItems.map((r) => ({ ...r }));
  const sysAvisos = notifs.map((n) => ({ ...n }));
  const sysMercado = products.map((p) => ({ ...p }));

  const configKeys = ['currency', 'week_starts', 'sync_interval_sec', 'active_user_id', 'gemini_model'];
  const sysConfig: Array<{ clave: string; valor: string }> = [];
  for (const key of configKeys) {
    const value = await getSetting(key);
    if (value != null) sysConfig.push({ clave: key, valor: value });
  }

  return [
    { sheet: 'Usuarios', rows: serializeRows('Usuarios', usuarios) },
    { sheet: 'Categorias', rows: serializeRows('Categorias', categorias) },
    { sheet: 'Gastos_fijos', rows: serializeRows('Gastos_fijos', gastos) },
    { sheet: 'Compras', rows: serializeRows('Compras', compras) },
    { sheet: 'Ahorros', rows: serializeRows('Ahorros', ahorros) },
    { sheet: '_sys_recibos', rows: serializeRows('_sys_recibos', sysRecibos) },
    { sheet: '_sys_items_recibo', rows: serializeRows('_sys_items_recibo', sysItems) },
    { sheet: '_sys_avisos', rows: serializeRows('_sys_avisos', sysAvisos) },
    { sheet: '_sys_mercado', rows: serializeRows('_sys_mercado', sysMercado) },
    { sheet: '_sys_config', rows: serializeRows('_sys_config', sysConfig) },
  ];
}

async function resolveUserId(quien: string, cache: AppUser[]): Promise<string> {
  const match = cache.find((u) => u.name.toLowerCase() === quien.trim().toLowerCase());
  if (match) return match.id;
  if (cache[0]) return cache[0].id;
  const id = createId();
  const user: AppUser = {
    id,
    name: quien.trim() || 'Me',
    email: '',
    avatar_url: '',
    role: 'owner',
    updated_at: nowIso(),
  };
  await upsertUser(user);
  cache.push(user);
  return id;
}

async function resolveCategoryId(
  categoria: string,
  hintType: string,
  cache: Category[]
): Promise<string> {
  const match = cache.find((c) => c.name.toLowerCase() === categoria.trim().toLowerCase());
  if (match) return match.id;
  const id = createId();
  const cat: Category = {
    id,
    name: categoria.trim() || 'Extras',
    type: asCategoryType(hintType),
    icon: 'tag',
    color: '#8B7CFF',
    is_system: false,
    updated_at: nowIso(),
  };
  await upsertCategory(cat);
  cache.push(cat);
  return id;
}

function parseSysTable<T extends { id: string }>(
  values: string[][],
  mapRow: (o: Record<string, string>) => T | null
): T[] {
  if (!values.length) return [];
  const [header, ...rows] = values;
  const out: T[] = [];
  for (const row of rows) {
    if (!row.some((c) => String(c).trim().length)) continue;
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      o[h.trim().toLowerCase()] = row[i] ?? '';
    });
    const mapped = mapRow(o);
    if (mapped?.id) out.push(mapped);
  }
  return out;
}

export async function pullFromSheets(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  const all = await batchReadSheets(access.token, access.spreadsheetId);

  // 1) Usuarios
  const usuarioRows = parseUsuarioRows(all.Usuarios ?? []);
  if (usuarioRows.length > 0) {
    const users: AppUser[] = usuarioRows.map((r) => ({
      id: r.id || createId(),
      name: r.nombre || 'User',
      email: r.email,
      avatar_url: '',
      role: r.rol || 'member',
      updated_at: nowIso(),
    }));
    await replaceSheetRows('users', users, upsertUser);
  }

  // 2) Categorías
  const catRows = parseCategoriaRows(all.Categorias ?? []);
  if (catRows.length > 0) {
    const cats: Category[] = catRows.map((r) => ({
      id: r.id || createId(),
      name: r.nombre || 'Category',
      type: asCategoryType(r.tipo),
      icon: r.icono || 'tag',
      color: r.color || '#8B7CFF',
      is_system: false,
      updated_at: nowIso(),
    }));
    await replaceSheetRows('categories', cats, upsertCategory);
  }

  let users = await listUsers();
  let categories = await listCategories();

  // 3) Gastos fijos
  const fijoRows = parseGastoFijoRows(all.Gastos_fijos ?? []);
  if (fijoRows.length > 0) {
    const items: FixedItem[] = [];
    for (const r of fijoRows) {
      items.push({
        id: r.id || createId(),
        user_id: await resolveUserId(r.quien, users),
        category_id: await resolveCategoryId(r.categoria, r.direccion, categories),
        name: r.nombre || 'Fixed',
        amount_aud: r.monto,
        period: parsePeriod(r.periodo),
        direction: parseDirection(r.direccion),
        auto_debit: r.debito_auto,
        notify_days_before: r.avisar_dias,
        active: r.activo,
        next_due: r.proximo_pago,
        updated_at: nowIso(),
      });
    }
    await replaceSheetRows('fixed_items', items, upsertFixedItem);
  }

  users = await listUsers();
  categories = await listCategories();

  // 4) Compras → transactions
  const compras = parseCompraRows(all.Compras ?? []);
  if (compras.length > 0) {
    const txs: Transaction[] = [];
    for (const row of compras) {
      const date = row.fecha || nowIso().slice(0, 10);
      const hora = (row.hora || '12:00').slice(0, 5);
      txs.push({
        id: row.id || createId(),
        user_id: await resolveUserId(row.quien, users),
        type: labelToTxType(row.tipo),
        category_id: await resolveCategoryId(row.categoria, row.tipo, categories),
        amount_aud: row.precio_total || row.precio_unidad * (row.unidades || 1),
        date,
        note: row.tipo,
        merchant: row.tipo,
        receipt_id: '',
        created_at: `${date}T${hora}:00`,
        updated_at: nowIso(),
      });
    }
    await replaceSheetRows('transactions', txs, upsertTransaction);
  }

  // 5) Ahorros
  const ahorros = parseAhorroRows(all.Ahorros ?? []);
  if (ahorros.length > 0) {
    const goals: SavingsGoal[] = [];
    for (const row of ahorros) {
      const freq =
        row.frecuencia === 'weekly' || row.frecuencia === 'semanal'
          ? 'weekly'
          : row.frecuencia === 'fortnightly' || row.frecuencia === 'quincenal'
            ? 'fortnightly'
            : 'monthly';
      const plan = row.plan === 'deadline' || row.plan === 'fecha' ? 'deadline' : 'contribution';
      const yieldMode =
        row.rentabilidad === 'yield' || row.rentabilidad === 'con' || row.rentabilidad === 'si'
          ? 'yield'
          : 'none';
      goals.push({
        id: row.id || createId(),
        name: row.nombre || 'Goal',
        target_aud: row.meta,
        current_aud: row.actual,
        deadline: row.fecha_limite,
        user_id: await resolveUserId(row.quien, users),
        updated_at: row.actualizado || nowIso(),
        kind: (row.categoria as SavingsGoal['kind']) || 'other',
        color: row.color || '#3DE7FF',
        plan_mode: plan,
        contribution_aud: row.aporte,
        contribution_frequency: freq,
        yield_mode: yieldMode,
        annual_rate: row.tasa,
        reminder: row.recordatorio,
      });
    }
    await replaceSheetRows('savings_goals', goals, upsertSavingsGoal);
  }

  // 6) System sheets
  const recibos = parseSysTable(all._sys_recibos ?? [], (o) => ({
    id: o.id,
    user_id: o.user_id,
    store: o.store,
    total_aud: Number(o.total_aud) || 0,
    photo_uri_or_drive_id: o.photo_uri_or_drive_id,
    purchased_at: o.purchased_at,
    raw_gemini_json: o.raw_gemini_json,
    updated_at: o.updated_at || nowIso(),
  })) as Receipt[];
  if (recibos.length) await replaceSheetRows('receipts', recibos, upsertReceipt);

  const items = parseSysTable(all._sys_items_recibo ?? [], (o) => ({
    id: o.id,
    receipt_id: o.receipt_id,
    name: o.name,
    qty: Number(o.qty) || 0,
    unit_price_aud: Number(o.unit_price_aud) || 0,
    line_total_aud: Number(o.line_total_aud) || 0,
    category_guess: o.category_guess,
    updated_at: o.updated_at || nowIso(),
  })) as ReceiptItem[];
  if (items.length) await replaceSheetRows('receipt_items', items, upsertReceiptItem);

  const avisos = parseSysTable(all._sys_avisos ?? [], (o) => ({
    id: o.id,
    user_id: o.user_id,
    title: o.title,
    body: o.body,
    due_at: o.due_at,
    related_fixed_id: o.related_fixed_id,
    status: (o.status === 'sent' || o.status === 'read' ? o.status : 'pending') as AppNotification['status'],
    updated_at: o.updated_at || nowIso(),
  })) as AppNotification[];
  if (avisos.length) await replaceSheetRows('notifications', avisos, upsertNotification);

  const mercado = parseSysTable(all._sys_mercado ?? [], (o) => ({
    id: o.id,
    product_name_normalized: o.product_name_normalized,
    avg_price: Number(o.avg_price) || 0,
    buy_frequency_days: Number(o.buy_frequency_days) || 0,
    last_seen: o.last_seen,
    purchase_count: Number(o.purchase_count) || 0,
    updated_at: o.updated_at || nowIso(),
  })) as ProductStat[];
  if (mercado.length) await replaceSheetRows('product_stats', mercado, upsertProductStat);

  const configVals = all._sys_config ?? [];
  if (configVals.length > 1) {
    const [header, ...rows] = configVals;
    for (const row of rows) {
      const o: Record<string, string> = {};
      header.forEach((h, i) => {
        o[h.trim().toLowerCase()] = row[i] ?? '';
      });
      const key = o.clave || o.key;
      const value = o.valor || o.value;
      if (key) await setSetting(key, value);
    }
  }

  await setSetting('last_sync_at', nowIso());
  return true;
}

export async function pushFullSnapshot(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  await ensureWorkbookStructure(access.token, access.spreadsheetId);
  const payload = await buildSnapshots();
  await batchWriteAllSheets(access.token, access.spreadsheetId, payload);
  await setSetting('last_sync_at', nowIso());
  return true;
}

/** Debounce rapid saves (e.g. receipt line items) into one Sheets write. */
const PUSH_DEBOUNCE_MS = 1_200;
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue a local change and schedule an automatic push to Google Sheets.
 */
export async function queueMutation(entity: string, payload: unknown): Promise<void> {
  await enqueueOutbox({
    id: createId(),
    sheet: entity,
    operation: 'upsert',
    payload_json: JSON.stringify(payload),
    created_at: nowIso(),
    attempts: 0,
  });
  scheduleSheetPush();
}

/** After any edit, push to Sheets soon (coalesced). */
export function scheduleSheetPush(): void {
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    void pushPendingChanges();
  }, PUSH_DEBOUNCE_MS);
}

async function pushPendingChanges(): Promise<void> {
  const access = await getAccess();
  if (!access) return;

  if (syncInFlight) {
    try {
      await syncInFlight;
    } catch {
      // previous sync failed — still try below
    }
  }

  const pending = await listOutbox();
  if (!pending.length) return;

  await syncNow({ force: true, push: true, pull: false });

  const stillPending = await listOutbox();
  if (stillPending.length) scheduleSheetPush();
}

export async function flushOutbox(): Promise<void> {
  const access = await getAccess();
  if (!access) return;
  const pending = await listOutbox();
  if (!pending.length) return;
  try {
    await pushFullSnapshot();
    for (const item of pending) {
      await removeOutbox(item.id);
    }
  } catch {
    for (const item of pending) {
      await bumpOutboxAttempt(item.id);
    }
    throw new Error('flush failed');
  }
}

export async function syncNow(opts?: {
  force?: boolean;
  push?: boolean;
  pull?: boolean;
}): Promise<{ ok: boolean; mode: 'local' | 'sheets'; message: string }> {
  const force = opts?.force ?? false;
  const wantPush = opts?.push ?? true;
  const wantPull = opts?.pull ?? true;

  if (syncInFlight) return syncInFlight;

  const run = (async () => {
    const access = await getAccess();
    if (!access) {
      return {
        ok: true,
        mode: 'local' as const,
        message: 'Local mode — paste your Sheet URL in Settings to sync.',
      };
    }

    const now = Date.now();
    if (!force && now - lastSyncAtMs < MIN_SYNC_GAP_MS) {
      const waitSec = Math.ceil((MIN_SYNC_GAP_MS - (now - lastSyncAtMs)) / 1000);
      return {
        ok: true,
        mode: 'sheets' as const,
        message: `Synced recently — next Sheets sync in ~${waitSec}s (quota protection).`,
      };
    }

    try {
      const pending = await listOutbox();
      const shouldPush = wantPush && (force || pending.length > 0);

      if (shouldPush) {
        await pushFullSnapshot();
        for (const item of pending) {
          await removeOutbox(item.id);
        }
      }

      if (wantPull) {
        await pullFromSheets();
      }

      lastSyncAtMs = Date.now();
      return {
        ok: true,
        mode: 'sheets' as const,
        message: shouldPush
          ? 'Synced editable sheets + system backup to Google Sheets.'
          : 'Refreshed from Google Sheets.',
      };
    } catch (e) {
      return { ok: false, mode: 'sheets' as const, message: friendlySheetsError(e) };
    }
  })();

  syncInFlight = run;
  try {
    return await run;
  } finally {
    syncInFlight = null;
  }
}
