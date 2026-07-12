import { useCallback, useEffect, useState } from 'react';
import {
  defaultWidgetPrefs,
  loadWidgetPrefs,
  saveWidgetPrefs,
  type DashboardWidgetId,
  type WidgetPrefs,
} from '@/lib/dashboard/widgets';

export function useWidgetPrefs() {
  const [prefs, setPrefs] = useState<WidgetPrefs>(defaultWidgetPrefs);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const next = await loadWidgetPrefs();
    setPrefs(next);
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setEnabled = useCallback(async (id: DashboardWidgetId, enabled: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [id]: enabled };
      void saveWidgetPrefs(next);
      return next;
    });
  }, []);

  const isEnabled = useCallback((id: DashboardWidgetId) => prefs[id] !== false, [prefs]);

  return { prefs, ready, reload, setEnabled, isEnabled };
}
