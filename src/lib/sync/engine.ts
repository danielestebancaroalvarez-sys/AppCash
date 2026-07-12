import {
  clearAndWriteSheet,
  createAppSpreadsheet,
  parseSheetRows,
  readSheet,
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

async function getAccess(): Promise<{ token: string; spreadsheetId: string } | null> {
  const session = await loadGoogleSession();
  if (!session?.accessToken || !session.spreadsheetId) return null;
  return { token: session.accessToken, spreadsheetId: session.spreadsheetId };
}

export async function ensureSpreadsheet(): Promise<string | null> {
  const session = await loadGoogleSession();
  if (!session?.accessToken) return null;
  if (session.spreadsheetId) return session.spreadsheetId;
  const id = await createAppSpreadsheet(session.accessToken);
  await saveGoogleSession({ ...session, spreadsheetId: id });
  await setSetting('spreadsheet_id', id);
  return id;
}

export async function pullFromSheets(): Promise<boolean> {
  const access = await getAccess();
  if (!access) return false;

  for (const sheet of SHEET_NAMES) {
    if (sheet === 'settings') {
      const values = await readSheet(access.token, access.spreadsheetId, sheet);
      const rows = parseSheetRows(sheet, values) as Array<{ key: string; value: string }>;
      for (const row of rows) {
        if (row.key) await setSetting(row.key, row.value);
      }
      continue;
    }

    const values = await readSheet(access.token, access.spreadsheetId, sheet);
    const rows = parseSheetRows(sheet, values);

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

  for (const sheet of SHEET_NAMES) {
    if (sheet === 'savings_sims') continue;
    const rows = await snapshotSheet(sheet);
    await clearAndWriteSheet(
      access.token,
      access.spreadsheetId,
      sheet,
      serializeRows(sheet, rows)
    );
  }
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
  // For simplicity and reliability with Sheets as source of truth, flush by full snapshot.
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
  }
}

export async function syncNow(): Promise<{ ok: boolean; mode: 'local' | 'sheets'; message: string }> {
  const access = await getAccess();
  if (!access) {
    return { ok: true, mode: 'local', message: 'Local mode — connect Google to sync Sheets.' };
  }
  try {
    await flushOutbox();
    await pullFromSheets();
    return { ok: true, mode: 'sheets', message: 'Synced with Google Sheets.' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed';
    return { ok: false, mode: 'sheets', message };
  }
}
