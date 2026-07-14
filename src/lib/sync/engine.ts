import {
  asCategoryType,
  batchReadSheets,
  batchWriteAllSheets,
  createAppSpreadsheet,
  ensurePurchaseSheet,
  parseCompraRows,
  parseSpreadsheetId,
  serializeRows,
  spreadsheetEditUrl,
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
  getSetting,
  listCategories,
  listOutbox,
  listTransactions,
  listUsers,
  removeOutbox,
  bumpOutboxAttempt,
  bumpAllOutboxAttempts,
  resetOutboxAttempts,
  setSetting,
  upsertCategory,
  upsertTransaction,
  upsertUser,
} from '@/lib/db';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import { CategoryPalette } from '@/constants/theme';
import { ensureHouseholdDefaults } from '@/lib/db/seed';
import type { AppUser, Category, Transaction } from '@/types/models';

const MIN_SYNC_GAP_MS = 70_000;
let lastSyncAtMs = 0;
let syncInFlight: Promise<{ ok: boolean; mode: 'local' | 'sheets'; message: string }> | null =
  null;

async function getAccess(): Promise<{ token: string; spreadsheetId: string } | null> {
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
      'Sign in with Google again from Account to sync purchases. ' +
      'Your app data stays on this phone — you can keep using AppCash offline.'
    );
  }
  return message;
}

export async function ensureSpreadsheet(): Promise<string | null> {
  const session = (await refreshGoogleAccessToken()) ?? (await loadGoogleSession());
  if (!session?.accessToken) return null;
  if (!session.spreadsheetId) return null;
  try {
    await ensurePurchaseSheet(session.accessToken, session.spreadsheetId);
  } catch {
    // offline
  }
  return session.spreadsheetId;
}

export async function createAndLinkSpreadsheet(title?: string): Promise<string | null> {
  const session = (await refreshGoogleAccessToken()) ?? (await loadGoogleSession());
  if (!session?.accessToken) return null;
  if (session.spreadsheetId) return session.spreadsheetId;

  const trimmed = title?.trim() || 'AppCash Compras';
  const id = await createAppSpreadsheet(session.accessToken, trimmed);
  await saveGoogleSession({ ...session, spreadsheetId: id });
  await setSetting('spreadsheet_id', id);
  try {
    await pushPurchasesSnapshot();
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
    return { ok: false, message: 'Sign in with Google first to link a purchase sheet.' };
  }
  const id = parseSpreadsheetId(raw);
  if (!id) {
    return {
      ok: false,
      message: 'Paste the full Google Sheets URL or the spreadsheet ID.',
    };
  }
  await ensurePurchaseSheet(session.accessToken, id);
  await saveGoogleSession({ ...session, spreadsheetId: id });
  await setSetting('spreadsheet_id', id);
  const result = await syncNow({ force: true, push: true, pull: true });
  return { ok: result.ok, spreadsheetId: id, message: result.message };
}

/** Unlink sheet only — keeps all local app data. */
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

/** Unlink sheet and wipe local finance data. */
export async function unlinkSpreadsheetAndWipeLocal(): Promise<void> {
  await unlinkSpreadsheet();
  const session = await loadGoogleSession();
  await clearFinanceData();
  await ensureHouseholdDefaults(session?.name || 'Me', session?.email || '', session?.photoUrl || '');
}

export function getSpreadsheetOpenUrl(spreadsheetId: string): string {
  return spreadsheetEditUrl(spreadsheetId);
}

function isPurchaseTx(tx: Transaction): boolean {
  return tx.type === 'expense_sporadic' || tx.type === 'variable';
}

/** One Sheet row per local purchase (receipt = one total row; no line-items). */
async function buildPurchaseRows(): Promise<string[][]> {
  const [users, categories, transactions] = await Promise.all([
    listUsers(),
    listCategories(),
    listTransactions(),
  ]);
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  const rows: Array<Record<string, unknown>> = [];
  for (const tx of transactions) {
    if (!isPurchaseTx(tx)) continue;
    rows.push({
      Fecha: tx.date,
      Quién: userName(tx.user_id),
      Descripción: tx.merchant || tx.note || 'Purchase',
      Categoría: catName(tx.category_id),
      Monto: tx.amount_aud,
      id: tx.id,
    });
  }

  return serializeRows('Purchases', rows);
}

async function resolveUserId(quien: string, cache: AppUser[]): Promise<string> {
  const match = cache.find((u) => u.name.toLowerCase() === quien.trim().toLowerCase());
  if (match) return match.id;
  if (!quien.trim() && cache[0]) return cache[0].id;
  if (cache[0] && !quien.trim()) return cache[0].id;
  const id = createId();
  const user: AppUser = {
    id,
    name: quien.trim() || 'Me',
    email: '',
    avatar_url: '',
    role: cache.some((u) => u.role === 'owner') ? 'member' : 'owner',
    updated_at: nowIso(),
  };
  await upsertUser(user);
  cache.push(user);
  return id;
}

async function resolveCategoryId(
  categoria: string,
  cache: Category[]
): Promise<string> {
  const name = categoria.trim() || 'Groceries';
  const match = cache.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  const groceries = cache.find((c) => c.name.toLowerCase() === 'groceries');
  if (!categoria.trim() && groceries) return groceries.id;
  const id = createId();
  const cat: Category = {
    id,
    name,
    type: asCategoryType('expense'),
    icon: 'cart',
    color: CategoryPalette[cache.length % CategoryPalette.length],
    is_system: false,
    updated_at: nowIso(),
  };
  await upsertCategory(cat);
  cache.push(cat);
  return id;
}

/**
 * Pull only the Purchases tab and merge into local transactions.
 * Never replaces users, categories, fixed, savings, or other system data.
 */
export async function pullFromSheets(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  const all = await batchReadSheets(access.token, access.spreadsheetId, ['Purchases'], true);
  const compras = parseCompraRows(all.Purchases ?? []);
  if (!compras.length) {
    await setSetting('last_sync_at', nowIso());
    return true;
  }

  const users = await listUsers();
  const categories = await listCategories();
  const existing = await listTransactions();
  const byId = new Map(existing.map((t) => [t.id, t]));

  for (const row of compras) {
    const amount = row.line_total || row.unit_price * (row.qty || 1);
    if (!amount && !row.item && !row.date) continue;

    const date = (row.date || nowIso().slice(0, 10)).slice(0, 10);
    const time = (row.time || '12:00').slice(0, 5);
    const id = row.id?.trim() || createId();
    const prev = byId.get(id);

    const tx: Transaction = {
      id,
      user_id: await resolveUserId(row.who, users),
      type: 'expense_sporadic',
      category_id: await resolveCategoryId(row.category, categories),
      amount_aud: amount,
      date,
      note: (row.item || '').trim() || prev?.note || 'Purchase',
      merchant: (row.item || '').trim() || prev?.merchant || 'Purchase',
      receipt_id: prev?.receipt_id || '',
      created_at: prev?.created_at || `${date}T${time}:00`,
      updated_at: nowIso(),
    };
    await upsertTransaction(tx);
    byId.set(id, tx);
  }

  await setSetting('last_sync_at', nowIso());
  return true;
}

export async function pushPurchasesSnapshot(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  await ensurePurchaseSheet(access.token, access.spreadsheetId);
  const rows = await buildPurchaseRows();
  await batchWriteAllSheets(access.token, access.spreadsheetId, [
    { sheet: 'Purchases', rows },
  ]);
  await setSetting('last_sync_at', nowIso());
  return true;
}

/** @deprecated Alias — push is purchases-only now. */
export async function pushFullSnapshot(): Promise<boolean> {
  return pushPurchasesSnapshot();
}

const PUSH_DEBOUNCE_MS = 1_200;
/** Auto retries: 12s → 30s → 1m → 2m → 5m… then stop (max 8 attempts). */
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
 * Queue a local change and schedule an automatic purchases push when Sheet is linked.
 * Failed syncs retry with backoff up to MAX_AUTO_SYNC_ATTEMPTS, then pause until
 * manual Sync or app foreground (which resets the counter).
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
  if (attempts >= MAX_AUTO_SYNC_ATTEMPTS) {
    // Paused — data stays local; user must Sync now or reopen the app.
    return;
  }

  const session = await loadGoogleSession();
  if (!session?.spreadsheetId) {
    // Sheet not linked: keep outbox but do not spin forever.
    return;
  }

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
      // previous sync failed — still try below
    }
  }

  const result = await syncNow({ force: true, push: true, pull: false });
  const stillPending = await listOutbox();
  if (!result.ok || stillPending.length) {
    const next = await bumpAllOutboxAttempts();
    const delay = nextAutoRetryDelay(next);
    if (delay != null) scheduleSheetPush(delay);
  }
}

/**
 * Flush pending purchases.
 * `force: true` resets attempt counters (manual Sync / returning to app after pause).
 */
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
        'Purchase sync paused after several failed attempts. Your data is safe on this phone — tap Sync purchases now when you have connection.',
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
        ? `${pending.length} purchase change(s) waiting on this phone.`
        : 'Working offline — purchases stay on this phone.',
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
    await pushPurchasesSnapshot();
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
          'Working offline — purchases stay on this phone. Link a Sheet in Account when you want to share the Compras list.',
      };
    }

    const now = Date.now();
    if (!force && now - lastSyncAtMs < MIN_SYNC_GAP_MS) {
      const waitSec = Math.ceil((MIN_SYNC_GAP_MS - (now - lastSyncAtMs)) / 1000);
      return {
        ok: true,
        mode: 'sheets' as const,
        message: `Synced recently — next purchase sync in ~${waitSec}s.`,
      };
    }

    try {
      const pending = await listOutbox();
      const shouldPush = wantPush && (force || pending.length > 0);

      if (shouldPush) {
        await pushPurchasesSnapshot();
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
          ? 'Purchases synced to Google Sheets (Compras list). Categories & bills stay on the phone.'
          : 'Purchases refreshed from Google Sheets.',
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
