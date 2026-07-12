import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { AppModal } from '@/components/ui/AppModal';
import { MenuRow } from '@/components/ui/MenuRow';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';

export default function ProfileScreen() {
  const router = useRouter();
  const session = useFinanceStore((s) => s.session);
  const users = useFinanceStore((s) => s.users);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const lastSyncAt = useFinanceStore((s) => s.lastSyncAt);
  const setActiveUser = useFinanceStore((s) => s.setActiveUser);
  const logout = useFinanceStore((s) => s.logout);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const owner = useMemo(
    () =>
      users.find(
        (u) => u.email && session?.email && u.email.toLowerCase() === session.email.toLowerCase()
      ) ||
      users.find((u) => u.role === 'owner') ||
      users[0],
    [users, session?.email]
  );

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
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Ionicons
              name={session?.spreadsheetId ? 'link' : 'link-outline'}
              size={12}
              color={session?.spreadsheetId ? Palette.teal : Palette.amber}
            />
            <Text style={styles.badgeText}>
              {session?.spreadsheetId ? 'Sheet linked' : 'No sheet'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={12} color={Palette.textDim} />
            <Text style={styles.badgeText}>
              Sync {lastSyncAt ? new Date(lastSyncAt).toLocaleDateString() : 'never'}
            </Text>
          </View>
        </View>
      </GlassPanel>

      <SectionTitle title="Connections" subtitle="Google Sheet and receipt AI live here" />
      <GlassPanel style={styles.menu}>
        <MenuRow
          icon="grid-outline"
          iconColor={Palette.teal}
          title="Google Sheets"
          subtitle={session?.spreadsheetId ? 'Sync, open, or unlink' : 'Link or create a spreadsheet'}
          onPress={() => router.push('/account/sheets' as never)}
        />
        <MenuRow
          icon="sparkles-outline"
          iconColor={Palette.violet}
          title="Receipt AI"
          subtitle="Provider and API tokens"
          onPress={() => router.push('/account/ai' as never)}
        />
      </GlassPanel>

      <SectionTitle title="Active profile" subtitle="Used when adding expenses or income" />
      {users.map((u) => {
        const on = activeUserId === u.id;
        return (
          <Pressable key={u.id} onPress={() => setActiveUser(u.id)}>
            <GlassPanel style={[styles.user, on && styles.userOn]}>
              <View style={styles.userRow}>
                <UserAvatar user={u} size={40} selected={on} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userMeta}>
                    {u.role}
                    {u.email ? ` · ${u.email}` : ''}
                  </Text>
                </View>
                {on ? <Ionicons name="checkmark-circle" size={22} color={Palette.cyan} /> : null}
              </View>
            </GlassPanel>
          </Pressable>
        );
      })}

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
  hero: { alignItems: 'center', marginBottom: Spacing.md, gap: 6 },
  name: { color: Palette.text, fontFamily: Fonts.display, fontSize: 22, fontWeight: '800' },
  email: { color: Palette.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  badgeText: { color: Palette.textMuted, fontSize: 11, fontWeight: '600' },
  menu: { paddingVertical: 4, marginBottom: Spacing.sm },
  user: { marginBottom: Spacing.sm },
  userOn: { borderColor: Palette.cyan },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userName: { color: Palette.text, fontWeight: '700', fontSize: 16 },
  userMeta: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
});
