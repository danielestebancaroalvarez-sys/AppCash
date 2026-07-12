import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { AppModal } from '@/components/ui/AppModal';
import { Fonts, Palette, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';

export default function ProfileScreen() {
  const router = useRouter();
  const session = useFinanceStore((s) => s.session);
  const users = useFinanceStore((s) => s.users);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const setActiveUser = useFinanceStore((s) => s.setActiveUser);
  const logout = useFinanceStore((s) => s.logout);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
      setSignOutOpen(false);
      router.replace('/login' as never);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabAware={false}>
      <GlassPanel glow style={styles.hero}>
        {session?.photoUrl ? (
          <Image source={{ uri: session.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>
              {(session?.name || users[0]?.name || 'A').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>
          {session?.name || users.find((u) => u.id === activeUserId)?.name || 'AppCash'}
        </Text>
        <Text style={styles.email}>{session?.email || 'Not connected to Google'}</Text>
        {session?.spreadsheetId ? (
          <Text style={styles.sheet}>Sheet linked</Text>
        ) : (
          <Text style={styles.sheet}>No spreadsheet linked yet — open Settings</Text>
        )}
      </GlassPanel>

      <SectionTitle title="Active profile when adding entries" />
      {users.map((u) => (
        <GlassPanel
          key={u.id}
          onPress={() => setActiveUser(u.id)}
          style={[styles.user, activeUserId === u.id ? styles.userOn : null]}>
          <Text style={styles.userName}>{u.name}</Text>
          <Text style={styles.userMeta}>
            {u.role}
            {u.email ? ` · ${u.email}` : ''}
          </Text>
        </GlassPanel>
      ))}

      <PrimaryButton label="Sign out" variant="danger" onPress={() => setSignOutOpen(true)} />

      <AppModal
        visible={signOutOpen}
        title="Sign out?"
        message="You’ll need Google again to sync. Data cached on this phone stays until you clear app storage."
        confirmLabel={busy ? 'Signing out…' : 'Sign out'}
        cancelLabel="Stay signed in"
        tone="danger"
        confirmDisabled={busy}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={onLogout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: Spacing.lg, gap: 6 },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 8 },
  avatarFallback: {
    backgroundColor: Palette.panelElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.cyan,
  },
  avatarLetter: { color: Palette.cyan, fontSize: 32, fontWeight: '800' },
  name: { color: Palette.text, fontFamily: Fonts.display, fontSize: 22, fontWeight: '800' },
  email: { color: Palette.textMuted },
  sheet: { color: Palette.textDim, fontSize: 11, marginTop: 4 },
  user: { marginBottom: Spacing.sm },
  userOn: { borderColor: Palette.cyan },
  userName: { color: Palette.text, fontWeight: '700' },
  userMeta: { color: Palette.textDim, fontSize: 12, marginTop: 3 },
});
