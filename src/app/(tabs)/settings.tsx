import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { setGeminiApiKey, getGeminiApiKey } from '@/lib/gemini/receipts';
import { ensureSpreadsheet, pushFullSnapshot, syncNow } from '@/lib/sync/engine';
import { exportTransactionsExcel, importTransactionsFromExcelBase64 } from '@/lib/excel/io';
import { recomputeProductStats } from '@/lib/insights/market';
import { scheduleFixedItemReminders } from '@/lib/notifications/schedule';
import { saveGoogleSession, loadGoogleSession } from '@/lib/google/auth';

export default function SettingsScreen() {
  const router = useRouter();
  const session = useFinanceStore((s) => s.session);
  const lastSyncAt = useFinanceStore((s) => s.lastSyncAt);
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const refresh = useFinanceStore((s) => s.refresh);
  const runSync = useFinanceStore((s) => s.runSync);
  const setSession = useFinanceStore((s) => s.setSession);
  const [gemini, setGemini] = useState('');
  const [sheetId, setSheetId] = useState(session?.spreadsheetId ?? '');
  const [busy, setBusy] = useState(false);

  const saveKey = async () => {
    await setGeminiApiKey(gemini);
    Alert.alert('Saved', 'Gemini API key stored securely on device.');
  };

  const loadKey = async () => {
    setGemini(await getGeminiApiKey());
  };

  const onSync = async () => {
    setBusy(true);
    try {
      await runSync();
      Alert.alert('Sync', useFinanceStore.getState().syncMessage || 'Done');
    } finally {
      setBusy(false);
    }
  };

  const createSheet = async () => {
    if (!session?.accessToken) {
      Alert.alert('Google required', 'Sign in with Google from Profile / Login.');
      return;
    }
    setBusy(true);
    try {
      const id = await ensureSpreadsheet();
      if (id) {
        setSheetId(id);
        const s = await loadGoogleSession();
        if (s) setSession({ ...s, spreadsheetId: id });
        await pushFullSnapshot();
        await refresh();
        Alert.alert('Sheet ready', `Spreadsheet ID:\n${id}`);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const linkSheet = async () => {
    if (!session || !sheetId.trim()) return;
    const next = { ...session, spreadsheetId: sheetId.trim() };
    await saveGoogleSession(next);
    setSession(next);
    const result = await syncNow();
    await refresh();
    Alert.alert('Linked', result.message);
  };

  const onExport = async () => {
    const path = await exportTransactionsExcel();
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export AppCash',
      });
    } else {
      Alert.alert('Exported', path);
    }
  };

  const onImport = async () => {
    const file = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ],
      copyToCacheDirectory: true,
    });
    if (file.canceled || !file.assets?.[0]) return;
    const b64 = await FileSystem.readAsStringAsync(file.assets[0].uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const count = await importTransactionsFromExcelBase64(b64);
    await refresh();
    Alert.alert('Import complete', `${count} transactions imported.`);
  };

  const onInsights = async () => {
    await recomputeProductStats();
    await refresh();
    router.push('/insights' as never);
  };

  const onNotify = async () => {
    const n = await scheduleFixedItemReminders();
    await refresh();
    Alert.alert('Reminders', `Scheduled ${n} manual payment reminders.`);
  };

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>
        {session?.email ?? 'Not signed in'} · Last sync:{' '}
        {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}
      </Text>

      <SectionTitle title="Google Sheets" subtitle="Source of truth for household data" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <Text style={styles.meta}>{syncMessage || 'Pull / push every ~45s while open.'}</Text>
        <TextInput
          value={sheetId}
          onChangeText={setSheetId}
          placeholder="Spreadsheet ID"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
          autoCapitalize="none"
        />
        <PrimaryButton label={busy ? 'Working…' : 'Sync now'} onPress={onSync} disabled={busy} />
        <PrimaryButton label="Create AppCash spreadsheet" onPress={createSheet} variant="ghost" />
        <PrimaryButton label="Link spreadsheet ID" onPress={linkSheet} variant="ghost" />
      </GlassPanel>

      <SectionTitle title="Fixed & categories" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <PrimaryButton label="Manage fixed income & bills" onPress={() => router.push('/fixed' as never)} />
        <PrimaryButton label="Categories" onPress={() => router.push('/categories' as never)} variant="ghost" />
        <PrimaryButton label="Schedule payment notifications" onPress={onNotify} variant="ghost" />
      </GlassPanel>

      <SectionTitle title="Market prediction" />
      <GlassPanel>
        <PrimaryButton label="Recompute & open insights" onPress={onInsights} />
      </GlassPanel>

      <SectionTitle title="Gemini receipts" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <TextInput
          value={gemini}
          onChangeText={setGemini}
          placeholder="Gemini API key"
          placeholderTextColor={Palette.textDim}
          secureTextEntry
          autoCapitalize="none"
          style={styles.input}
          onFocus={loadKey}
        />
        <PrimaryButton label="Save API key" onPress={saveKey} variant="ghost" />
      </GlassPanel>

      <SectionTitle title="Excel bridge" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <PrimaryButton label="Import Excel / CSV" onPress={onImport} />
        <PrimaryButton label="Export Excel" onPress={onExport} variant="ghost" />
      </GlassPanel>

      <View style={{ height: Spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
  },
  sub: { color: Palette.textMuted, marginBottom: Spacing.md, marginTop: 4, fontSize: 12 },
  meta: { color: Palette.textDim, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
  },
});
