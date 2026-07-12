import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import {
  fetchCopAudRate,
  formatRateDate,
  type CopAudRate,
} from '@/lib/fx/cop-aud';
import { parseAmount } from '@/lib/money';

export function ConverterWidget() {
  const [rate, setRate] = useState<CopAudRate | null>(null);
  const [amount, setAmount] = useState('1');
  const [mode, setMode] = useState<'aud_to_cop' | 'cop_to_aud'>('aud_to_cop');
  const [busy, setBusy] = useState(false);

  const load = async (force = false) => {
    setBusy(true);
    try {
      const next = await fetchCopAudRate(force);
      setRate(next);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const n = parseAmount(amount) || 0;
  const copPerAud = rate?.copPerAud ?? 0;
  const result =
    mode === 'aud_to_cop'
      ? n * copPerAud
      : copPerAud > 0
        ? n / copPerAud
        : 0;

  const summary = rate
    ? `1 AUD = $ ${rate.copPerAud.toLocaleString()} · ${formatRateDate(rate.fetchedAt)}`
    : busy
      ? 'Loading rate…'
      : 'Rate unavailable';

  return (
    <CollapsibleWidget
      accent={Palette.cyan}
      defaultExpanded={false}
      header={<WidgetTitle icon="swap-horizontal" title="Converter COP ↔ AUD" />}
      collapsedSummary={<Text style={styles.summary}>{summary}</Text>}>
      <Text style={styles.rateLine}>{summary}</Text>
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('aud_to_cop')}
          style={[styles.mode, mode === 'aud_to_cop' && styles.modeOn]}>
          <Text style={[styles.modeText, mode === 'aud_to_cop' && styles.modeTextOn]}>
            AUD → COP
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('cop_to_aud')}
          style={[styles.mode, mode === 'cop_to_aud' && styles.modeOn]}>
          <Text style={[styles.modeText, mode === 'cop_to_aud' && styles.modeTextOn]}>
            COP → AUD
          </Text>
        </Pressable>
        <Pressable onPress={() => load(true)} style={styles.refresh}>
          <Ionicons name="refresh" size={16} color={Palette.cyan} />
        </Pressable>
      </View>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="Amount"
        placeholderTextColor={Palette.textDim}
        style={styles.input}
      />
      <Text style={styles.result}>
        {mode === 'aud_to_cop'
          ? `≈ ${result.toLocaleString(undefined, { maximumFractionDigits: 0 })} COP`
          : `≈ A$ ${result.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
      </Text>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  rateLine: { color: Palette.textMuted, fontSize: 12, marginBottom: 4 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mode: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  modeOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  modeText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  modeTextOn: { color: Palette.void },
  refresh: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,231,255,0.12)',
  },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    marginTop: Spacing.sm,
  },
  result: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 20,
    marginTop: Spacing.sm,
  },
});
