import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import {
  getDeepSeekApiKey,
  getGeminiApiKey,
  getOpenRouterApiKey,
  getOcrSpaceApiKey,
  getReceiptProvider,
  setDeepSeekApiKey,
  setGeminiApiKey,
  setOpenRouterApiKey,
  setOcrSpaceApiKey,
  setReceiptProvider,
  type ReceiptAiProvider,
} from '@/lib/ai/receipts';
import {
  createAndLinkSpreadsheet,
  getSpreadsheetOpenUrl,
  linkSpreadsheetFromInput,
  unlinkSpreadsheetAndWipeLocal,
} from '@/lib/sync/engine';
import { recomputeProductStats } from '@/lib/insights/market';
import { scheduleFixedItemReminders } from '@/lib/notifications/schedule';
import { loadGoogleSession } from '@/lib/google/auth';

const PROVIDERS: Array<{ id: ReceiptAiProvider; label: string; hint: string }> = [
  {
    id: 'openrouter',
    label: 'OpenRouter (free)',
    hint: 'Best free option — vision models. openrouter.ai',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    hint: 'OCR.space (free) + DeepSeek text. platform.deepseek.com',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    hint: 'Google AI Studio — if your quota still works',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const session = useFinanceStore((s) => s.session);
  const lastSyncAt = useFinanceStore((s) => s.lastSyncAt);
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const refresh = useFinanceStore((s) => s.refresh);
  const runSync = useFinanceStore((s) => s.runSync);
  const setSession = useFinanceStore((s) => s.setSession);
  const { alert, confirm, Dialog } = useAppDialog();
  const { refreshing, onRefresh } = useSheetRefresh();

  const [provider, setProvider] = useState<ReceiptAiProvider>('openrouter');
  const [openrouter, setOpenrouter] = useState('');
  const [deepseek, setDeepseek] = useState('');
  const [gemini, setGemini] = useState('');
  const [ocrSpace, setOcrSpace] = useState('');
  const [sheetInput, setSheetInput] = useState(session?.spreadsheetId ?? '');
  const [busy, setBusy] = useState(false);

  const hasSheet = Boolean(session?.spreadsheetId);

  useEffect(() => {
    void (async () => {
      setProvider(await getReceiptProvider());
      setOpenrouter(await getOpenRouterApiKey());
      setDeepseek(await getDeepSeekApiKey());
      setGemini(await getGeminiApiKey());
      const ocr = await getOcrSpaceApiKey();
      setOcrSpace(ocr === 'helloworld' ? '' : ocr);
    })();
  }, []);

  useEffect(() => {
    setSheetInput(session?.spreadsheetId ?? '');
  }, [session?.spreadsheetId]);

  const saveAi = async () => {
    await setReceiptProvider(provider);
    await setOpenRouterApiKey(openrouter);
    await setDeepSeekApiKey(deepseek);
    await setGeminiApiKey(gemini);
    if (ocrSpace.trim()) await setOcrSpaceApiKey(ocrSpace);
    alert('Saved', `Receipt AI provider: ${provider}`);
  };

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
      alert('Google required', 'Sign in with Google from Profile / Login.');
      return;
    }
    setBusy(true);
    try {
      const id = await createAndLinkSpreadsheet();
      if (id) {
        setSheetInput(id);
        const s = await loadGoogleSession();
        if (s) setSession(s);
        await refresh();
        alert('Sheet ready', 'Created editable tabs (Usuarios, Categorias, Gastos_fijos, Compras, Ahorros) plus _sys_ backups.');
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
      'This unlinks Google Sheets and deletes ALL local data on this phone (transactions, savings, receipts…). Your Google file itself is not deleted. Defaults will be restored.',
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

  const onInsights = async () => {
    await recomputeProductStats();
    await refresh();
    router.push('/insights' as never);
  };

  const onNotify = async () => {
    const n = await scheduleFixedItemReminders();
    await refresh();
    alert('Reminders', `Scheduled ${n} manual payment reminders.`);
  };

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>
        {session?.email ?? 'Not signed in'} · Last sync:{' '}
        {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}
        {' · '}pull to sync Sheet
      </Text>

      <SectionTitle
        title="Google Sheets"
        subtitle="Edit freely: Usuarios, Categorias, Gastos_fijos, Compras, Ahorros. Tabs starting with _sys_ are app backups — leave them alone."
      />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <Text style={styles.meta}>
          {syncMessage ||
            (hasSheet
              ? 'Sheet linked — Sync updates your editable tabs and system backups.'
              : 'Paste the full Sheet URL to link, or create a new one.')}
        </Text>
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
              variant="ghost"
            />
          </>
        ) : (
          <>
            <PrimaryButton label="Link from URL" onPress={linkSheet} variant="ghost" disabled={busy} />
            <PrimaryButton
              label="Create AppCash spreadsheet"
              onPress={createSheet}
              variant="ghost"
              disabled={busy}
            />
          </>
        )}
      </GlassPanel>

      <SectionTitle title="Fixed & categories" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <PrimaryButton
          label="Manage fixed income & bills"
          onPress={() => router.push('/fixed' as never)}
        />
        <PrimaryButton
          label="Categories"
          onPress={() => router.push('/categories' as never)}
          variant="ghost"
        />
        <PrimaryButton label="Schedule payment notifications" onPress={onNotify} variant="ghost" />
      </GlassPanel>

      <SectionTitle title="Market prediction" />
      <GlassPanel>
        <PrimaryButton label="Open market insights" onPress={onInsights} />
      </GlassPanel>

      <SectionTitle
        title="Receipt AI"
        subtitle="DeepSeek is text-only — we OCR the photo first. OpenRouter can read images directly."
      />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <View style={styles.chips}>
          {PROVIDERS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setProvider(p.id)}
              style={[styles.chip, provider === p.id && styles.chipOn]}>
              <Text style={[styles.chipText, provider === p.id && styles.chipTextOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.meta}>{PROVIDERS.find((p) => p.id === provider)?.hint}</Text>

        {provider === 'openrouter' ? (
          <TextInput
            value={openrouter}
            onChangeText={setOpenrouter}
            placeholder="OpenRouter API key (sk-or-…)"
            placeholderTextColor={Palette.textDim}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        ) : null}

        {provider === 'deepseek' ? (
          <>
            <TextInput
              value={deepseek}
              onChangeText={setDeepseek}
              placeholder="DeepSeek API key (sk-…)"
              placeholderTextColor={Palette.textDim}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={ocrSpace}
              onChangeText={setOcrSpace}
              placeholder="OCR.space key (optional — free at ocr.space)"
              placeholderTextColor={Palette.textDim}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
          </>
        ) : null}

        {provider === 'gemini' ? (
          <TextInput
            value={gemini}
            onChangeText={setGemini}
            placeholder="Gemini API key"
            placeholderTextColor={Palette.textDim}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        ) : null}

        <PrimaryButton label="Save receipt AI settings" onPress={saveAi} />
      </GlassPanel>

      <View style={{ height: Spacing.lg }} />
      {Dialog}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  chipOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  chipText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: Palette.void },
});
