import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppCashLogo } from '@/components/brand/AppCashLogo';
import { GoogleGlyph } from '@/components/brand/GoogleGlyph';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import {
  isGoogleConfigured,
  saveGoogleSession,
  signInWithGoogleNative,
} from '@/lib/google/auth';
import { seedIfNeeded } from '@/lib/db/seed';
import { useFinanceStore } from '@/stores/finance-store';

export default function LoginScreen() {
  const setSession = useFinanceStore((s) => s.setSession);
  const enterLocalMode = useFinanceStore((s) => s.enterLocalMode);
  const refresh = useFinanceStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const { alert, Dialog } = useAppDialog();

  const onLocal = async () => {
    setBusy(true);
    try {
      await enterLocalMode('Me');
    } catch (e) {
      alert('Could not start', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    if (!isGoogleConfigured()) {
      alert(
        'Setup needed',
        'Google Sign-In is not configured yet. You can still Continue locally — link Google later from Account to sync the purchase sheet.'
      );
      return;
    }

    setBusy(true);
    try {
      const result = await signInWithGoogleNative();
      if (!result.ok) {
        if (!result.cancelled) {
          alert('Could not sign in', result.message);
        }
        return;
      }

      const session = result.session;
      await seedIfNeeded(session.name, session.email, session.photoUrl ?? '');
      // Sheet is optional — link later from Account → Purchase sheet
      await saveGoogleSession(session);
      setSession(session);
      await refresh();
    } catch (e) {
      alert('Sign-in failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen safeTop>
      <View style={styles.hero}>
        <AppCashLogo size={112} showWordmark />
        <Text style={styles.tagline}>
          Household finances on this phone. Optional Google Sheet shares a simple purchase list
          with your partner.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Get started</Text>
        <Text style={styles.cardSub}>
          Use the app fully offline. Link Google only when you want a Compras sheet your partner
          can open and fill.
        </Text>

        <Pressable
          onPress={onLocal}
          disabled={busy}
          style={({ pressed }) => [
            styles.localBtn,
            (pressed || busy) && { opacity: 0.88 },
          ]}>
          {busy ? (
            <ActivityIndicator color={Palette.void} />
          ) : (
            <Text style={styles.localLabel}>Continue locally</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onGoogle}
          disabled={busy}
          style={({ pressed }) => [
            styles.googleBtn,
            (pressed || busy) && { opacity: 0.88 },
          ]}>
          <View style={styles.googleIconWrap}>
            <GoogleGlyph size={18} />
          </View>
          <Text style={styles.googleLabel}>Continue with Google</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>Australian dollars · Week starts Monday · Works offline</Text>
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  tagline: {
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
    maxWidth: 300,
    lineHeight: 22,
    fontSize: 15,
    fontFamily: Fonts.body,
  },
  card: {
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.stroke,
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  cardTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 24,
  },
  cardSub: {
    color: Palette.textMuted,
    fontFamily: Fonts.body,
    lineHeight: 21,
    marginBottom: Spacing.sm,
  },
  localBtn: {
    height: 54,
    borderRadius: Radii.md,
    backgroundColor: Palette.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localLabel: {
    color: Palette.void,
    fontFamily: Fonts.display,
    fontSize: 16,
  },
  googleBtn: {
    height: 54,
    borderRadius: Radii.md,
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
    fontSize: 16,
  },
  footer: {
    color: Palette.textDim,
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: 12,
    fontFamily: Fonts.body,
  },
});
