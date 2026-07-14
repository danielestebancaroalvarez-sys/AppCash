import { useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addWeeks, format } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel } from '@/components/ui/Primitives';
import { EmptyState } from '@/components/ui/EmptyState';
import { UiImages } from '@/constants/ui-images';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { categoryIonicon, merchantIonicon } from '@/constants/category-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { formatAud } from '@/lib/money';
import { getWeekRange, inRange, normalizeReceiptDate } from '@/lib/dates';
import { deleteTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { exportTransactionsCsv } from '@/lib/excel/io';
import { isPurchaseLevelTransaction } from '@/lib/purchases/filter';
import type { Transaction, TransactionType } from '@/types/models';

type TypeFilter = 'all' | 'expense' | 'income';
type PeriodFilter = 'this_week' | 'last_week' | 'custom' | 'all';

function isIncome(type: TransactionType): boolean {
  return type === 'income_sporadic';
}

function isExpense(type: TransactionType): boolean {
  return (
    type === 'expense_sporadic' ||
    type === 'variable' ||
    type === 'fixed' ||
    type === 'savings_contrib'
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const transactions = useFinanceStore((s) => s.transactions);
  const receipts = useFinanceStore((s) => s.receipts);
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, confirm, Dialog } = useAppDialog();
  const { refreshing, onRefresh } = useSheetRefresh();

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [userId, setUserId] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [includeSavings, setIncludeSavings] = useState(true);
  const [sortNewest, setSortNewest] = useState(true);

  const thisWeek = getWeekRange(new Date());
  const lastWeek = getWeekRange(addWeeks(new Date(), -1));
  const [customStart, setCustomStart] = useState(thisWeek.start);
  const [customEnd, setCustomEnd] = useState(thisWeek.end);
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const [picker, setPicker] = useState<'category' | 'user' | null>(null);
  const [exporting, setExporting] = useState(false);

  const periodLabel =
    period === 'this_week'
      ? 'this week'
      : period === 'last_week'
        ? 'last week'
        : period === 'custom'
          ? 'custom range'
          : 'all time';

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const min = minAmount.trim() ? Number(minAmount) : null;
    const max = maxAmount.trim() ? Number(maxAmount) : null;

    let start: Date | null = null;
    let end: Date | null = null;
    if (period === 'this_week') {
      start = thisWeek.start;
      end = thisWeek.end;
    } else if (period === 'last_week') {
      start = lastWeek.start;
      end = lastWeek.end;
    } else if (period === 'custom') {
      start = customStart;
      end = customEnd;
    }

    const filtered = transactions.filter((t) => {
      if (!isPurchaseLevelTransaction(t)) return false;
      if (typeFilter === 'income' && !isIncome(t.type)) return false;
      if (typeFilter === 'expense' && !isExpense(t.type)) return false;
      if (!includeSavings && t.type === 'savings_contrib') return false;
      if (categoryId !== 'all' && t.category_id !== categoryId) return false;
      if (userId !== 'all' && t.user_id !== userId) return false;
      if (start && end && !inRange(normalizeReceiptDate(t.date), start, end)) return false;
      if (min != null && !Number.isNaN(min) && t.amount_aud < min) return false;
      if (max != null && !Number.isNaN(max) && t.amount_aud > max) return false;
      if (!query) return true;
      const user = users.find((u) => u.id === t.user_id)?.name ?? '';
      const cat = categories.find((c) => c.id === t.category_id)?.name ?? '';
      return [t.note, t.merchant, t.type, user, cat, String(t.amount_aud)]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    // One row per receipt purchase + unique ids (avoid duplicate React keys)
    const seenReceipts = new Set<string>();
    const seenIds = new Set<string>();
    const deduped: Transaction[] = [];
    for (const t of filtered) {
      if (seenIds.has(t.id)) continue;
      if (t.receipt_id) {
        if (seenReceipts.has(t.receipt_id)) continue;
        seenReceipts.add(t.receipt_id);
      }
      // Also mark synthetic id form so orphan receipt injection won't clash
      if (t.receipt_id) seenIds.add(`tx_${t.receipt_id}`);
      seenIds.add(t.id);
      deduped.push(t);
    }

    // Ensure scanned receipts appear even if parent tx was wiped by a bad sync
    if (typeFilter !== 'income') {
      for (const r of receipts) {
        const date = normalizeReceiptDate(r.purchased_at);
        const synthId = `tx_${r.id}`;
        if (seenReceipts.has(r.id) || seenIds.has(synthId) || seenIds.has(r.id)) continue;
        if (start && end && !inRange(date, start, end)) continue;
        if (userId !== 'all' && r.user_id !== userId) continue;
        if (min != null && !Number.isNaN(min) && r.total_aud < min) continue;
        if (max != null && !Number.isNaN(max) && r.total_aud > max) continue;
        if (
          query &&
          ![r.store, String(r.total_aud)].join(' ').toLowerCase().includes(query)
        ) {
          continue;
        }
        seenReceipts.add(r.id);
        seenIds.add(synthId);
        deduped.push({
          id: synthId,
          user_id: r.user_id,
          type: 'expense_sporadic',
          category_id: categories.find((c) => c.name.toLowerCase() === 'groceries')?.id ?? '',
          amount_aud: r.total_aud,
          date,
          note: `Receipt ${r.store}`,
          merchant: r.store || 'Receipt',
          receipt_id: r.id,
          created_at: r.purchased_at || `${date}T12:00:00`,
          updated_at: r.updated_at,
        });
      }
    }

    return deduped.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
      return sortNewest ? -cmp : cmp;
    });
  }, [
    transactions,
    receipts,
    q,
    typeFilter,
    categoryId,
    userId,
    period,
    thisWeek.start,
    thisWeek.end,
    lastWeek.start,
    lastWeek.end,
    customStart,
    customEnd,
    minAmount,
    maxAmount,
    includeSavings,
    sortNewest,
    users,
    categories,
  ]);

  const categoryLabel =
    categoryId === 'all'
      ? 'All categories'
      : categories.find((c) => c.id === categoryId)?.name ?? 'Category';
  const userLabel =
    userId === 'all' ? 'All members' : users.find((u) => u.id === userId)?.name ?? 'Member';

  const onExport = async () => {
    setExporting(true);
    try {
      await exportTransactionsCsv(rows, users, categories);
    } catch {
      alert('Export failed', 'Could not share the CSV file.');
    } finally {
      setExporting(false);
    }
  };

  const onDelete = (t: Transaction) => {
    const title = t.merchant || t.note || 'this entry';
    confirm(`Delete “${title}”?`, 'This removes it from the phone and next Sheet sync.', async () => {
      await deleteTransaction(t.id);
      await queueMutation('transactions', { id: t.id, deleted: true });
      await refresh();
    }, { confirmLabel: 'Delete', tone: 'danger' });
  };

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Search</Text>
          <Text style={styles.subtitle}>
            {rows.length} result{rows.length === 1 ? '' : 's'} · {periodLabel}
          </Text>
        </View>
        <Pressable
          onPress={onExport}
          disabled={exporting || rows.length === 0}
          style={({ pressed }) => [
            styles.csvBtn,
            (exporting || rows.length === 0) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}>
          <Ionicons name="cloud-download-outline" size={16} color={Palette.void} />
          <Text style={styles.csvText}>{exporting ? '…' : 'CSV'}</Text>
        </Pressable>
      </View>

      <CollapsibleWidget
        accent={Palette.cyan}
        defaultExpanded={false}
        header={<WidgetTitle icon="options-outline" title="Filters" />}
        collapsedSummary={
          <Text style={styles.filterSummary}>
            {periodLabel}
            {typeFilter !== 'all' ? ` · ${typeFilter}` : ''}
            {categoryId !== 'all' ? ` · ${categoryLabel}` : ''}
            {userId !== 'all' ? ` · ${userLabel}` : ''}
            {q.trim() ? ` · “${q.trim()}”` : ''}
          </Text>
        }>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Palette.textDim} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by description…"
            placeholderTextColor={Palette.textDim}
            style={styles.searchInput}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Palette.textDim} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.fieldLabel}>TYPE</Text>
        <View style={styles.seg}>
          {(
            [
              ['all', 'All'],
              ['expense', 'Expenses'],
              ['income', 'Income'],
            ] as const
          ).map(([id, label]) => {
            const on = typeFilter === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTypeFilter(id)}
                style={[styles.segItem, on && styles.segItemOn]}>
                <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <Pressable onPress={() => setPicker('category')} style={styles.dropdown}>
          {categoryId !== 'all' ? (
            <View
              style={[
                styles.dropdownIcon,
                {
                  backgroundColor: `${categories.find((c) => c.id === categoryId)?.color ?? Palette.cyan}28`,
                },
              ]}>
              <Ionicons
                name={categoryIonicon(categories.find((c) => c.id === categoryId)?.icon ?? 'cube')}
                size={14}
                color={categories.find((c) => c.id === categoryId)?.color ?? Palette.cyan}
              />
            </View>
          ) : null}
          <Text style={styles.dropdownText}>{categoryLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={Palette.textDim} />
        </Pressable>

        <Text style={styles.fieldLabel}>REGISTERED BY</Text>
        <Pressable onPress={() => setPicker('user')} style={styles.dropdown}>
          <Text style={styles.dropdownText}>{userLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={Palette.textDim} />
        </Pressable>

        <Text style={styles.fieldLabel}>PERIOD</Text>
        <View style={styles.periodRow}>
          {(
            [
              ['all', 'All time'],
              ['this_week', 'This week'],
              ['last_week', 'Last week'],
              ['custom', 'Custom'],
            ] as const
          ).map(([id, label]) => {
            const on = period === id;
            return (
              <Pressable
                key={id}
                onPress={() => setPeriod(id)}
                style={[styles.periodChip, on && styles.periodChipOn]}>
                <Text style={[styles.periodText, on && styles.periodTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {period === 'custom' ? (
          <View style={styles.customRow}>
            <Pressable onPress={() => setPicking('start')} style={styles.dateBtn}>
              <Text style={styles.dateBtnText}>{format(customStart, 'yyyy-MM-dd')}</Text>
            </Pressable>
            <Text style={styles.arrow}>→</Text>
            <Pressable onPress={() => setPicking('end')} style={styles.dateBtn}>
              <Text style={styles.dateBtnText}>{format(customEnd, 'yyyy-MM-dd')}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={() => setAdvancedOpen((v) => !v)} style={styles.advancedHead}>
          <Ionicons name="options-outline" size={16} color={Palette.textMuted} />
          <Text style={styles.advancedTitle}>Advanced</Text>
          <Ionicons
            name={advancedOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Palette.textDim}
          />
        </Pressable>
        {advancedOpen ? (
          <View style={styles.advancedBody}>
            <View style={styles.amountRow}>
              <TextInput
                value={minAmount}
                onChangeText={setMinAmount}
                placeholder="Min $"
                keyboardType="decimal-pad"
                placeholderTextColor={Palette.textDim}
                style={[styles.amountInput, { flex: 1 }]}
              />
              <TextInput
                value={maxAmount}
                onChangeText={setMaxAmount}
                placeholder="Max $"
                keyboardType="decimal-pad"
                placeholderTextColor={Palette.textDim}
                style={[styles.amountInput, { flex: 1 }]}
              />
            </View>
            <Pressable
              onPress={() => setIncludeSavings((v) => !v)}
              style={styles.checkRow}>
              <Ionicons
                name={includeSavings ? 'checkbox' : 'square-outline'}
                size={18}
                color={Palette.cyan}
              />
              <Text style={styles.checkText}>Include savings contributions</Text>
            </Pressable>
            <Pressable onPress={() => setSortNewest((v) => !v)} style={styles.checkRow}>
              <Ionicons
                name={sortNewest ? 'arrow-down' : 'arrow-up'}
                size={18}
                color={Palette.cyan}
              />
              <Text style={styles.checkText}>
                Sort {sortNewest ? 'newest first' : 'oldest first'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setPeriod('all')} style={styles.checkRow}>
              <Ionicons
                name={period === 'all' ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={Palette.cyan}
              />
              <Text style={styles.checkText}>All time (ignore period chips)</Text>
            </Pressable>
          </View>
        ) : null}
      </CollapsibleWidget>

      {rows.length === 0 ? (
        <GlassPanel blur>
          <EmptyState
            illustration={UiImages.emptySearch}
            icon="search-outline"
            title="No matching entries"
            body="Try another period, clear filters, or add a purchase from Add."
            actionLabel="Add"
            onAction={() => router.push('/(tabs)/add' as never)}
          />
        </GlassPanel>
      ) : (
        rows.map((t, index) => {
          const user = users.find((u) => u.id === t.user_id);
          const cat = categories.find((c) => c.id === t.category_id);
          const income = isIncome(t.type);
          const title = t.merchant || t.note || cat?.name || t.type;
          const openDetails = () => {
            if (t.receipt_id) {
              router.push({
                pathname: '/receipts/[id]' as never,
                params: { id: t.receipt_id },
              });
              return;
            }
            router.push({
              pathname: '/transaction/edit' as never,
              params: { id: t.id },
            });
          };
          return (
            <GlassPanel key={`${t.id}__${index}`} style={styles.card}>
              <Pressable onPress={openDetails} style={styles.cardPress}>
              <View
                style={[
                  styles.catIcon,
                  {
                    backgroundColor: t.receipt_id
                      ? `${Palette.cyan}28`
                      : `${cat?.color ?? Palette.violet}28`,
                  },
                ]}>
                <Ionicons
                  name={
                    t.receipt_id
                      ? merchantIonicon()
                      : categoryIonicon(cat?.icon ?? 'cube')
                  }
                  size={18}
                  color={t.receipt_id ? Palette.cyan : cat?.color ?? Palette.violet}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {cat?.name ?? '—'} · {t.date}
                      {t.receipt_id ? ' · receipt' : ''}
                    </Text>
                    <View style={styles.who}>
                      <UserAvatar user={user} name={user?.name ?? '?'} size={18} />
                      <Text style={styles.whoName} numberOfLines={1}>
                        {user?.name ?? 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <Text
                      style={[
                        styles.amt,
                        { color: income ? Palette.teal : Palette.coral },
                      ]}>
                      {income ? '+' : '-'}
                      {formatAud(t.amount_aud)}
                    </Text>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={openDetails}
                        hitSlop={6}
                        style={styles.actionBtn}>
                        <Ionicons
                          name={t.receipt_id ? 'receipt-outline' : 'pencil-outline'}
                          size={16}
                          color={Palette.textMuted}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => onDelete(t)}
                        hitSlop={6}
                        style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={16} color={Palette.coral} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
              </Pressable>
            </GlassPanel>
          );
        })
      )}

      <SelectModal
        visible={picker === 'category'}
        title="Category"
        onClose={() => setPicker(null)}
        options={[
          { id: 'all', label: 'All categories', color: Palette.cyan, icon: 'pricetag' },
          ...categories.map((c) => ({
            id: c.id,
            label: c.name,
            color: c.color,
            icon: c.icon,
          })),
        ]}
        selected={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setPicker(null);
        }}
      />
      <SelectModal
        visible={picker === 'user'}
        title="Registered by"
        onClose={() => setPicker(null)}
        options={[
          { id: 'all', label: 'All members' },
          ...users.map((u) => ({ id: u.id, label: u.name })),
        ]}
        selected={userId}
        onSelect={(id) => {
          setUserId(id);
          setPicker(null);
        }}
        renderOption={(opt) =>
          opt.id === 'all' ? null : (
            <UserAvatar
              user={users.find((u) => u.id === opt.id)}
              name={opt.label}
              size={22}
            />
          )
        }
      />

      {picking && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={picking === 'start' ? customStart : customEnd}
          mode="date"
          display="default"
          onChange={(_, date) => {
            if (date) {
              if (picking === 'start') setCustomStart(date);
              else setCustomEnd(date);
            }
            setPicking(null);
          }}
        />
      ) : null}

      {Dialog}
    </Screen>
  );
}

function SelectModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  renderOption,
}: {
  visible: boolean;
  title: string;
  options: Array<{ id: string; label: string; color?: string; icon?: string }>;
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  renderOption?: (opt: { id: string; label: string }) => ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((opt) => {
              const on = selected === opt.id;
              const color = opt.color || Palette.cyan;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => onSelect(opt.id)}
                  style={[styles.modalRow, on && styles.modalRowOn]}>
                  {renderOption?.(opt)}
                  {opt.icon || opt.color ? (
                    <View style={[styles.modalIcon, { backgroundColor: `${color}28` }]}>
                      <Ionicons
                        name={categoryIonicon(opt.icon || 'cube')}
                        size={16}
                        color={color}
                      />
                    </View>
                  ) : null}
                  <Text style={[styles.modalRowText, on && styles.modalRowTextOn]}>
                    {opt.label}
                  </Text>
                  {on ? <Ionicons name="checkmark" size={18} color={Palette.cyan} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: Spacing.md,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: { color: Palette.textDim, fontSize: 13, marginTop: 4 },
  csvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.teal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.pill,
  },
  csvText: { color: Palette.void, fontWeight: '800', fontSize: 13 },
  filterSummary: { color: Palette.textDim, fontSize: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  searchInput: { flex: 1, color: Palette.text, fontSize: 15, paddingVertical: 8 },
  fieldLabel: {
    color: Palette.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radii.sm,
  },
  segItemOn: { backgroundColor: Palette.panel },
  segText: { color: Palette.textMuted, fontSize: 13, fontWeight: '600' },
  segTextOn: { color: Palette.text, fontWeight: '800' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownText: { color: Palette.text, fontSize: 14, flex: 1 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radii.pill,
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  periodChipOn: { backgroundColor: Palette.teal, borderColor: Palette.teal },
  periodText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  periodTextOn: { color: Palette.void },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: {
    flex: 1,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateBtnText: { color: Palette.text, fontWeight: '600', fontSize: 13 },
  arrow: { color: Palette.textDim },
  advancedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.stroke,
  },
  advancedTitle: { flex: 1, color: Palette.textMuted, fontWeight: '700', fontSize: 13 },
  advancedBody: { gap: 10, paddingTop: 4 },
  amountRow: { flexDirection: 'row', gap: 8 },
  amountInput: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { color: Palette.textMuted, fontSize: 13 },
  empty: { color: Palette.textMuted },
  card: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.sm,
    alignItems: 'flex-start',
  },
  cardPress: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardTitle: { color: Palette.text, fontWeight: '700', fontSize: 15 },
  cardMeta: { color: Palette.textMuted, fontSize: 12, marginTop: 3 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  whoName: { color: Palette.textMuted, fontSize: 12, flexShrink: 1 },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  amt: { fontWeight: '800', fontSize: 15 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.glassFillStrong,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Palette.panel,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  modalTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: Spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  modalRowOn: { opacity: 1 },
  modalIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowText: { flex: 1, color: Palette.textMuted, fontSize: 15 },
  modalRowTextOn: { color: Palette.text, fontWeight: '700' },
});
