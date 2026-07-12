import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { AppModal } from '@/components/ui/AppModal';
import { UserAvatar } from '@/components/ui/UserAvatar';
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

  const owner =
    users.find(
      (u) => u.email && session?.email && u.email.toLowerCase() === session.email.toLowerCase()
    ) ||
    users.find((u) => u.role === 'owner') ||
    users[0];

  return (
    <Screen tabAware={false}>
      <GlassPanel glow style={styles.hero}>
        <UserAvatar
          user={owner}
          photoUrl={session?.photoUrl || owner?.avatar_url}
          name={session?.name || owner?.name}
          size={84}
        />
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
          <View style={styles.userRow}>
            <UserAvatar user={u} size={40} selected={activeUserId === u.id} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.name}</Text>
              <Text style={styles.userMeta}>
                {u.role}
                {u.email ? ` · ${u.email}` : ''}
              </Text>
            </View>
          </View>
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
  name: { color: Palette.text, fontFamily: Fonts.display, fontSize: 22, fontWeight: '800' },
  email: { color: Palette.textMuted },
  sheet: { color: Palette.textDim, fontSize: 11, marginTop: 4 },
  user: { marginBottom: Spacing.sm },
  userOn: { borderColor: Palette.cyan },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userName: { color: Palette.text, fontWeight: '700', fontSize: 16 },
  userMeta: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
});
