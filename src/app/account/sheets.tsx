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
  unlinkSpreadsheetAndWipeLocal,
} from '@/lib/sync/engine';
import { loadGoogleSession } from '@/lib/google/auth';

export default function AccountSheetsScreen() {
  const session = useFinanceStore((s) => s.session);
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const refresh = useFinanceStore((s) => s.refresh);
  const runSync = useFinanceStore((s) => s.runSync);
  const setSession = useFinanceStore((s) => s.setSession);
  const { alert, confirm, Dialog } = useAppDialog();

  const [sheetInput, setSheetInput] = useState(session?.spreadsheetId ?? '');
  const [sheetName, setSheetName] = useState('AppCash');
  const [busy, setBusy] = useState(false);
  const hasSheet = Boolean(session?.spreadsheetId);

  useEffect(() => {
    setSheetInput(session?.spreadsheetId ?? '');
  }, [session?.spreadsheetId]);

  const onSync = async () => {
    if (!hasSheet) {
      alert('No sheet linked', 'Paste your Google Sheet URL below, or create one.');
      return;
    }
    setBusy(true);
    try {
      await runSync();
      alert('Sync', useFinanceStore.getState().syncMessage || 'Done');
    } finally {
      setBusy(false);
    }
  };

  const createSheet = async () => {
    if (!session?.accessToken) {
      alert('Google required', 'Sign in with Google first.');
      return;
    }
    const name = sheetName.trim() || 'AppCash';
    setBusy(true);
    try {
      const id = await createAndLinkSpreadsheet(name);
      if (id) {
        setSheetInput(id);
        const s = await loadGoogleSession();
        if (s) setSession(s);
        await refresh();
        alert(
          'Sheet ready',
          `"${name}" created with tabs Users, Categories, Fixed, Purchases, Savings plus _sys_ backups.`
        );
      }
    } catch (e) {
      alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const linkSheet = async () => {
    if (!session) {
      alert('Google required', 'Sign in with Google first.');
      return;
    }
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
      'Remove linked sheet?',
      'This unlinks Google Sheets and deletes ALL local data on this phone. Your Google file itself is not deleted.',
      async () => {
        setBusy(true);
        try {
          await unlinkSpreadsheetAndWipeLocal();
          const s = await loadGoogleSession();
          setSession(s);
          setSheetInput('');
          await refresh();
          alert('Unlinked', 'Sheet unlinked and local data cleared.');
        } catch (e) {
          alert('Error', e instanceof Error ? e.message : 'Failed');
        } finally {
          setBusy(false);
        }
      },
      { confirmLabel: 'Delete all data', tone: 'danger', cancelLabel: 'Keep' }
    );
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.lead}>
        Human tabs: Users, Categories, Fixed, Purchases, Savings. Tabs starting with _sys_
        are app backups — leave them alone. Sync once to create English tabs if you still see
        old Spanish names.
      </Text>

      <GlassPanel style={{ gap: Spacing.sm }}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: hasSheet ? Palette.teal : Palette.amber },
            ]}
          />
          <Text style={styles.status}>
            {hasSheet ? 'Sheet linked' : 'No sheet linked'}
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
          label={busy ? 'Working…' : hasSheet ? 'Sync now' : 'Link spreadsheet'}
          onPress={hasSheet ? onSync : linkSheet}
          disabled={busy}
        />

        {hasSheet ? (
          <>
            <PrimaryButton label="Open in Google Sheets" onPress={openSheet} variant="ghost" />
            <PrimaryButton label="Update link from URL" onPress={linkSheet} variant="ghost" />
            <PrimaryButton
              label="Remove sheet & wipe data"
              onPress={removeSheet}
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
              placeholder="AppCash"
              placeholderTextColor={Palette.textDim}
              style={styles.input}
              autoCorrect={false}
            />
            <PrimaryButton
              label={busy ? 'Creating…' : 'Create spreadsheet'}
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
