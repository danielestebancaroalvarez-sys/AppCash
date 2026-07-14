import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import {
  getGeminiApiKey,
  getNvidiaApiKey,
  getOcrSpaceApiKey,
  getOpenRouterApiKey,
  setGeminiApiKey,
  setNvidiaApiKey,
  setOcrSpaceApiKey,
  setOpenRouterApiKey,
} from '@/lib/ai/receipts';

const CASCADE = [
  {
    id: 'gemini' as const,
    step: '1',
    label: 'Gemini',
    hint: 'Tried first — aistudio.google.com/apikey',
    icon: 'sparkles-outline' as const,
    color: Palette.amber,
  },
  {
    id: 'nvidia' as const,
    step: '2',
    label: 'NVIDIA',
    hint: 'If Gemini fails — build.nvidia.com',
    icon: 'hardware-chip-outline' as const,
    color: Palette.teal,
  },
  {
    id: 'openrouter' as const,
    step: '3',
    label: 'OpenRouter',
    hint: 'Last resort — openrouter.ai',
    icon: 'planet-outline' as const,
    color: Palette.cyan,
  },
];

export default function AccountAiScreen() {
  const { alert, Dialog } = useAppDialog();
  const [openrouter, setOpenrouter] = useState('');
  const [gemini, setGemini] = useState('');
  const [nvidia, setNvidia] = useState('');
  const [ocrSpace, setOcrSpace] = useState('');

  useEffect(() => {
    void (async () => {
      setOpenrouter(await getOpenRouterApiKey());
      setGemini(await getGeminiApiKey());
      setNvidia(await getNvidiaApiKey());
      setOcrSpace(await getOcrSpaceApiKey());
    })();
  }, []);

  const saveAi = async () => {
    await setOpenRouterApiKey(openrouter);
    await setGeminiApiKey(gemini);
    await setNvidiaApiKey(nvidia);
    await setOcrSpaceApiKey(ocrSpace);
    alert('Saved', 'Receipt scan will try Gemini → NVIDIA → OpenRouter.');
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.lead}>
        Keys stay on this phone. Scan always tries Gemini first, then NVIDIA, then OpenRouter —
        and within each, the next model if one fails.
      </Text>

      <Text style={styles.section}>Fallback order</Text>
      <View style={styles.providerGrid}>
        {CASCADE.map((p) => (
          <View key={p.id} style={[styles.providerCard, { borderColor: `${p.color}66` }]}>
            <View style={[styles.stepBadge, { backgroundColor: `${p.color}22` }]}>
              <Text style={[styles.stepText, { color: p.color }]}>{p.step}</Text>
            </View>
            <View style={[styles.providerIcon, { backgroundColor: `${p.color}22` }]}>
              <Ionicons name={p.icon} size={20} color={p.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerLabel}>{p.label}</Text>
              <Text style={styles.providerHint}>{p.hint}</Text>
            </View>
          </View>
        ))}
      </View>

      <GlassPanel style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
        <Text style={styles.section}>API keys</Text>

        <Text style={styles.keyLabel}>Gemini</Text>
        <TextInput
          value={gemini}
          onChangeText={setGemini}
          placeholder="AIza… (Google AI Studio)"
          placeholderTextColor={Palette.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={styles.keyLabel}>NVIDIA</Text>
        <TextInput
          value={nvidia}
          onChangeText={setNvidia}
          placeholder="nvapi-…"
          placeholderTextColor={Palette.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={styles.keyLabel}>OpenRouter</Text>
        <TextInput
          value={openrouter}
          onChangeText={setOpenrouter}
          placeholder="sk-or-…"
          placeholderTextColor={Palette.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={styles.keyLabel}>OCR.space (optional)</Text>
        <Text style={styles.keyHint}>
          Used only when NVIDIA needs text-from-photo fallback. Leave empty to skip.
        </Text>
        <TextInput
          value={ocrSpace}
          onChangeText={setOcrSpace}
          placeholder="OCR.space API key"
          placeholderTextColor={Palette.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

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
  keyLabel: { color: Palette.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  keyHint: { color: Palette.textDim, fontSize: 11, lineHeight: 15, marginBottom: 2 },
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
