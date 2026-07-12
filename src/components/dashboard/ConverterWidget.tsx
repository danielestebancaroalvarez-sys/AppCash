import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import {
  fetchCopAudRate,
  formatRateDate,
  saveManualCopAud,
  type CopAudRate,
} from '@/lib/fx/cop-aud';
import { parseAmount } from '@/lib/money';

export function ConverterWidget() {
  const [rate, setRate] = useState<CopAudRate | null>(null);
  const [amount, setAmount] = useState('1');
  const [mode, setMode] = useState<'aud_to_cop' | 'cop_to_aud'>('aud_to_cop');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  const load = useCallback(async (force = false) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fetchCopAudRate(force);
      setRate(next);
      if (!next) {
        setError('Could not reach FX servers. Enter a rate manually below.');
      }
    } catch {
      setError('Network error loading rate.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const applyManual = async () => {
    const n = Number(manual.replace(/[^0-9.]/g, ''));
    if (!n || n <= 0) return;
    const saved = await saveManualCopAud(n);
    setRate(saved);
    setError(null);
  };

  const n = parseAmount(amount) || 0;
  const copPerAud = rate?.copPerAud ?? 0;
  const result =
    mode === 'aud_to_cop' ? n * copPerAud : copPerAud > 0 ? n / copPerAud : 0;

  const summary = rate
    ? `1 AUD = ${rate.copPerAud.toLocaleString()} COP · ${formatRateDate(rate.fetchedAt)}`
    : busy
      ? 'Loading rate…'
      : 'Tap to set rate';

  return (
    <CollapsibleWidget
      accent={Palette.cyan}
      defaultExpanded
      header={<WidgetTitle icon="swap-horizontal" title="Converter COP ↔ AUD" />}
      collapsedSummary={<Text style={styles.summary}>{summary}</Text>}>
      <Text style={styles.rateLine}>{summary}</Text>
      {rate ? (
        <Text style={styles.source}>Source: {rate.source}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

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
        <Pressable onPress={() => load(true)} style={styles.refresh} disabled={busy}>
          <Ionicons name="refresh" size={16} color={Palette.cyan} />
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>
        {mode === 'aud_to_cop' ? 'Amount in AUD' : 'Amount in COP'}
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={mode === 'aud_to_cop' ? '1.00' : '100000'}
        placeholderTextColor={Palette.textDim}
        style={styles.input}
      />
      <Text style={styles.result}>
        {copPerAud > 0
          ? mode === 'aud_to_cop'
            ? `≈ ${Math.round(result).toLocaleString()} COP`
            : `≈ A$ ${result.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : '—'}
      </Text>

      <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>
        Manual rate (COP per 1 AUD)
      </Text>
      <View style={styles.manualRow}>
        <TextInput
          value={manual}
          onChangeText={setManual}
          keyboardType="decimal-pad"
          placeholder={rate ? String(Math.round(rate.copPerAud)) : '2300'}
          placeholderTextColor={Palette.textDim}
          style={[styles.input, { flex: 1, marginTop: 0 }]}
        />
        <Pressable onPress={applyManual} style={styles.applyBtn}>
          <Text style={styles.applyText}>Use</Text>
        </Pressable>
      </View>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  rateLine: { color: Palette.textMuted, fontSize: 12 },
  source: { color: Palette.textDim, fontSize: 11 },
  error: { color: Palette.coral, fontSize: 12 },
  fieldLabel: { color: Palette.textDim, fontSize: 11, fontWeight: '700', marginTop: 4 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
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
    marginTop: 4,
  },
  result: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 22,
    marginTop: Spacing.sm,
  },
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  applyBtn: {
    backgroundColor: Palette.cyan,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radii.md,
  },
  applyText: { color: Palette.void, fontWeight: '800', fontSize: 13 },
});
