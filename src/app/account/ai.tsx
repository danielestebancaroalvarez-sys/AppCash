import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import {
  DEFAULT_RECEIPT_PROVIDER_ORDER,
  getGeminiApiKey,
  getNvidiaApiKey,
  getOpenRouterApiKey,
  getReceiptProviderOrder,
  setGeminiApiKey,
  setNvidiaApiKey,
  setOpenRouterApiKey,
  setReceiptProviderOrder,
  type ReceiptAiProvider,
} from '@/lib/ai/receipts';

const META: Record<
  ReceiptAiProvider,
  { label: string; hint: string; icon: keyof typeof Ionicons.glyphMap; color: string; placeholder: string }
> = {
  gemini: {
    label: 'Gemini',
    hint: 'aistudio.google.com/apikey',
    icon: 'sparkles-outline',
    color: Palette.amber,
    placeholder: 'AIza…',
  },
  nvidia: {
    label: 'NVIDIA',
    hint: 'One key from build.nvidia.com (nvapi-…)',
    icon: 'hardware-chip-outline',
    color: Palette.teal,
    placeholder: 'nvapi-…',
  },
  openrouter: {
    label: 'OpenRouter',
    hint: 'openrouter.ai',
    icon: 'planet-outline',
    color: Palette.cyan,
    placeholder: 'sk-or-…',
  },
};

export default function AccountAiScreen() {
  const { alert, Dialog } = useAppDialog();
  const [order, setOrder] = useState<ReceiptAiProvider[]>([...DEFAULT_RECEIPT_PROVIDER_ORDER]);
  const [keys, setKeys] = useState<Record<ReceiptAiProvider, string>>({
    gemini: '',
    nvidia: '',
    openrouter: '',
  });

  useEffect(() => {
    void (async () => {
      setOrder(await getReceiptProviderOrder());
      setKeys({
        gemini: await getGeminiApiKey(),
        nvidia: await getNvidiaApiKey(),
        openrouter: await getOpenRouterApiKey(),
      });
    })();
  }, []);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...order];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setOrder(next);
  };

  const saveAi = async () => {
    await setReceiptProviderOrder(order);
    await setGeminiApiKey(keys.gemini);
    await setNvidiaApiKey(keys.nvidia);
    await setOpenRouterApiKey(keys.openrouter);
    alert('Saved', `Scan order: ${order.map((p) => META[p].label).join(' → ')}`);
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.lead}>
        Keys stay on this phone. Scan tries providers in the order below — move them with the arrows.
      </Text>

      <Text style={styles.section}>Fallback order</Text>
      <View style={styles.providerGrid}>
        {order.map((id, index) => {
          const p = META[id];
          return (
            <View key={id} style={[styles.providerCard, { borderColor: `${p.color}66` }]}>
              <View style={[styles.stepBadge, { backgroundColor: `${p.color}22` }]}>
                <Text style={[styles.stepText, { color: p.color }]}>{index + 1}</Text>
              </View>
              <View style={[styles.providerIcon, { backgroundColor: `${p.color}22` }]}>
                <Ionicons name={p.icon} size={20} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.providerLabel}>{p.label}</Text>
                <Text style={styles.providerHint}>{p.hint}</Text>
              </View>
              <View style={styles.arrows}>
                <Pressable
                  onPress={() => move(index, -1)}
                  disabled={index === 0}
                  hitSlop={8}
                  style={{ opacity: index === 0 ? 0.3 : 1 }}>
                  <Ionicons name="chevron-up" size={18} color={Palette.text} />
                </Pressable>
                <Pressable
                  onPress={() => move(index, 1)}
                  disabled={index === order.length - 1}
                  hitSlop={8}
                  style={{ opacity: index === order.length - 1 ? 0.3 : 1 }}>
                  <Ionicons name="chevron-down" size={18} color={Palette.text} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <GlassPanel style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
        <Text style={styles.section}>API keys</Text>

        {order.map((id) => {
          const p = META[id];
          return (
            <View key={`key-${id}`}>
              <Text style={styles.keyLabel}>{p.label}</Text>
              <TextInput
                value={keys[id]}
                onChangeText={(t) => setKeys((prev) => ({ ...prev, [id]: t }))}
                placeholder={p.placeholder}
                placeholderTextColor={Palette.textDim}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          );
        })}

        <PrimaryButton label="Save AI settings" onPress={saveAi} />
      </GlassPanel>
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Palette.textMuted, fontSize: 13, marginBottom: Spacing.md, lineHeight: 18 },
  section: {
    color: Palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  providerGrid: { gap: 8 },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontWeight: '800', fontSize: 13 },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLabel: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 14,
  },
  providerHint: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
  arrows: { gap: 2, alignItems: 'center' },
  keyLabel: { color: Palette.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 },
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
