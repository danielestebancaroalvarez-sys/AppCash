import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { createId } from '@/lib/id';
import { nowIso, todayIsoDate } from '@/lib/dates';
import {
  listCategories,
  listTransactions,
  listUsers,
  upsertTransaction,
} from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import type { Transaction } from '@/types/models';

// expo-sharing may not be installed - install it
export async function exportTransactionsExcel(): Promise<string> {
  const [txs, users, categories] = await Promise.all([
    listTransactions(),
    listUsers(),
    listCategories(),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const rows = txs.map((t) => ({
    date: t.date,
    type: t.type,
    amount_aud: t.amount_aud,
    category: catMap.get(t.category_id) ?? '',
    user: userMap.get(t.user_id) ?? '',
    merchant: t.merchant,
    note: t.note,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'transactions');
  const b64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
  const path = `${FileSystem.cacheDirectory}appcash-export-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(path, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export async function importTransactionsFromExcelBase64(base64: string): Promise<number> {
  const book = XLSX.read(base64, { type: 'base64' });
  const sheetName = book.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName]);
  const users = await listUsers();
  const categories = await listCategories();
  const primaryUser = users[0];
  const grocery =
    categories.find((c) => c.name.toLowerCase() === 'groceries') ?? categories[0];
  if (!primaryUser || !grocery) return 0;

  let count = 0;
  for (const row of rows) {
    const amount = Number(row.amount_aud ?? row.Amount ?? row.amount ?? 0);
    if (!amount) continue;
    const dateRaw = String(row.date ?? row.Date ?? todayIsoDate());
    const note = String(row.note ?? row.Note ?? row.description ?? '');
    const merchant = String(row.merchant ?? row.Merchant ?? '');
    const typeHint = String(row.type ?? row.Type ?? 'expense_sporadic').toLowerCase();
    const type =
      typeHint.includes('income') ? 'income_sporadic' : typeHint.includes('fixed') ? 'fixed' : 'expense_sporadic';

    const catName = String(row.category ?? row.Category ?? '').toLowerCase();
    const cat = categories.find((c) => c.name.toLowerCase() === catName) ?? grocery;
    const userName = String(row.user ?? row.User ?? '').toLowerCase();
    const user = users.find((u) => u.name.toLowerCase() === userName) ?? primaryUser;

    const tx: Transaction = {
      id: createId(),
      user_id: user.id,
      type: type as Transaction['type'],
      category_id: cat.id,
      amount_aud: Math.abs(amount),
      date: dateRaw.slice(0, 10),
      note,
      merchant,
      receipt_id: '',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertTransaction(tx);
    await queueMutation('transactions', tx);
    count += 1;
  }
  return count;
}

/** Share filtered (or all) transactions as CSV. */
export async function exportTransactionsCsv(
  txs: Transaction[],
  users: Awaited<ReturnType<typeof listUsers>>,
  categories: Awaited<ReturnType<typeof listCategories>>
): Promise<void> {
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['date', 'type', 'amount_aud', 'category', 'user', 'merchant', 'note'];
  const lines = [
    header.join(','),
    ...txs.map((t) =>
      [
        t.date,
        t.type,
        String(t.amount_aud),
        escape(catMap.get(t.category_id) ?? ''),
        escape(userMap.get(t.user_id) ?? ''),
        escape(t.merchant),
        escape(t.note),
      ].join(',')
    ),
  ];
  const path = `${FileSystem.cacheDirectory}appcash-search-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(path, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'Export CSV',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
