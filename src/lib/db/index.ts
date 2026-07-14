import * as SQLite from 'expo-sqlite';
import type {
  AppNotification,
  AppUser,
  Category,
  FixedItem,
  OutboxItem,
  ProductStat,
  Receipt,
  ReceiptItem,
  SavingsGoal,
  SavingsSim,
  Transaction,
} from '@/types/models';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('appcash.db');
  }
  return dbPromise;
}

export async function initDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'tag',
      color TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fixed_items (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount_aud REAL NOT NULL,
      period TEXT NOT NULL,
      direction TEXT NOT NULL,
      auto_debit INTEGER NOT NULL DEFAULT 0,
      notify_days_before INTEGER NOT NULL DEFAULT 2,
      active INTEGER NOT NULL DEFAULT 1,
      next_due TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount_aud REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      merchant TEXT NOT NULL DEFAULT '',
      receipt_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      store TEXT NOT NULL,
      total_aud REAL NOT NULL,
      photo_uri_or_drive_id TEXT NOT NULL DEFAULT '',
      purchased_at TEXT NOT NULL,
      raw_gemini_json TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipt_items (
      id TEXT PRIMARY KEY NOT NULL,
      receipt_id TEXT NOT NULL,
      name TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 1,
      unit_price_aud REAL NOT NULL,
      line_total_aud REAL NOT NULL,
      category_guess TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      target_aud REAL NOT NULL,
      current_aud REAL NOT NULL DEFAULT 0,
      deadline TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS savings_sims (
      id TEXT PRIMARY KEY NOT NULL,
      goal_id TEXT NOT NULL,
      weekly_amount REAL NOT NULL,
      result_weeks REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      due_at TEXT NOT NULL,
      related_fixed_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_stats (
      id TEXT PRIMARY KEY NOT NULL,
      product_name_normalized TEXT NOT NULL,
      avg_price REAL NOT NULL,
      buy_frequency_days REAL NOT NULL,
      last_seen TEXT NOT NULL,
      purchase_count INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      sheet TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  await migrateSavingsGoalColumns(db);
}

async function migrateSavingsGoalColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const alters = [
    `ALTER TABLE savings_goals ADD COLUMN kind TEXT NOT NULL DEFAULT 'other'`,
    `ALTER TABLE savings_goals ADD COLUMN color TEXT NOT NULL DEFAULT '#3DE7FF'`,
    `ALTER TABLE savings_goals ADD COLUMN plan_mode TEXT NOT NULL DEFAULT 'contribution'`,
    `ALTER TABLE savings_goals ADD COLUMN contribution_aud REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE savings_goals ADD COLUMN contribution_frequency TEXT NOT NULL DEFAULT 'monthly'`,
    `ALTER TABLE savings_goals ADD COLUMN yield_mode TEXT NOT NULL DEFAULT 'none'`,
    `ALTER TABLE savings_goals ADD COLUMN annual_rate REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE savings_goals ADD COLUMN reminder INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE savings_goals ADD COLUMN icon TEXT NOT NULL DEFAULT ''`,
  ];
  for (const sql of alters) {
    try {
      await db.execAsync(sql);
    } catch {
      // column already exists
    }
  }
}

function boolToInt(v: boolean): number {
  return v ? 1 : 0;
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function upsertUser(user: AppUser): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO users (id, name, email, avatar_url, role, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, email=excluded.email, avatar_url=excluded.avatar_url,
       role=excluded.role, updated_at=excluded.updated_at`,
    [user.id, user.name, user.email, user.avatar_url, user.role, user.updated_at]
  );
}

export async function listUsers(): Promise<AppUser[]> {
  const db = await getDb();
  return db.getAllAsync<AppUser>('SELECT * FROM users ORDER BY name ASC');
}

export async function deleteUser(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
}

export async function upsertCategory(c: Category): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO categories (id, name, type, icon, color, is_system, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, type=excluded.type, icon=excluded.icon,
       color=excluded.color, is_system=excluded.is_system, updated_at=excluded.updated_at`,
    [c.id, c.name, c.type, c.icon, c.color, boolToInt(c.is_system), c.updated_at]
  );
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    type: Category['type'];
    icon: string;
    color: string;
    is_system: number;
    updated_at: string;
  }>('SELECT * FROM categories ORDER BY name ASC');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    icon: r.icon,
    color: r.color,
    is_system: Boolean(r.is_system),
    updated_at: r.updated_at,
  }));
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

/** Wipe synced finance tables (keeps settings keys except spreadsheet_id cleared by caller). */
export async function clearFinanceData(): Promise<void> {
  const db = await getDb();
  const tables = [
    'transactions',
    'receipt_items',
    'receipts',
    'savings_goals',
    'savings_sims',
    'fixed_items',
    'notifications',
    'product_stats',
    'outbox',
    'categories',
    'users',
  ];
  for (const table of tables) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
}

export async function upsertFixedItem(item: FixedItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO fixed_items (
      id, user_id, category_id, name, amount_aud, period, direction,
      auto_debit, notify_days_before, active, next_due, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id=excluded.user_id, category_id=excluded.category_id, name=excluded.name,
      amount_aud=excluded.amount_aud, period=excluded.period, direction=excluded.direction,
      auto_debit=excluded.auto_debit, notify_days_before=excluded.notify_days_before,
      active=excluded.active, next_due=excluded.next_due, updated_at=excluded.updated_at`,
    [
      item.id,
      item.user_id,
      item.category_id,
      item.name,
      item.amount_aud,
      item.period,
      item.direction,
      boolToInt(item.auto_debit),
      item.notify_days_before,
      boolToInt(item.active),
      item.next_due,
      item.updated_at,
    ]
  );
}

export async function listFixedItems(): Promise<FixedItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    user_id: string;
    category_id: string;
    name: string;
    amount_aud: number;
    period: FixedItem['period'];
    direction: FixedItem['direction'];
    auto_debit: number;
    notify_days_before: number;
    active: number;
    next_due: string;
    updated_at: string;
  }>('SELECT * FROM fixed_items ORDER BY next_due ASC');
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    category_id: r.category_id,
    name: r.name,
    amount_aud: r.amount_aud,
    period: r.period,
    direction: r.direction,
    auto_debit: Boolean(r.auto_debit),
    notify_days_before: r.notify_days_before,
    active: Boolean(r.active),
    next_due: r.next_due,
    updated_at: r.updated_at,
  }));
}

export async function deleteFixedItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM fixed_items WHERE id = ?', [id]);
}

export async function upsertTransaction(tx: Transaction): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO transactions (
      id, user_id, type, category_id, amount_aud, date, note, merchant, receipt_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id=excluded.user_id, type=excluded.type, category_id=excluded.category_id,
      amount_aud=excluded.amount_aud, date=excluded.date, note=excluded.note,
      merchant=excluded.merchant, receipt_id=excluded.receipt_id, updated_at=excluded.updated_at`,
    [
      tx.id,
      tx.user_id,
      tx.type,
      tx.category_id,
      tx.amount_aud,
      tx.date,
      tx.note,
      tx.merchant,
      tx.receipt_id,
      tx.created_at,
      tx.updated_at,
    ]
  );
}

export async function listTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  return db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC, created_at DESC');
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function upsertReceipt(r: Receipt): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO receipts (id, user_id, store, total_aud, photo_uri_or_drive_id, purchased_at, raw_gemini_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       user_id=excluded.user_id, store=excluded.store, total_aud=excluded.total_aud,
       photo_uri_or_drive_id=excluded.photo_uri_or_drive_id, purchased_at=excluded.purchased_at,
       raw_gemini_json=excluded.raw_gemini_json, updated_at=excluded.updated_at`,
    [
      r.id,
      r.user_id,
      r.store,
      r.total_aud,
      r.photo_uri_or_drive_id,
      r.purchased_at,
      r.raw_gemini_json,
      r.updated_at,
    ]
  );
}

export async function upsertReceiptItem(item: ReceiptItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO receipt_items (id, receipt_id, name, qty, unit_price_aud, line_total_aud, category_guess, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       receipt_id=excluded.receipt_id, name=excluded.name, qty=excluded.qty,
       unit_price_aud=excluded.unit_price_aud, line_total_aud=excluded.line_total_aud,
       category_guess=excluded.category_guess, updated_at=excluded.updated_at`,
    [
      item.id,
      item.receipt_id,
      item.name,
      item.qty,
      item.unit_price_aud,
      item.line_total_aud,
      item.category_guess,
      item.updated_at,
    ]
  );
}

export async function listReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  return db.getAllAsync<Receipt>('SELECT * FROM receipts ORDER BY purchased_at DESC');
}

export async function listReceiptItems(receiptId?: string): Promise<ReceiptItem[]> {
  const db = await getDb();
  if (receiptId) {
    return db.getAllAsync<ReceiptItem>(
      'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY name ASC',
      [receiptId]
    );
  }
  return db.getAllAsync<ReceiptItem>('SELECT * FROM receipt_items ORDER BY updated_at DESC');
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM receipt_items WHERE receipt_id = ?', [id]);
  await db.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
}

export async function deleteReceiptItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM receipt_items WHERE id = ?', [id]);
}

export async function upsertSavingsGoal(g: SavingsGoal): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO savings_goals (
      id, name, target_aud, current_aud, deadline, user_id, updated_at,
      kind, color, icon, plan_mode, contribution_aud, contribution_frequency,
      yield_mode, annual_rate, reminder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, target_aud=excluded.target_aud, current_aud=excluded.current_aud,
       deadline=excluded.deadline, user_id=excluded.user_id, updated_at=excluded.updated_at,
       kind=excluded.kind, color=excluded.color, icon=excluded.icon, plan_mode=excluded.plan_mode,
       contribution_aud=excluded.contribution_aud,
       contribution_frequency=excluded.contribution_frequency,
       yield_mode=excluded.yield_mode, annual_rate=excluded.annual_rate,
       reminder=excluded.reminder`,
    [
      g.id,
      g.name,
      g.target_aud,
      g.current_aud,
      g.deadline,
      g.user_id,
      g.updated_at,
      g.kind,
      g.color,
      g.icon || '',
      g.plan_mode,
      g.contribution_aud,
      g.contribution_frequency,
      g.yield_mode,
      g.annual_rate,
      boolToInt(g.reminder),
    ]
  );
}

export async function listSavingsGoals(): Promise<SavingsGoal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    target_aud: number;
    current_aud: number;
    deadline: string;
    user_id: string;
    updated_at: string;
    kind?: string;
    color?: string;
    icon?: string;
    plan_mode?: string;
    contribution_aud?: number;
    contribution_frequency?: string;
    yield_mode?: string;
    annual_rate?: number;
    reminder?: number;
  }>('SELECT * FROM savings_goals ORDER BY updated_at DESC');

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    target_aud: r.target_aud,
    current_aud: r.current_aud,
    deadline: r.deadline ?? '',
    user_id: r.user_id,
    updated_at: r.updated_at,
    kind: (r.kind as SavingsGoal['kind']) || 'other',
    color: r.color || '#3DE7FF',
    icon: r.icon || '',
    plan_mode: (r.plan_mode as SavingsGoal['plan_mode']) || 'contribution',
    contribution_aud: r.contribution_aud ?? 0,
    contribution_frequency:
      (r.contribution_frequency as SavingsGoal['contribution_frequency']) || 'monthly',
    yield_mode: (r.yield_mode as SavingsGoal['yield_mode']) || 'none',
    annual_rate: r.annual_rate ?? 0,
    reminder: Boolean(r.reminder),
  }));
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM savings_sims WHERE goal_id = ?', [id]);
}

export async function upsertSavingsSim(s: SavingsSim): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO savings_sims (id, goal_id, weekly_amount, result_weeks, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       goal_id=excluded.goal_id, weekly_amount=excluded.weekly_amount,
       result_weeks=excluded.result_weeks, updated_at=excluded.updated_at`,
    [s.id, s.goal_id, s.weekly_amount, s.result_weeks, s.created_at, s.updated_at]
  );
}

export async function upsertNotification(n: AppNotification): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO notifications (id, user_id, title, body, due_at, related_fixed_id, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       user_id=excluded.user_id, title=excluded.title, body=excluded.body,
       due_at=excluded.due_at, related_fixed_id=excluded.related_fixed_id,
       status=excluded.status, updated_at=excluded.updated_at`,
    [n.id, n.user_id, n.title, n.body, n.due_at, n.related_fixed_id, n.status, n.updated_at]
  );
}

export async function listNotifications(): Promise<AppNotification[]> {
  const db = await getDb();
  return db.getAllAsync<AppNotification>(
    `SELECT * FROM notifications ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'sent' THEN 1 ELSE 2 END, due_at ASC`
  );
}

export async function upsertProductStat(p: ProductStat): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO product_stats (id, product_name_normalized, avg_price, buy_frequency_days, last_seen, purchase_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       product_name_normalized=excluded.product_name_normalized, avg_price=excluded.avg_price,
       buy_frequency_days=excluded.buy_frequency_days, last_seen=excluded.last_seen,
       purchase_count=excluded.purchase_count, updated_at=excluded.updated_at`,
    [
      p.id,
      p.product_name_normalized,
      p.avg_price,
      p.buy_frequency_days,
      p.last_seen,
      p.purchase_count,
      p.updated_at,
    ]
  );
}

export async function listProductStats(): Promise<ProductStat[]> {
  const db = await getDb();
  return db.getAllAsync<ProductStat>(
    'SELECT * FROM product_stats ORDER BY buy_frequency_days ASC, purchase_count DESC'
  );
}

export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO outbox (id, sheet, operation, payload_json, created_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [item.id, item.sheet, item.operation, item.payload_json, item.created_at, item.attempts]
  );
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxItem>('SELECT * FROM outbox ORDER BY created_at ASC');
}

export async function removeOutbox(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function bumpOutboxAttempt(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?', [id]);
}

export async function bumpAllOutboxAttempts(): Promise<number> {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET attempts = attempts + 1');
  const row = await db.getFirstAsync<{ m: number }>('SELECT MAX(attempts) as m FROM outbox');
  return row?.m ?? 0;
}

/** Clears attempt counters so a manual / foreground sync can try again. */
export async function resetOutboxAttempts(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET attempts = 0');
}

export async function replaceSheetRows<T extends { id: string }>(
  table:
    | 'users'
    | 'categories'
    | 'fixed_items'
    | 'transactions'
    | 'receipts'
    | 'receipt_items'
    | 'savings_goals'
    | 'savings_sims'
    | 'notifications'
    | 'product_stats',
  rows: T[],
  upsert: (row: T) => Promise<void>
): Promise<void> {
  const db = await getDb();
  const existing = await db.getAllAsync<{ id: string }>(`SELECT id FROM ${table}`);
  const incoming = new Set(rows.map((r) => r.id));
  for (const row of existing) {
    if (!incoming.has(row.id)) {
      await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [row.id]);
    }
  }
  for (const row of rows) {
    await upsert(row);
  }
}
