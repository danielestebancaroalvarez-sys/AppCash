import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/ui/Screen';
import { AppCashLogo } from '@/components/brand/AppCashLogo';
import { GoogleGlyph } from '@/components/brand/GoogleGlyph';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import {
  isGoogleConfigured,
  saveGoogleSession,
  signInWithGoogleNative,
} from '@/lib/google/auth';
import { ensureSpreadsheet } from '@/lib/sync/engine';
import { seedIfNeeded } from '@/lib/db/seed';
import { useFinanceStore } from '@/stores/finance-store';

export default function LoginScreen() {
  const setSession = useFinanceStore((s) => s.setSession);
  const refresh = useFinanceStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    if (!isGoogleConfigured()) {
      Alert.alert(
        'Setup needed',
        'Google Sign-In is not configured yet. Check your .env Client IDs and rebuild the Android app.'
      );
      return;
    }

    setBusy(true);
    try {
      const result = await signInWithGoogleNative();
      if (!result.ok) {
        if (!result.cancelled) {
          Alert.alert('Could not sign in', result.message);
        }
        return;
      }

      const session = result.session;
      await seedIfNeeded(session.name, session.email, session.photoUrl ?? '');

      try {
        const sheetId = await ensureSpreadsheet();
        if (sheetId) {
          session.spreadsheetId = sheetId;
          await saveGoogleSession(session);
        }
      } catch {
        // Sheet can be linked later in Settings
      }

      setSession(session);
      await refresh();
    } catch (e) {
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <LinearGradient
          colors={['rgba(61,231,255,0.22)', 'rgba(46,230,166,0.06)', 'transparent']}
          style={styles.heroGlow}
        />
        <AppCashLogo size={112} showWordmark />
        <Text style={styles.tagline}>Household finances in AUD, synced to your Google Sheet.</Text>
      </View>

      <View style={styles.card}>
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSub}>Sign in to continue managing your household cashflow.</Text>

        <Pressable
          onPress={onGoogle}
          disabled={busy}
          style={({ pressed }) => [
            styles.googleBtn,
            (pressed || busy) && { opacity: 0.88 },
          ]}>
          {busy ? (
            <ActivityIndicator color={Palette.void} />
          ) : (
            <>
              <View style={styles.googleIconWrap}>
                <GoogleGlyph size={18} />
              </View>
              <Text style={styles.googleLabel}>Continue with Google</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={styles.footer}>Australian dollars · Week starts Monday</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  heroGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -20,
  },
  tagline: {
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
    maxWidth: 280,
    lineHeight: 22,
    fontSize: 15,
  },
  card: {
    backgroundColor: Palette.panel,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Palette.stroke,
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  cardTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '700',
  },
  cardSub: {
    color: Palette.textMuted,
    lineHeight: 21,
    marginBottom: Spacing.sm,
  },
  googleBtn: {
    height: 54,
    borderRadius: Radii.pill,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: {
    color: '#1F1F1F',
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 16,
  },
  footer: {
    color: Palette.textDim,
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: 12,
  },
});
