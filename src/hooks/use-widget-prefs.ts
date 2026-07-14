import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import {
  defaultWidgetPrefs,
  loadWidgetPrefs,
  saveWidgetPrefs,
  type DashboardWidgetId,
  type WidgetPrefs,
} from '@/lib/dashboard/widgets';

interface WidgetPrefsState {
  prefs: WidgetPrefs;
  ready: boolean;
  bootstrap: () => Promise<void>;
  setEnabled: (id: DashboardWidgetId, enabled: boolean) => Promise<void>;
}

export const useWidgetPrefsStore = create<WidgetPrefsState>((set, get) => ({
  prefs: defaultWidgetPrefs(),
  ready: false,

  bootstrap: async () => {
    const prefs = await loadWidgetPrefs();
    set({ prefs, ready: true });
  },

  setEnabled: async (id, enabled) => {
    const prefs = { ...get().prefs, [id]: enabled };
    set({ prefs });
    await saveWidgetPrefs(prefs);
  },
}));

/** Shared prefs so More toggles update Home immediately. */
export function useWidgetPrefs() {
  const prefs = useWidgetPrefsStore((s) => s.prefs);
  const ready = useWidgetPrefsStore((s) => s.ready);
  const bootstrap = useWidgetPrefsStore((s) => s.bootstrap);
  const setEnabled = useWidgetPrefsStore((s) => s.setEnabled);

  useEffect(() => {
    if (!ready) void bootstrap();
  }, [ready, bootstrap]);

  const isEnabled = useCallback((id: DashboardWidgetId) => prefs[id] !== false, [prefs]);

  return { prefs, ready, reload: bootstrap, setEnabled, isEnabled };
}
