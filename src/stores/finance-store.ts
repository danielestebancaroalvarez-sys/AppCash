import { create } from 'zustand';
import type {
  AppNotification,
  AppUser,
  Category,
  FixedItem,
  GoogleSession,
  ProductStat,
  Receipt,
  ReceiptItem,
  SavingsGoal,
  Transaction,
} from '@/types/models';
import { initDatabase, getSetting, setSetting } from '@/lib/db';
import {
  listCategories,
  listFixedItems,
  listNotifications,
  listProductStats,
  listReceiptItems,
  listReceipts,
  listSavingsGoals,
  listTransactions,
  listUsers,
} from '@/lib/db';
import { seedIfNeeded } from '@/lib/db/seed';
import {
  loadGoogleSession,
  clearGoogleSession,
  configureGoogleSignIn,
} from '@/lib/google/auth';
import { syncNow, ensureSpreadsheet } from '@/lib/sync/engine';
import { getWeekRange, shiftWeek } from '@/lib/dates';

interface FinanceState {
  ready: boolean;
  booting: boolean;
  session: GoogleSession | null;
  users: AppUser[];
  activeUserId: string | null;
  categories: Category[];
  fixedItems: FixedItem[];
  transactions: Transaction[];
  receipts: Receipt[];
  receiptItems: ReceiptItem[];
  savingsGoals: SavingsGoal[];
  notifications: AppNotification[];
  productStats: ProductStat[];
  weekAnchor: Date;
  syncMessage: string;
  lastSyncAt: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setSession: (session: GoogleSession | null) => void;
  logout: () => Promise<void>;
  setActiveUser: (id: string) => Promise<void>;
  shiftWeekBy: (weeks: number) => void;
  setWeekAnchor: (date: Date) => void;
  runSync: () => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  ready: false,
  booting: false,
  session: null,
  users: [],
  activeUserId: null,
  categories: [],
  fixedItems: [],
  transactions: [],
  receipts: [],
  receiptItems: [],
  savingsGoals: [],
  notifications: [],
  productStats: [],
  weekAnchor: new Date(),
  syncMessage: '',
  lastSyncAt: null,

  bootstrap: async () => {
    if (get().booting) return;
    set({ booting: true });
    await initDatabase();
    configureGoogleSignIn();
    const session = await loadGoogleSession();
    if (session) {
      await seedIfNeeded(session.name, session.email, session.photoUrl ?? '');
    }
    const activeUserId = await getSetting('active_user_id');
    const lastSyncAt = await getSetting('last_sync_at');
    set({
      session,
      activeUserId,
      lastSyncAt,
    });
    if (session) {
      await get().refresh();
    }
    set({ ready: true, booting: false });
  },

  refresh: async () => {
    const [
      users,
      categories,
      fixedItems,
      transactions,
      receipts,
      receiptItems,
      savingsGoals,
      notifications,
      productStats,
      activeUserId,
      lastSyncAt,
    ] = await Promise.all([
      listUsers(),
      listCategories(),
      listFixedItems(),
      listTransactions(),
      listReceipts(),
      listReceiptItems(),
      listSavingsGoals(),
      listNotifications(),
      listProductStats(),
      getSetting('active_user_id'),
      getSetting('last_sync_at'),
    ]);
    set({
      users,
      categories,
      fixedItems,
      transactions,
      receipts,
      receiptItems,
      savingsGoals,
      notifications,
      productStats,
      activeUserId: activeUserId ?? users[0]?.id ?? null,
      lastSyncAt,
    });
  },

  setSession: (session) => set({ session }),

  logout: async () => {
    await clearGoogleSession();
    set({
      session: null,
      users: [],
      transactions: [],
      fixedItems: [],
      categories: [],
      savingsGoals: [],
      notifications: [],
      productStats: [],
      receipts: [],
      receiptItems: [],
      ready: true,
    });
  },

  setActiveUser: async (id) => {
    await setSetting('active_user_id', id);
    set({ activeUserId: id });
  },

  shiftWeekBy: (weeks) => {
    set({ weekAnchor: shiftWeek(get().weekAnchor, weeks) });
  },

  setWeekAnchor: (date) => set({ weekAnchor: date }),

  runSync: async () => {
    if (get().session) {
      try {
        await ensureSpreadsheet();
      } catch {
        // spreadsheet creation may fail without network/scopes
      }
    }
    const result = await syncNow();
    set({ syncMessage: result.message, lastSyncAt: new Date().toISOString() });
    await get().refresh();
  },
}));

export function useWeekRange() {
  const weekAnchor = useFinanceStore((s) => s.weekAnchor);
  return getWeekRange(weekAnchor);
}
