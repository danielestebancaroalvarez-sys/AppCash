import { useCallback, useState } from 'react';
import { useFinanceStore } from '@/stores/finance-store';

/**
 * Pull-to-refresh: force sync with Google Sheets then reload local store.
 */
export function useSheetRefresh(afterSync?: () => void | Promise<void>) {
  const runSync = useFinanceStore((s) => s.runSync);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync();
      await afterSync?.();
    } finally {
      setRefreshing(false);
    }
  }, [runSync, afterSync]);

  return { refreshing, onRefresh };
}
