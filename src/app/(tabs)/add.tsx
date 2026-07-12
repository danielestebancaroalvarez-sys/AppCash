import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nowIso, todayIsoDate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { upsertTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { parseReceiptImage } from '@/lib/ai/receipts';
import type { TransactionType } from '@/types/models';

export default function AddScreen() {
  const router = useRouter();
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const session = useFinanceStore((s) => s.session);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, confirm, Dialog } = useAppDialog();
  const [mode, setMode] = useState<'expense' | 'income' | 'receipt'>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setCategoryId('');
  }, [mode]);

  const filteredCats = useMemo(() => {
    const type = mode === 'income' ? 'income' : 'expense';
    return categories.filter((c) => c.type === type);
  }, [categories, mode]);

  const effectiveCategory = categoryId || filteredCats[0]?.id || '';
  const effectiveUser = userId || activeUserId || users[0]?.id || '';

  useEffect(() => {
    if (!userId && effectiveUser) setUserId(effectiveUser);
  }, [effectiveUser, userId]);

  useEffect(() => {
    if (!categoryId && filteredCats[0]?.id) setCategoryId(filteredCats[0].id);
  }, [filteredCats, categoryId]);

  const saveQuick = async () => {
    const value = parseAmount(amount);
    if (!value) {
      alert('Missing amount', 'Enter an amount in AUD.');
      return;
    }
    if (!effectiveUser) {
      alert(
        'No profile',
        'No household profiles found. Open Profile and stay signed in, or pull to refresh.'
      );
      return;
    }
    if (!effectiveCategory) {
      confirm(
        'No category',
        'Create a category in Settings → Categories, then try again.',
        () => router.push('/categories' as never),
        { confirmLabel: 'Open categories', cancelLabel: 'OK' }
      );
      return;
    }

    const type: TransactionType = mode === 'income' ? 'income_sporadic' : 'expense_sporadic';
    const tx = {
      id: createId(),
      user_id: effectiveUser,
      type,
      category_id: effectiveCategory,
      amount_aud: value,
      date: todayIsoDate(),
      note,
      merchant,
      receipt_id: '',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertTransaction(tx);
    await queueMutation('transactions', tx);
    await refresh();
    setAmount('');
    setNote('');
    setMerchant('');
    alert('Saved', `${mode === 'income' ? 'Income' : 'Expense'} of $${value.toFixed(2)} AUD added.`);
  };

  const scanReceipt = async (fromCamera: boolean) => {
    setBusy(true);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('Permission needed', 'Allow camera/photos to scan receipts.');
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      let parsed;
      try {
        parsed = await parseReceiptImage(uri);
      } catch (e) {
        confirm(
          'Receipt scan',
          e instanceof Error ? e.message : 'Could not parse receipt',
          () =>
            router.push({
              pathname: '/receipt/review' as never,
              params: {
                photoUri: uri,
                draft: JSON.stringify({
                  store: merchant || 'Supermarket',
                  purchased_at: todayIsoDate(),
                  total_aud: 0,
                  items: [],
                }),
              },
            }),
          { confirmLabel: 'Enter manually', cancelLabel: 'OK' }
        );
        return;
      }

      router.push({
        pathname: '/receipt/review' as never,
        params: {
          photoUri: uri,
          draft: JSON.stringify(parsed),
        },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Quick add</Text>
      {session ? (
        <Text style={styles.hint}>Signed in as {session.name}</Text>
      ) : null}

      <View style={styles.modes}>
        {(['expense', 'income', 'receipt'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.mode, mode === m && styles.modeOn]}>
            <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
              {m === 'expense' ? 'Expense' : m === 'income' ? 'Income' : 'Receipt scan'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode !== 'receipt' ? (
        <GlassPanel style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Amount (AUD)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Palette.textDim}
            style={styles.input}
          />
          <Text style={styles.label}>Merchant</Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Woolworths, Aldi…"
            placeholderTextColor={Palette.textDim}
            style={styles.input}
          />
          <Text style={styles.label}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={Palette.textDim}
            style={styles.input}
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Category</Text>
            <Pressable onPress={() => router.push('/categories' as never)}>
              <Text style={styles.link}>Manage</Text>
            </Pressable>
          </View>
          {filteredCats.length === 0 ? (
            <Pressable
              onPress={() => router.push('/categories' as never)}
              style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No {mode} categories yet. Tap to create one.
              </Text>
            </Pressable>
          ) : (
            <View style={styles.chips}>
              {filteredCats.map((c) => {
                const selected = effectiveCategory === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategoryId(c.id)}
                    style={[styles.chip, selected && { backgroundColor: c.color, borderColor: c.color }]}>
                    <Text style={[styles.chipText, selected && { color: Palette.void, fontWeight: '700' }]}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Who</Text>
          {users.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No profiles yet. Pull to refresh or reopen the app.</Text>
            </View>
          ) : (
            <View style={styles.chips}>
              {users.map((u) => {
                const selected = effectiveUser === u.id;
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => setUserId(u.id)}
                    style={[styles.chip, selected && styles.chipOn]}>
                    <Text style={[styles.chipText, selected && styles.chipTextOn]}>{u.name || 'User'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <PrimaryButton
            label={mode === 'income' ? 'Save income' : 'Save expense'}
            onPress={saveQuick}
          />
        </GlassPanel>
      ) : (
        <GlassPanel glow style={{ gap: Spacing.md }}>
          <Image
            source={require('../../../assets/images/android-icon-foreground.png')}
            style={styles.receiptArt}
          />
          <SectionTitle
            title="Scan supermarket receipt"
            subtitle="AI extracts line items from Woolworths / Aldi photos"
          />
          <PrimaryButton
            label={busy ? 'Reading…' : 'Take photo'}
            onPress={() => scanReceipt(true)}
            disabled={busy}
          />
          <PrimaryButton
            label="Choose from gallery"
            variant="ghost"
            onPress={() => scanReceipt(false)}
            disabled={busy}
          />
        </GlassPanel>
      )}
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
    marginBottom: 4,
  },
  hint: { color: Palette.textDim, marginBottom: Spacing.md, fontSize: 12 },
  modes: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  mode: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
    alignItems: 'center',
    backgroundColor: Palette.panel,
  },
  modeOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  modeText: { color: Palette.textMuted, fontSize: 12, fontWeight: '700' },
  modeTextOn: { color: Palette.void },
  label: { color: Palette.textMuted, fontSize: 12 },
  link: { color: Palette.cyan, fontSize: 12, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
    minWidth: 72,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  chipText: { color: Palette.textMuted, fontSize: 13 },
  chipTextOn: { color: Palette.void, fontWeight: '700' },
  emptyBox: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    padding: Spacing.md,
    backgroundColor: Palette.panelElevated,
  },
  emptyText: { color: Palette.amber, fontSize: 13, lineHeight: 18 },
  receiptArt: { width: '100%', height: 140, borderRadius: Radii.md, opacity: 0.9 },
});
