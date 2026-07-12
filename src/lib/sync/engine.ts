import {
  batchReadSheets,
  batchWriteAllSheets,
  createAppSpreadsheet,
  parseSheetRows,
  serializeRows,
  SHEET_NAMES,
  type SheetName,
} from '@/lib/google/sheets';
import { loadGoogleSession, saveGoogleSession } from '@/lib/google/auth';
import {
  enqueueOutbox,
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
  upsertSavingsSim,
  upsertTransaction,
  upsertUser,
  getSetting,
} from '@/lib/db';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
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

const MIN_SYNC_GAP_MS = 70_000; // stay under Sheets 60 writes/min with headroom
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
  if (session.spreadsheetId) return session.spreadsheetId;
  const id = await createAppSpreadsheet(session.accessToken);
  await saveGoogleSession({ ...session, spreadsheetId: id });
  await setSetting('spreadsheet_id', id);
  try {
    await pushFullSnapshot();
    lastSyncAtMs = Date.now();
  } catch {
    // offline / quota — local data remains
  }
  return id;
}

export async function pullFromSheets(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  const all = await batchReadSheets(access.token, access.spreadsheetId);

  for (const sheet of SHEET_NAMES) {
    const values = all[sheet] ?? [];
    if (sheet === 'settings') {
      const rows = parseSheetRows(sheet, values) as Array<{ key: string; value: string }>;
      for (const row of rows) {
        if (row.key) await setSetting(row.key, row.value);
      }
      continue;
    }

    const rows = parseSheetRows(sheet, values);
    if (rows.length === 0 && (sheet === 'users' || sheet === 'categories')) {
      continue;
    }

    switch (sheet) {
      case 'users':
        await replaceSheetRows('users', rows as AppUser[], upsertUser);
        break;
      case 'categories':
        await replaceSheetRows('categories', rows as Category[], upsertCategory);
        break;
      case 'fixed_items':
        await replaceSheetRows('fixed_items', rows as FixedItem[], upsertFixedItem);
        break;
      case 'transactions':
        await replaceSheetRows('transactions', rows as Transaction[], upsertTransaction);
        break;
      case 'receipts':
        await replaceSheetRows('receipts', rows as Receipt[], upsertReceipt);
        break;
      case 'receipt_items':
        await replaceSheetRows('receipt_items', rows as ReceiptItem[], upsertReceiptItem);
        break;
      case 'savings_goals':
        await replaceSheetRows('savings_goals', rows as SavingsGoal[], upsertSavingsGoal);
        break;
      case 'savings_sims':
        await replaceSheetRows('savings_sims', rows as SavingsSim[], upsertSavingsSim);
        break;
      case 'notifications':
        await replaceSheetRows('notifications', rows as AppNotification[], upsertNotification);
        break;
      case 'product_stats':
        await replaceSheetRows('product_stats', rows as ProductStat[], upsertProductStat);
        break;
    }
  }

  await setSetting('last_sync_at', nowIso());
  return true;
}

async function snapshotSheet(sheet: SheetName): Promise<Array<Record<string, unknown>>> {
  switch (sheet) {
    case 'users':
      return listUsers() as unknown as Array<Record<string, unknown>>;
    case 'categories':
      return listCategories() as unknown as Array<Record<string, unknown>>;
    case 'fixed_items':
      return listFixedItems() as unknown as Array<Record<string, unknown>>;
    case 'transactions':
      return listTransactions() as unknown as Array<Record<string, unknown>>;
    case 'receipts':
      return listReceipts() as unknown as Array<Record<string, unknown>>;
    case 'receipt_items':
      return listReceiptItems() as unknown as Array<Record<string, unknown>>;
    case 'savings_goals':
      return listSavingsGoals() as unknown as Array<Record<string, unknown>>;
    case 'notifications':
      return listNotifications() as unknown as Array<Record<string, unknown>>;
    case 'product_stats':
      return listProductStats() as unknown as Array<Record<string, unknown>>;
    case 'settings': {
      const keys = ['currency', 'week_starts', 'sync_interval_sec', 'active_user_id', 'gemini_model'];
      const out: Array<{ key: string; value: string }> = [];
      for (const key of keys) {
        const value = await getSetting(key);
        if (value != null) out.push({ key, value });
      }
      return out;
    }
    default:
      return [];
  }
}

export async function pushFullSnapshot(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  const payload: Array<{ sheet: SheetName; rows: string[][] }> = [];
  for (const sheet of SHEET_NAMES) {
    if (sheet === 'savings_sims') continue;
    const rows = await snapshotSheet(sheet);
    payload.push({ sheet, rows: serializeRows(sheet, rows) });
  }

  await batchWriteAllSheets(access.token, access.spreadsheetId, payload);
  await setSetting('last_sync_at', nowIso());
  return true;
}

export async function queueMutation(sheet: SheetName, payload: unknown): Promise<void> {
  await enqueueOutbox({
    id: createId(),
    sheet,
    operation: 'upsert',
    payload_json: JSON.stringify(payload),
    created_at: nowIso(),
    attempts: 0,
  });
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

/**
 * @param opts.force - ignore throttle (manual Sync now)
 * @param opts.push - push local → Sheets when outbox has changes (or force)
 * @param opts.pull - pull Sheets → local
 */
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
      return { ok: true, mode: 'local' as const, message: 'Local mode — connect Google to sync Sheets.' };
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
          ? 'Uploaded to Google Sheets and refreshed.'
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
