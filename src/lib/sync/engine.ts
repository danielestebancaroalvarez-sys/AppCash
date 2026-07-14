import {
  asCategoryType,
  batchReadSheets,
  batchWriteAllSheets,
  categoryTypeLabel,
  createAppSpreadsheet,
  directionLabel,
  ensureWorkbookStructure,
  HUMAN_SHEETS,
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
import {
  isAuthExpiredError,
  loadGoogleSession,
  refreshGoogleAccessToken,
  saveGoogleSession,
} from '@/lib/google/auth';
import {
  clearFinanceData,
  enqueueOutbox,
  listCategories,
  listFixedItems,
  listOutbox,
  listSavingsGoals,
  listTransactions,
  listUsers,
  removeOutbox,
  bumpOutboxAttempt,
  bumpAllOutboxAttempts,
  resetOutboxAttempts,
  replaceSheetRows,
  setSetting,
  upsertCategory,
  upsertFixedItem,
  upsertSavingsGoal,
  upsertTransaction,
  upsertUser,
} from '@/lib/db';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import { isLikelyProductName } from '@/lib/purchases/filter';
import { CategoryPalette } from '@/constants/theme';
import { ensureHouseholdDefaults } from '@/lib/db/seed';
import type { AppUser, Category, FixedItem, SavingsGoal, Transaction } from '@/types/models';

const MIN_SYNC_GAP_MS = 70_000;
let lastSyncAtMs = 0;
let syncInFlight: Promise<{ ok: boolean; mode: 'local' | 'sheets'; message: string }> | null =
  null;

async function getAccess(): Promise<{ token: string; spreadsheetId: string } | null> {
  // Always try to refresh ??? stored access tokens expire ~1h after login.
  const session = (await refreshGoogleAccessToken()) ?? (await loadGoogleSession());
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
  if (isAuthExpiredError(message)) {
    return (
      'Google session expired for Sheet sync.\n\n' +
      'Sign in with Google again from Account to sync. ' +
      'Your sheet link and local data stay on the phone.'
    );
  }
  return message;
}

export async function ensureSpreadsheet(): Promise<string | null> {
  const session = (await refreshGoogleAccessToken()) ?? (await loadGoogleSession());
  if (!session?.accessToken) return null;
  if (!session.spreadsheetId) return null;
  try {
    await ensureWorkbookStructure(session.accessToken, session.spreadsheetId);
  } catch {
    // offline
  }
  return session.spreadsheetId;
}

export async function createAndLinkSpreadsheet(title?: string): Promise<string | null> {
  const session = (await refreshGoogleAccessToken()) ?? (await loadGoogleSession());
  if (!session?.accessToken) return null;
  if (session.spreadsheetId) return session.spreadsheetId;

  const trimmed = title?.trim() || 'AppCash';
  const id = await createAppSpreadsheet(session.accessToken, trimmed);
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
  const session = (await refreshGoogleAccessToken()) ?? (await loadGoogleSession());
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

export async function unlinkSpreadsheet(): Promise<void> {
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
}

export async function unlinkSpreadsheetAndWipeLocal(): Promise<void> {
  await unlinkSpreadsheet();
  await wipeLocalFinanceData();
}

export async function wipeLocalFinanceData(): Promise<void> {
  const session = await loadGoogleSession();
  await clearFinanceData();
  await ensureHouseholdDefaults(session?.name || 'Me', session?.email || '', session?.photoUrl || '');
  await setSetting('app_local_mode', '1');
}

export function getSpreadsheetOpenUrl(spreadsheetId: string): string {
  return spreadsheetEditUrl(spreadsheetId);
}

async function buildSnapshots(): Promise<Array<{ sheet: SheetName; rows: string[][] }>> {
  const [users, categories, fixed, transactions, goals] = await Promise.all([
    listUsers(),
    listCategories(),
    listFixedItems(),
    listTransactions(),
    listSavingsGoals(),
  ]);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  const usuarios = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    photo: u.avatar_url,
  }));

  const categorias = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: categoryTypeLabel(c.type),
    icon: c.icon,
    color: c.color,
  }));

  const gastos = fixed.map((f) => ({
    id: f.id,
    name: f.name,
    who: userName(f.user_id),
    category: catName(f.category_id),
    amount: f.amount_aud,
    period: periodLabel(f.period),
    direction: directionLabel(f.direction),
    auto_debit: f.auto_debit,
    notify_days: f.notify_days_before,
    active: f.active,
    next_due: f.next_due,
  }));

  // One row per variable purchase / income / expense ? receipts & line items stay on phone.
  const compras: Array<Record<string, unknown>> = [];
  for (const tx of transactions) {
    if (tx.type === 'fixed' || tx.type === 'savings_contrib') continue;
    const created = tx.created_at || `${tx.date}T12:00:00`;
    const time = created.includes('T') ? created.slice(11, 16) : '12:00';
    compras.push({
      id: tx.id,
      date: tx.date,
      time,
      who: userName(tx.user_id),
      category: catName(tx.category_id),
      item: tx.merchant || tx.note || transactionTypeLabel(tx.type),
      qty: 1,
      unit_price: tx.amount_aud,
      line_total: tx.amount_aud,
      type: transactionTypeLabel(tx.type),
    });
  }

  const ahorros = goals.map((g) => ({
    id: g.id,
    name: g.name,
    target: g.target_aud,
    current: g.current_aud,
    deadline: g.deadline,
    who: userName(g.user_id),
    kind: g.kind,
    color: g.color,
    icon: g.icon || '',
    plan: g.plan_mode,
    contribution: g.contribution_aud,
    frequency: g.contribution_frequency,
    yield_mode: g.yield_mode,
    annual_rate: g.annual_rate,
    reminder: g.reminder,
    updated_at: g.updated_at,
  }));

  return [
    { sheet: 'Users', rows: serializeRows('Users', usuarios) },
    { sheet: 'Categories', rows: serializeRows('Categories', categorias) },
    { sheet: 'Fixed', rows: serializeRows('Fixed', gastos) },
    { sheet: 'Purchases', rows: serializeRows('Purchases', compras) },
    { sheet: 'Savings', rows: serializeRows('Savings', ahorros) },
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
    icon: 'cube',
    color: CategoryPalette[cache.length % CategoryPalette.length],
    is_system: false,
    updated_at: nowIso(),
  };
  await upsertCategory(cat);
  cache.push(cat);
  return id;
}

export async function pullFromSheets(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  const all = await batchReadSheets(access.token, access.spreadsheetId, [...HUMAN_SHEETS]);

  // 1) Users
  const usuarioRows = parseUsuarioRows(all.Users ?? []);
  if (usuarioRows.length > 0) {
    const users: AppUser[] = usuarioRows.map((r) => ({
      id: r.id || createId(),
      name: r.name || 'User',
      email: r.email,
      avatar_url: r.photo || '',
      role: r.role || 'member',
      updated_at: nowIso(),
    }));
    await replaceSheetRows('users', users, upsertUser);
  }

  // 2) Categories
  const catRows = parseCategoriaRows(all.Categories ?? []);
  if (catRows.length > 0) {
    const cats: Category[] = catRows.map((r, i) => ({
      id: r.id || createId(),
      name: r.name || 'Category',
      type: asCategoryType(r.type),
      icon: r.icon || 'cube',
      color: r.color || CategoryPalette[i % CategoryPalette.length],
      is_system: false,
      updated_at: nowIso(),
    }));
    await replaceSheetRows('categories', cats, upsertCategory);
  }

  let users = await listUsers();
  let categories = await listCategories();

  // 3) Fixed
  const fijoRows = parseGastoFijoRows(all.Fixed ?? []);
  if (fijoRows.length > 0) {
    const items: FixedItem[] = [];
    for (const r of fijoRows) {
      items.push({
        id: r.id || createId(),
        user_id: await resolveUserId(r.who, users),
        category_id: await resolveCategoryId(r.category, r.direction, categories),
        name: r.name || 'Fixed',
        amount_aud: r.amount,
        period: parsePeriod(r.period),
        direction: parseDirection(r.direction),
        auto_debit: r.auto_debit,
        notify_days_before: r.notify_days,
        active: r.active,
        next_due: r.next_due,
        updated_at: nowIso(),
      });
    }
    await replaceSheetRows('fixed_items', items, upsertFixedItem);
  }

  users = await listUsers();
  categories = await listCategories();

  // 4) Variable purchases / incomes / expenses (receipt photos stay on phone)
  const compras = parseCompraRows(all.Purchases ?? []);
  for (const row of compras) {
    if (!row.id) continue;
    const date = row.date || nowIso().slice(0, 10);
    const time = (row.time || '12:00').slice(0, 5);
    const label = (row.item || '').trim() || 'Purchase';
    if (isLikelyProductName(label) && !row.type) continue;
    const txType = labelToTxType(row.type || 'expense');
    const hintType = txType === 'income_sporadic' ? 'income' : 'expense';
    await upsertTransaction({
      id: row.id,
      user_id: await resolveUserId(row.who, users),
      type: txType,
      category_id: await resolveCategoryId(
        row.category || (hintType === 'income' ? 'Income' : 'Groceries'),
        hintType,
        categories
      ),
      amount_aud: row.line_total || row.unit_price * (row.qty || 1),
      date,
      note: label,
      merchant: label,
      receipt_id: '',
      created_at: `${date}T${time}:00`,
      updated_at: nowIso(),
    });
  }

  // 5) Savings
  const ahorros = parseAhorroRows(all.Savings ?? []);
  if (ahorros.length > 0) {
    const goals: SavingsGoal[] = [];
    for (const row of ahorros) {
      const freq =
        row.frequency === 'weekly' || row.frequency === 'semanal'
          ? 'weekly'
          : row.frequency === 'fortnightly' || row.frequency === 'quincenal'
            ? 'fortnightly'
            : 'monthly';
      const plan = row.plan === 'deadline' || row.plan === 'fecha' ? 'deadline' : 'contribution';
      const yieldMode =
        row.yield_mode === 'yield' || row.yield_mode === 'con' || row.yield_mode === 'si'
          ? 'yield'
          : 'none';
      goals.push({
        id: row.id || createId(),
        name: row.name || 'Goal',
        target_aud: row.target,
        current_aud: row.current,
        deadline: row.deadline,
        user_id: await resolveUserId(row.who, users),
        updated_at: row.updated_at || nowIso(),
        kind: (row.kind as SavingsGoal['kind']) || 'other',
        color: row.color || '#3DE7FF',
        icon: row.icon || '',
        plan_mode: plan,
        contribution_aud: row.contribution,
        contribution_frequency: freq,
        yield_mode: yieldMode,
        annual_rate: row.annual_rate,
        reminder: row.reminder,
      });
    }
    await replaceSheetRows('savings_goals', goals, upsertSavingsGoal);
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
const MAX_AUTO_SYNC_ATTEMPTS = 8;
const BACKOFF_MS = [12_000, 30_000, 60_000, 120_000, 300_000] as const;
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function nextAutoRetryDelay(attemptsAfterBump: number): number | null {
  if (attemptsAfterBump >= MAX_AUTO_SYNC_ATTEMPTS) return null;
  return BACKOFF_MS[Math.min(attemptsAfterBump, BACKOFF_MS.length - 1)] ?? null;
}

async function maxOutboxAttempts(): Promise<number> {
  const pending = await listOutbox();
  if (!pending.length) return 0;
  return Math.max(...pending.map((p) => p.attempts));
}

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
export function scheduleSheetPush(delayMs = PUSH_DEBOUNCE_MS): void {
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    void pushPendingChanges();
  }, delayMs);
}

async function pushPendingChanges(): Promise<void> {
  const pending = await listOutbox();
  if (!pending.length) return;

  const attempts = Math.max(...pending.map((p) => p.attempts));
  if (attempts >= MAX_AUTO_SYNC_ATTEMPTS) return;

  const session = await loadGoogleSession();
  if (!session?.spreadsheetId) return;

  const access = await getAccess();
  if (!access) {
    const next = await bumpAllOutboxAttempts();
    const delay = nextAutoRetryDelay(next);
    if (delay != null) scheduleSheetPush(delay);
    return;
  }

  if (syncInFlight) {
    try {
      await syncInFlight;
    } catch {
      // previous sync failed ? still try below
    }
  }

  const result = await syncNow({ force: true, push: true, pull: true });
  const stillPending = await listOutbox();
  if (!result.ok || stillPending.length) {
    const next = await bumpAllOutboxAttempts();
    const delay = nextAutoRetryDelay(next);
    if (delay != null) scheduleSheetPush(delay);
  }
}

export async function flushPendingPurchasesSync(opts?: {
  force?: boolean;
}): Promise<{
  ok: boolean;
  mode: 'local' | 'sheets';
  message: string;
  paused?: boolean;
}> {
  const force = opts?.force ?? false;
  if (force) await resetOutboxAttempts();

  const pending = await listOutbox();
  const attempts = await maxOutboxAttempts();

  if (!force && pending.length && attempts >= MAX_AUTO_SYNC_ATTEMPTS) {
    return {
      ok: false,
      mode: 'sheets',
      paused: true,
      message:
        'Sheet sync paused after several failed attempts. Your data is safe on this phone ? tap Sync now when you have connection.',
    };
  }

  const access = await getAccess();
  if (!access) {
    if (pending.length && (await loadGoogleSession())?.spreadsheetId) {
      const next = force ? 1 : await bumpAllOutboxAttempts();
      const delay = nextAutoRetryDelay(next);
      if (delay != null) scheduleSheetPush(delay);
    }
    return {
      ok: true,
      mode: 'local',
      message: pending.length
        ? `${pending.length} change(s) waiting on this phone.`
        : 'Working offline ? data stays on this phone.',
    };
  }

  return syncNow({ force: true, push: true, pull: true });
}

export async function flushOutbox(): Promise<void> {
  const access = await getAccess();
  if (!access) {
    const next = await bumpAllOutboxAttempts();
    const delay = nextAutoRetryDelay(next);
    if (delay != null) scheduleSheetPush(delay);
    return;
  }
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
    const next = await maxOutboxAttempts();
    const delay = nextAutoRetryDelay(next);
    if (delay != null) scheduleSheetPush(delay);
    throw new Error('flush failed');
  }
}

export function getPurchaseSyncRetryPolicy() {
  return {
    maxAttempts: MAX_AUTO_SYNC_ATTEMPTS,
    backoffMs: [...BACKOFF_MS],
  };
}

/** Alias used by older call sites. */
export async function pushPurchasesSnapshot(): Promise<boolean> {
  return pushFullSnapshot();
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
        message:
          'Working offline ? data stays on this phone. Link a Sheet in Account when you want to sync.',
      };
    }

    const now = Date.now();
    if (!force && now - lastSyncAtMs < MIN_SYNC_GAP_MS) {
      const waitSec = Math.ceil((MIN_SYNC_GAP_MS - (now - lastSyncAtMs)) / 1000);
      return {
        ok: true,
        mode: 'sheets' as const,
        message: `Synced recently ? next Sheets sync in ~${waitSec}s.`,
      };
    }

    try {
      if (wantPull) {
        await pullFromSheets();
      }

      const pending = await listOutbox();
      const shouldPush = wantPush && (force || pending.length > 0);

      if (shouldPush) {
        await pushFullSnapshot();
        for (const item of pending) {
          await removeOutbox(item.id);
        }
      }

      lastSyncAtMs = Date.now();
      return {
        ok: true,
        mode: 'sheets' as const,
        message: shouldPush
          ? 'Synced Users, Categories, Fixed, Purchases & Savings to Google Sheets.'
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
