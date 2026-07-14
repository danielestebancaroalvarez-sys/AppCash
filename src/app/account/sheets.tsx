import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import {
  createAndLinkSpreadsheet,
  getSpreadsheetOpenUrl,
  linkSpreadsheetFromInput,
  unlinkSpreadsheet,
  unlinkSpreadsheetAndWipeLocal,
} from '@/lib/sync/engine';
import { isGoogleConfigured, loadGoogleSession, signInWithGoogleNative } from '@/lib/google/auth';
import { seedIfNeeded } from '@/lib/db/seed';

export default function AccountSheetsScreen() {
  const session = useFinanceStore((s) => s.session);
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const refresh = useFinanceStore((s) => s.refresh);
  const runSync = useFinanceStore((s) => s.runSync);
  const setSession = useFinanceStore((s) => s.setSession);
  const { alert, confirm, Dialog } = useAppDialog();

  const [sheetInput, setSheetInput] = useState(session?.spreadsheetId ?? '');
  const [sheetName, setSheetName] = useState('AppCash Compras');
  const [busy, setBusy] = useState(false);
  const hasSheet = Boolean(session?.spreadsheetId);
  const hasGoogle = Boolean(session?.accessToken);

  useEffect(() => {
    setSheetInput(session?.spreadsheetId ?? '');
  }, [session?.spreadsheetId]);

  const ensureGoogle = async (): Promise<boolean> => {
    if (session?.accessToken) return true;
    if (!isGoogleConfigured()) {
      alert(
        'Google not configured',
        'Add Google Client IDs to .env and rebuild, or keep using the app offline.'
      );
      return false;
    }
    setBusy(true);
    try {
      const result = await signInWithGoogleNative();
      if (!result.ok) {
        if (!result.cancelled) alert('Could not sign in', result.message);
        return false;
      }
      await seedIfNeeded(result.session.name, result.session.email, result.session.photoUrl ?? '');
      setSession(result.session);
      await refresh();
      return true;
    } catch (e) {
      alert('Sign-in failed', e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSync = async () => {
    if (!hasSheet) {
      alert('No sheet linked', 'Create or paste a Google Sheet URL below.');
      return;
    }
    setBusy(true);
    try {
      await runSync();
      alert('Purchases sync', useFinanceStore.getState().syncMessage || 'Done');
    } finally {
      setBusy(false);
    }
  };

  const createSheet = async () => {
    if (!(await ensureGoogle())) return;
    const name = sheetName.trim() || 'AppCash Compras';
    setBusy(true);
    try {
      const id = await createAndLinkSpreadsheet(name);
      if (id) {
        setSheetInput(id);
        const s = await loadGoogleSession();
        if (s) setSession(s);
        await refresh();
        alert(
          'Purchase sheet ready',
          `"${name}" has one tab for purchases (Fecha, Quién, Descripción, Categoría, Monto). Categories and bills stay on this phone.`
        );
      }
    } catch (e) {
      alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const linkSheet = async () => {
    if (!(await ensureGoogle())) return;
    setBusy(true);
    try {
      const result = await linkSpreadsheetFromInput(sheetInput);
      if (result.spreadsheetId) {
        const s = await loadGoogleSession();
        if (s) setSession(s);
        setSheetInput(result.spreadsheetId);
      }
      await refresh();
      alert(result.ok ? 'Linked' : 'Could not link', result.message);
    } finally {
      setBusy(false);
    }
  };

  const openSheet = async () => {
    if (!session?.spreadsheetId) return;
    const url = getSpreadsheetOpenUrl(session.spreadsheetId);
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else alert('Open failed', url);
  };

  const removeSheet = () => {
    confirm(
      'Unlink purchase sheet?',
      'Your Google file stays online. App data on this phone is kept. Categories, bills and savings never lived on the Sheet.',
      async () => {
        setBusy(true);
        try {
          await unlinkSpreadsheet();
          const s = await loadGoogleSession();
          setSession(s);
          setSheetInput('');
          await refresh();
          alert('Unlinked', 'Purchase sheet unlinked. Local data is intact.');
        } catch (e) {
          alert('Error', e instanceof Error ? e.message : 'Failed');
        } finally {
          setBusy(false);
        }
      },
      { confirmLabel: 'Unlink', tone: 'danger', cancelLabel: 'Keep' }
    );
  };

  const wipeAll = () => {
    confirm(
      'Unlink and wipe phone data?',
      'This deletes ALL local finance data on this phone. The Google file itself is not deleted.',
      async () => {
        setBusy(true);
        try {
          await unlinkSpreadsheetAndWipeLocal();
          const s = await loadGoogleSession();
          setSession(s);
          setSheetInput('');
          await refresh();
          alert('Cleared', 'Sheet unlinked and local data wiped.');
        } catch (e) {
          alert('Error', e instanceof Error ? e.message : 'Failed');
        } finally {
          setBusy(false);
        }
      },
      { confirmLabel: 'Wipe phone data', tone: 'danger', cancelLabel: 'Cancel' }
    );
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.lead}>
        Optional purchase list for your partner. One sheet tab (Fecha · Quién · Descripción ·
        Categoría · Monto). They can add rows in Google Sheets; you sync into the app. Categories,
        fixed bills and savings stay only on this phone.
      </Text>

      <GlassPanel style={{ gap: Spacing.sm }}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: hasSheet
                  ? Palette.teal
                  : hasGoogle
                    ? Palette.amber
                    : Palette.textDim,
              },
            ]}
          />
          <Text style={styles.status}>
            {hasSheet
              ? 'Purchase sheet linked'
              : hasGoogle
                ? 'Google connected · no sheet yet'
                : 'Offline · Google not connected'}
            {syncMessage ? ` · ${syncMessage}` : ''}
          </Text>
        </View>

        <Text style={styles.label}>Sheet URL or ID</Text>
        <TextInput
          value={sheetInput}
          onChangeText={setSheetInput}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <PrimaryButton
          label={busy ? 'Working…' : hasSheet ? 'Sync purchases now' : 'Link purchase sheet'}
          onPress={hasSheet ? onSync : linkSheet}
          disabled={busy}
        />

        {hasSheet ? (
          <>
            <PrimaryButton label="Open in Google Sheets" onPress={openSheet} variant="ghost" />
            <PrimaryButton label="Update link from URL" onPress={linkSheet} variant="ghost" />
            <PrimaryButton label="Unlink sheet (keep phone data)" onPress={removeSheet} variant="ghost" />
            <PrimaryButton
              label="Unlink & wipe phone data"
              onPress={wipeAll}
              variant="danger"
            />
          </>
        ) : (
          <>
            <PrimaryButton
              label="Link from URL"
              onPress={linkSheet}
              variant="ghost"
              disabled={busy}
            />
            <Text style={[styles.label, { marginTop: Spacing.md }]}>New spreadsheet name</Text>
            <TextInput
              value={sheetName}
              onChangeText={setSheetName}
              placeholder="AppCash Compras"
              placeholderTextColor={Palette.textDim}
              style={styles.input}
              autoCorrect={false}
            />
            <PrimaryButton
              label={busy ? 'Creating…' : 'Create purchase spreadsheet'}
              onPress={createSheet}
              variant="ghost"
              disabled={busy}
            />
          </>
        )}
      </GlassPanel>
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Palette.textMuted, fontSize: 13, marginBottom: Spacing.md, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { color: Palette.textDim, fontSize: 12, flex: 1 },
  label: { color: Palette.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontFamily: Fonts.body,
  },
});
