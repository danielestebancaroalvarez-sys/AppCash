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
import {
  initDatabase,
  getSetting,
  setSetting,
  listOutbox,
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
import { ensureHouseholdDefaults } from '@/lib/db/seed';
import {
  loadGoogleSession,
  clearGoogleSession,
  configureGoogleSignIn,
  refreshGoogleAccessToken,
} from '@/lib/google/auth';
import { flushPendingPurchasesSync, getPurchaseSyncRetryPolicy } from '@/lib/sync/engine';
import { getWeekRange, shiftWeek } from '@/lib/dates';

export const LOCAL_MODE_KEY = 'app_local_mode';

interface FinanceState {
  ready: boolean;
  booting: boolean;
  /** True when the user chose offline/local mode (Google optional). */
  localMode: boolean;
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
  /** Local purchase changes waiting to push. */
  pendingSyncCount: number;
  /** Auto retries exhausted until manual Sync / foreground. */
  syncPaused: boolean;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setSession: (session: GoogleSession | null) => void;
  enterLocalMode: (name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveUser: (id: string) => Promise<void>;
  shiftWeekBy: (weeks: number) => void;
  setWeekAnchor: (date: Date) => void;
  runSync: () => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  ready: false,
  booting: false,
  localMode: false,
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
  pendingSyncCount: 0,
  syncPaused: false,

  bootstrap: async () => {
    if (get().booting) return;
    set({ booting: true });
    await initDatabase();
    configureGoogleSignIn();

    const localMode = (await getSetting(LOCAL_MODE_KEY)) === '1';
    const session =
      (await refreshGoogleAccessToken()) ?? (await loadGoogleSession());

    if (session || localMode) {
      await ensureHouseholdDefaults(
        session?.name || 'Me',
        session?.email || '',
        session?.photoUrl ?? ''
      );
    }

    const activeUserId = await getSetting('active_user_id');
    const lastSyncAt = await getSetting('last_sync_at');
    set({
      session,
      localMode: localMode || Boolean(session),
      activeUserId,
      lastSyncAt,
    });

    if (session || localMode) {
      await get().refresh();
    }
    set({ ready: true, booting: false });
  },

  refresh: async () => {
    const session = get().session;
    if (session || get().localMode) {
      await ensureHouseholdDefaults(
        session?.name || 'Me',
        session?.email || '',
        session?.photoUrl ?? ''
      );
    }
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
      outbox,
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
      listOutbox(),
    ]);
    const maxAttempts = getPurchaseSyncRetryPolicy().maxAttempts;
    const attempts = outbox.length ? Math.max(...outbox.map((o) => o.attempts)) : 0;
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
      pendingSyncCount: outbox.length,
      syncPaused: outbox.length > 0 && attempts >= maxAttempts,
    });
  },

  setSession: (session) => set({ session, localMode: true }),

  enterLocalMode: async (name = 'Me') => {
    await ensureHouseholdDefaults(name.trim() || 'Me', '', '');
    await setSetting(LOCAL_MODE_KEY, '1');
    set({ localMode: true, session: null });
    await get().refresh();
  },

  logout: async () => {
    // Disconnect Google only — keep local finance data and local mode.
    await clearGoogleSession();
    await setSetting(LOCAL_MODE_KEY, '1');
    set({
      session: null,
      localMode: true,
    });
    await get().refresh();
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
    // Manual sync resets the pause counter and tries again.
    const result = await flushPendingPurchasesSync({ force: true });
    const session = await loadGoogleSession();
    set({
      session,
      syncMessage: result.message,
      lastSyncAt: new Date().toISOString(),
      syncPaused: Boolean(result.paused),
    });
    await get().refresh();
  },
}));

export function useWeekRange() {
  const weekAnchor = useFinanceStore((s) => s.weekAnchor);
  return getWeekRange(weekAnchor);
}
