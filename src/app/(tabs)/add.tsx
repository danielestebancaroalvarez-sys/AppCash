import { useMemo, useState } from 'react';
import {
  Alert,
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
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nowIso, todayIsoDate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { upsertTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { parseReceiptWithGemini } from '@/lib/gemini/receipts';
import type { TransactionType } from '@/types/models';

export default function AddScreen() {
  const router = useRouter();
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const refresh = useFinanceStore((s) => s.refresh);
  const [mode, setMode] = useState<'expense' | 'income' | 'receipt'>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [userId, setUserId] = useState<string>(activeUserId ?? '');
  const [busy, setBusy] = useState(false);

  const filteredCats = useMemo(() => {
    const type = mode === 'income' ? 'income' : 'expense';
    return categories.filter((c) => c.type === type);
  }, [categories, mode]);

  const effectiveCategory = categoryId || filteredCats[0]?.id || '';
  const effectiveUser = userId || activeUserId || users[0]?.id || '';

  const saveQuick = async () => {
    const value = parseAmount(amount);
    if (!value || !effectiveUser || !effectiveCategory) {
      Alert.alert('Missing data', 'Enter an amount and select category/user.');
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
    Alert.alert('Saved', 'Entry added to your ledger.');
  };

  const scanReceipt = async (fromCamera: boolean) => {
    setBusy(true);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow camera/photos to scan receipts.');
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      let parsed;
      try {
        parsed = await parseReceiptWithGemini(uri);
      } catch (e) {
        Alert.alert(
          'Gemini parse',
          e instanceof Error ? e.message : 'Could not parse receipt',
          [
            {
              text: 'Enter manually',
              onPress: () =>
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
            },
            { text: 'OK' },
          ]
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

          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {filteredCats.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[styles.chip, effectiveCategory === c.id && { backgroundColor: c.color }]}>
                <Text
                  style={[
                    styles.chipText,
                    effectiveCategory === c.id && { color: Palette.void },
                  ]}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Who</Text>
          <View style={styles.chips}>
            {users.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => setUserId(u.id)}
                style={[styles.chip, effectiveUser === u.id && styles.chipOn]}>
                <Text style={[styles.chipText, effectiveUser === u.id && styles.chipTextOn]}>
                  {u.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <PrimaryButton label="Save entry" onPress={saveQuick} />
        </GlassPanel>
      ) : (
        <GlassPanel glow style={{ gap: Spacing.md }}>
          <Image
            source={require('../../../assets/images/android-icon-foreground.png')}
            style={styles.receiptArt}
          />
          <SectionTitle
            title="Scan supermarket receipt"
            subtitle="Gemini extracts line items from Woolworths / Aldi photos"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
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
  chipText: { color: Palette.textMuted, fontSize: 12 },
  chipTextOn: { color: Palette.void, fontWeight: '700' },
  receiptArt: { width: '100%', height: 140, borderRadius: Radii.md, opacity: 0.9 },
});
