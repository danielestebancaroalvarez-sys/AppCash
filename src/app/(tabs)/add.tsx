import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { PrimaryButton } from '@/components/ui/Primitives';
import { CategoryChipRow } from '@/components/ui/CategoryChip';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { createId } from '@/lib/id';
import { formatDisplayDate, nowIso, todayIsoDate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { upsertTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { parseReceiptImage, type ReceiptScanProgress } from '@/lib/ai/receipts';
import type { TransactionType } from '@/types/models';

type AddMode = 'expense' | 'income' | 'receipt';

const MODES: Array<{
  id: AddMode;
  label: string;
  hint: string;
  ion: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  {
    id: 'expense',
    label: 'Expense',
    hint: 'Money out',
    ion: 'arrow-down-circle-outline',
    color: Palette.coral,
  },
  {
    id: 'income',
    label: 'Income',
    hint: 'Money in',
    ion: 'arrow-up-circle-outline',
    color: Palette.teal,
  },
  {
    id: 'receipt',
    label: 'Receipt',
    hint: 'Scan AI',
    ion: 'scan-outline',
    color: '#5B8CFF',
  },
];

export default function AddScreen() {
  const router = useRouter();
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const session = useFinanceStore((s) => s.session);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, confirm, Dialog } = useAppDialog();
  const { refreshing, onRefresh } = useSheetRefresh();
  const [mode, setMode] = useState<AddMode>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState<ReceiptScanProgress | null>(null);
  const [txDate, setTxDate] = useState(todayIsoDate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const modeMeta = MODES.find((m) => m.id === mode)!;

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

  useEffect(() => {
    // Reset to today when switching expense/income
    if (mode !== 'receipt') setTxDate(todayIsoDate());
  }, [mode]);

  const onDateChange = (_event: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!date) return;
    const iso = format(date, 'yyyy-MM-dd');
    const today = todayIsoDate();
    setTxDate(iso > today ? today : iso);
  };

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

    const today = todayIsoDate();
    const dateIso = txDate > today ? today : txDate || today;

    const type: TransactionType = mode === 'income' ? 'income_sporadic' : 'expense_sporadic';
    const tx = {
      id: createId(),
      user_id: effectiveUser,
      type,
      category_id: effectiveCategory,
      amount_aud: value,
      date: dateIso,
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
    setTxDate(todayIsoDate());
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
        ? await ImagePicker.launchCameraAsync({ quality: 0.45, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.45, allowsEditing: false });
      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      setAnalyzing(true);
      setScanProgress({
        stage: 'prepare',
        message: 'Preparing photo for AI scan…',
      });
      let parsed;
      try {
        parsed = await parseReceiptImage(uri, { onProgress: setScanProgress });
      } catch (e) {
        setAnalyzing(false);
        setScanProgress(null);
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
      setAnalyzing(false);
      setScanProgress(null);
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View style={[styles.heroIcon, { backgroundColor: `${modeMeta.color}22` }]}>
          <Ionicons name={modeMeta.ion} size={28} color={modeMeta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Capture</Text>
          <Text style={styles.title}>
            {mode === 'expense'
              ? 'Add expense'
              : mode === 'income'
                ? 'Add income'
                : 'Scan receipt'}
          </Text>
          <Text style={styles.sub}>
            {mode === 'expense'
              ? 'Log a one-off spend in AUD'
              : mode === 'income'
                ? 'Log sporadic income for the household'
                : 'Photo → line items with AI'}
          </Text>
        </View>
      </View>

      {session ? (
        <View style={styles.signedInRow}>
          <UserAvatar
            photoUrl={session.photoUrl}
            name={session.name}
            size={22}
          />
          <Text style={styles.signedIn}>Signed in as {session.name}</Text>
        </View>
      ) : null}

      <View style={styles.modes}>
        {MODES.map((m) => {
          const on = mode === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => setMode(m.id)}
              style={[
                styles.modeCard,
                on && { borderColor: m.color, backgroundColor: `${m.color}18` },
              ]}>
              <View style={[styles.modeIcon, { backgroundColor: `${m.color}28` }]}>
                <Ionicons name={m.ion} size={20} color={m.color} />
              </View>
              <Text style={[styles.modeLabel, on && { color: Palette.text }]}>{m.label}</Text>
              <Text style={styles.modeHint}>{m.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode !== 'receipt' ? (
        <>
          <Section
            accent={modeMeta.color}
            icon="cash-outline"
            title="Amount"
            hint="How much in Australian dollars?">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Palette.textDim}
              style={[styles.input, styles.amountInput]}
            />
          </Section>

          <Section
            accent={Palette.amber}
            icon="storefront-outline"
            title="Where & note"
            hint="Merchant and optional context">
            <Text style={styles.fieldLabel}>Merchant / source</Text>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder={mode === 'income' ? 'Employer, side hustle…' : 'Woolworths, Aldi…'}
              placeholderTextColor={Palette.textDim}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional details"
              placeholderTextColor={Palette.textDim}
              style={styles.input}
            />
          </Section>

          <Section
            accent={Palette.violet}
            icon="pricetags-outline"
            title="Category"
            hint={`Pick a ${mode} category`}
            action={
              <Pressable onPress={() => router.push('/categories' as never)}>
                <Text style={[styles.link, { color: Palette.violet }]}>Manage</Text>
              </Pressable>
            }>
            {filteredCats.length === 0 ? (
              <Pressable
                onPress={() => router.push('/categories' as never)}
                style={styles.emptyBox}>
                <Ionicons name="alert-circle-outline" size={18} color={Palette.amber} />
                <Text style={styles.emptyText}>
                  No {mode} categories yet. Tap to create one.
                </Text>
              </Pressable>
            ) : (
              <CategoryChipRow
                categories={filteredCats}
                selectedId={effectiveCategory}
                onSelect={setCategoryId}
              />
            )}
          </Section>

          <Section
            accent={Palette.cyan}
            icon="people-outline"
            title="Who"
            hint="Which household profile paid or received this?">
            {users.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="person-outline" size={18} color={Palette.amber} />
                <Text style={styles.emptyText}>
                  No profiles yet. Add people in Account.
                </Text>
              </View>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}>
              {users.map((u) => {
                const selected = effectiveUser === u.id;
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => setUserId(u.id)}
                    style={[
                      styles.personChip,
                      selected && {
                        backgroundColor: 'rgba(61,231,255,0.18)',
                        borderColor: Palette.cyan,
                      },
                    ]}>
                    <UserAvatar user={u} size={28} selected={selected} />
                    <Text
                      style={[
                        styles.personName,
                        selected && { color: Palette.text, fontWeight: '700' },
                      ]}>
                      {u.name || 'User'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            )}
          </Section>

          <Section
            accent={Palette.teal}
            icon="calendar-outline"
            title="Date"
            hint="Today or any past day — future dates are blocked">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => [styles.dateBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.dateValue}>{formatDisplayDate(txDate)}</Text>
              <Text style={styles.dateHint}>Tap to change · {txDate}</Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={parseISO(`${txDate}T12:00:00`)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={onDateChange}
                themeVariant="dark"
              />
            ) : null}
            {Platform.OS === 'ios' && showDatePicker ? (
              <PrimaryButton
                label="Done with date"
                onPress={() => setShowDatePicker(false)}
                variant="ghost"
              />
            ) : null}
          </Section>

          <Pressable
            onPress={saveQuick}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: modeMeta.color },
              pressed && { opacity: 0.9 },
            ]}>
            <Ionicons
              name={mode === 'income' ? 'checkmark-circle' : 'cart'}
              size={20}
              color={Palette.void}
            />
            <Text style={styles.saveLabel}>
              {mode === 'income' ? 'Save income' : 'Save expense'}
            </Text>
          </Pressable>
        </>
      ) : (
        <Section
          accent={modeMeta.color}
          icon="receipt-outline"
          title="Supermarket receipt"
          hint="AI reads Woolworths / Aldi photos into line items">
          <View style={styles.receiptHero}>
            <View style={[styles.receiptBlob, { backgroundColor: `${modeMeta.color}22` }]}>
              <Ionicons name="camera-outline" size={42} color={modeMeta.color} />
            </View>
            <Text style={styles.receiptCopy}>
              Take a clear photo of the full receipt. Review totals before saving.
            </Text>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => scanReceipt(true)}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: modeMeta.color },
              (pressed || busy) && { opacity: 0.85 },
            ]}>
            <Ionicons name="camera" size={20} color={Palette.void} />
            <Text style={styles.saveLabel}>{analyzing ? 'Reading…' : 'Take photo'}</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => scanReceipt(false)}
            style={({ pressed }) => [
              styles.ghostBtn,
              { borderColor: modeMeta.color },
              (pressed || busy) && { opacity: 0.85 },
            ]}>
            <Ionicons name="images-outline" size={18} color={modeMeta.color} />
            <Text style={[styles.ghostLabel, { color: modeMeta.color }]}>
              {analyzing ? 'Reading…' : 'Choose from gallery'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/receipts' as never)}
            style={styles.viewReceipts}>
            <Ionicons name="folder-open-outline" size={16} color={Palette.cyan} />
            <Text style={styles.viewReceiptsText}>View saved receipts</Text>
          </Pressable>
        </Section>
      )}

      <Modal visible={analyzing} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.analyzingOverlay}>
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="large" color={Palette.cyan} />
            <Text style={styles.analyzingTitle}>
              {scanProgress?.stage === 'fallback'
                ? 'Trying next option…'
                : scanProgress?.stage === 'done'
                  ? 'Done'
                  : 'Reading receipt…'}
            </Text>
            {scanProgress?.provider ? (
              <View style={styles.analyzingProviderRow}>
                <View
                  style={[
                    styles.analyzingProviderDot,
                    {
                      backgroundColor:
                        scanProgress.provider === 'gemini'
                          ? Palette.amber
                          : scanProgress.provider === 'nvidia'
                            ? Palette.teal
                            : Palette.cyan,
                    },
                  ]}
                />
                <Text style={styles.analyzingProvider}>
                  {scanProgress.provider === 'gemini'
                    ? 'Gemini'
                    : scanProgress.provider === 'nvidia'
                      ? 'NVIDIA'
                      : 'OpenRouter'}
                  {scanProgress.model ? ` · ${scanProgress.model.split('/').pop()}` : ''}
                </Text>
              </View>
            ) : null}
            <Text style={styles.analyzingHint}>
              {scanProgress?.message || 'AI is extracting store, date and line items'}
            </Text>
            <Text style={styles.analyzingMeta}>
              {scanProgress?.stage === 'prepare'
                ? 'Optimizing photo before upload'
                : scanProgress?.attempt && scanProgress.totalAttempts
                  ? `Model ${scanProgress.attempt} of ${scanProgress.totalAttempts}`
                  : 'Cascade: Gemini → NVIDIA → OpenRouter'}
            </Text>
          </View>
        </View>
      </Modal>

      {Dialog}
    </Screen>
  );
}

function Section({
  title,
  hint,
  accent,
  icon,
  action,
  children,
}: {
  title: string;
  hint?: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, { borderColor: `${accent}55` }]}>
      <View style={[styles.sectionBar, { backgroundColor: accent }]} />
      <View style={styles.sectionBody}>
        <View style={styles.sectionHead}>
          <View style={[styles.sectionIcon, { backgroundColor: `${accent}22` }]}>
            <Ionicons name={icon} size={16} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: accent }]}>{title}</Text>
            {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
          </View>
          {action}
        </View>
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: Palette.cyan,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '800',
  },
  sub: { color: Palette.textMuted, fontSize: 13, marginTop: 2 },
  signedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  signedIn: { color: Palette.textDim, fontSize: 12, flexShrink: 1 },
  modes: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  modeCard: {
    flex: 1,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panel,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabel: {
    color: Palette.textMuted,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 13,
  },
  modeHint: { color: Palette.textDim, fontSize: 10 },
  section: {
    flexDirection: 'row',
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  sectionBar: { width: 4 },
  sectionBody: { flex: 1, padding: Spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontFamily: Fonts.display, fontWeight: '800', fontSize: 14 },
  sectionHint: { color: Palette.textDim, fontSize: 11, marginTop: 1 },
  fieldLabel: { color: Palette.textMuted, fontSize: 12 },
  dateBtn: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Palette.panelElevated,
    gap: 2,
  },
  dateValue: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 16,
  },
  dateHint: { color: Palette.cyan, fontSize: 12 },
  link: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontSize: 16,
  },
  amountInput: {
    fontSize: 28,
    fontFamily: Fonts.display,
    fontWeight: '800',
    paddingVertical: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsScroll: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panelElevated,
  },
  catIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: { color: Palette.textMuted, fontSize: 13 },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panelElevated,
  },
  personName: { color: Palette.textMuted, fontSize: 13 },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    padding: Spacing.md,
    backgroundColor: Palette.panelElevated,
  },
  emptyText: { color: Palette.amber, fontSize: 13, lineHeight: 18, flex: 1 },
  saveBtn: {
    height: 52,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  saveLabel: {
    color: Palette.void,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 15,
  },
  ghostBtn: {
    height: 48,
    borderRadius: Radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  ghostLabel: { fontFamily: Fonts.display, fontWeight: '800', fontSize: 14 },
  viewReceipts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
  },
  viewReceiptsText: { color: Palette.cyan, fontWeight: '700', fontSize: 13 },
  analyzingOverlay: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  analyzingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.stroke,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  analyzingTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 17,
    marginTop: Spacing.sm,
  },
  analyzingProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  analyzingProviderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  analyzingProvider: {
    color: Palette.text,
    fontWeight: '700',
    fontSize: 13,
  },
  analyzingHint: {
    color: Palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  analyzingMeta: {
    color: Palette.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  receiptHero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  receiptBlob: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCopy: {
    color: Palette.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: Spacing.sm,
  },
});
