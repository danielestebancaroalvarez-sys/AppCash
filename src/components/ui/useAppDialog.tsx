import { useCallback, useMemo, useState } from 'react';
import { AppModal, type AppModalTone } from '@/components/ui/AppModal';

type DialogConfig = {
  title: string;
  message?: string;
  tone?: AppModalTone;
  confirmLabel?: string;
  cancelLabel?: string | null;
  onConfirm?: () => void | Promise<void>;
};

/**
 * Drop-in replacement for Alert.alert using AppModal.
 * `alert(title, message)` → OK only. `confirm(...)` → Cancel + Confirm.
 */
export function useAppDialog() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<DialogConfig>({ title: '' });
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
  }, [busy]);

  const alert = useCallback((title: string, message?: string, tone: AppModalTone = 'default') => {
    setCfg({
      title,
      message,
      tone,
      confirmLabel: 'OK',
      cancelLabel: null,
      onConfirm: () => setOpen(false),
    });
    setOpen(true);
  }, []);

  const confirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void | Promise<void>,
      opts?: {
        confirmLabel?: string;
        cancelLabel?: string;
        tone?: AppModalTone;
      }
    ) => {
      setCfg({
        title,
        message,
        tone: opts?.tone ?? 'default',
        confirmLabel: opts?.confirmLabel ?? 'Confirm',
        cancelLabel: opts?.cancelLabel ?? 'Cancel',
        onConfirm,
      });
      setOpen(true);
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    const action = cfg.onConfirm;
    setOpen(false);
    if (!action) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }, [cfg]);

  const Dialog = useMemo(
    () => (
      <AppModal
        visible={open}
        title={cfg.title}
        message={cfg.message}
        tone={cfg.tone}
        confirmLabel={busy ? '…' : cfg.confirmLabel ?? 'OK'}
        cancelLabel={cfg.cancelLabel === null ? undefined : cfg.cancelLabel}
        hideCancel={cfg.cancelLabel === null}
        confirmDisabled={busy}
        onCancel={close}
        onRequestClose={close}
        onConfirm={handleConfirm}
      />
    ),
    [open, cfg, busy, close, handleConfirm]
  );

  return { alert, confirm, Dialog };
}
