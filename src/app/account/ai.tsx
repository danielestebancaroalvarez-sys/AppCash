import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
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

const PROVIDERS: Array<{
  id: ReceiptAiProvider;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Free vision models — openrouter.ai',
    icon: 'planet-outline',
    color: Palette.cyan,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    hint: 'OCR.space + DeepSeek text',
    icon: 'document-text-outline',
    color: Palette.violet,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    hint: 'Google AI Studio key',
    icon: 'sparkles-outline',
    color: Palette.amber,
  },
];

export default function AccountAiScreen() {
  const { alert, Dialog } = useAppDialog();
  const [provider, setProvider] = useState<ReceiptAiProvider>('openrouter');
  const [openrouter, setOpenrouter] = useState('');
  const [deepseek, setDeepseek] = useState('');
  const [gemini, setGemini] = useState('');
  const [ocrSpace, setOcrSpace] = useState('');

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

  const saveAi = async () => {
    await setReceiptProvider(provider);
    await setOpenRouterApiKey(openrouter);
    await setDeepSeekApiKey(deepseek);
    await setGeminiApiKey(gemini);
    if (ocrSpace.trim()) await setOcrSpaceApiKey(ocrSpace);
    alert('Saved', `Receipt AI provider: ${provider}`);
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.lead}>
        Keys stay on this phone. OpenRouter can read receipt photos directly; DeepSeek needs OCR
        first.
      </Text>

      <Text style={styles.section}>Provider</Text>
      <View style={styles.providerGrid}>
        {PROVIDERS.map((p) => {
          const on = provider === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setProvider(p.id)}
              style={[styles.providerCard, on && { borderColor: p.color }]}>
              <View style={[styles.providerIcon, { backgroundColor: `${p.color}22` }]}>
                <Ionicons name={p.icon} size={20} color={p.color} />
              </View>
              <Text style={[styles.providerLabel, on && { color: Palette.text }]}>{p.label}</Text>
              <Text style={styles.providerHint} numberOfLines={2}>
                {p.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GlassPanel style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
        <Text style={styles.section}>API keys</Text>

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
              placeholder="OCR.space key (optional)"
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
    gap: 12,
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.stroke,
    padding: Spacing.sm,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLabel: {
    color: Palette.textMuted,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 14,
    width: 88,
  },
  providerHint: { flex: 1, color: Palette.textDim, fontSize: 12 },
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
