import { useCallback, useMemo } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAppDialog } from '@/components/ui/useAppDialog';
import {
  GlassHeaderBackground,
  GlassTabBarBackground,
} from '@/components/ui/GlassTabBarBackground';
import { Fonts, Palette, Radii } from '@/constants/theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useFinanceStore } from '@/stores/finance-store';

function TabIcon({
  name,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconFocused]}>
      <Ionicons name={name} size={20} color={focused ? Palette.cyan : Palette.textDim} />
    </View>
  );
}

function HeaderProfileButton() {
  const router = useRouter();
  const session = useFinanceStore((s) => s.session);
  const users = useFinanceStore((s) => s.users);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const active = users.find((u) => u.id === activeUserId) || users.find((u) => u.role === 'owner');

  return (
    <Pressable onPress={() => router.push('/profile' as never)} style={styles.headerBtn}>
      <UserAvatar
        user={active}
        photoUrl={session?.photoUrl}
        name={session?.name || active?.name}
        size={28}
      />
    </Pressable>
  );
}

function HeaderSignOutButton() {
  const router = useRouter();
  const logout = useFinanceStore((s) => s.logout);
  const { confirm, Dialog } = useAppDialog();

  return (
    <>
      <Pressable
        onPress={() =>
          confirm(
            'Sign out?',
            'Returns to the login screen. Data on this phone stays until you wipe it.',
            async () => {
              await logout();
              router.replace('/login' as never);
            },
            { confirmLabel: 'Sign out', tone: 'danger', cancelLabel: 'Stay' }
          )
        }
        style={styles.headerBtn}
        accessibilityRole="button"
        accessibilityLabel="Sign out">
        <Ionicons name="log-out-outline" size={18} color={Palette.textMuted} />
      </Pressable>
      {Dialog}
    </>
  );
}

function HeaderSyncButton() {
  const runSync = useFinanceStore((s) => s.runSync);
  const pending = useFinanceStore((s) => s.pendingSyncCount);
  const paused = useFinanceStore((s) => s.syncPaused);
  const session = useFinanceStore((s) => s.session);
  const router = useRouter();

  const onPress = () => {
    if (!session?.spreadsheetId) {
      router.push('/account/sheets' as never);
      return;
    }
    void runSync();
  };

  return (
    <Pressable
      onPress={onPress}
      style={styles.headerBtn}
      accessibilityRole="button"
      accessibilityLabel={
        paused
          ? 'Sync paused — tap to retry'
          : pending > 0
            ? `${pending} changes to sync`
            : 'Sync with Google Sheets'
      }>
      <Ionicons
        name={
          paused
            ? 'cloud-offline-outline'
            : pending > 0
              ? 'cloud-upload-outline'
              : session?.spreadsheetId
                ? 'cloud-done-outline'
                : 'cloud-outline'
        }
        size={20}
        color={paused ? Palette.amber : pending > 0 ? Palette.cyan : Palette.text}
      />
      {pending > 0 ? (
        <View style={styles.syncDot}>
          <Text style={styles.syncDotText}>{pending > 9 ? '9+' : pending}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function HomeHeaderRight() {
  const router = useRouter();
  return (
    <View style={styles.headerRight}>
      <HeaderSyncButton />
      <HeaderSignOutButton />
      <Pressable onPress={() => router.push('/notifications' as never)} style={styles.headerBtn}>
        <Ionicons name="notifications-outline" size={20} color={Palette.text} />
      </Pressable>
      <HeaderProfileButton />
    </View>
  );
}

function DefaultHeaderRight() {
  const router = useRouter();
  return (
    <View style={styles.headerRight}>
      <Pressable onPress={() => router.push('/notifications' as never)} style={styles.headerBtn}>
        <Ionicons name="notifications-outline" size={20} color={Palette.text} />
      </Pressable>
      <HeaderProfileButton />
    </View>
  );
}

function HomeTabIcon({ focused }: { focused: boolean }) {
  return <TabIcon name="home-outline" focused={focused} />;
}
function SearchTabIcon({ focused }: { focused: boolean }) {
  return <TabIcon name="search-outline" focused={focused} />;
}
function SavingsTabIcon({ focused }: { focused: boolean }) {
  return <TabIcon name="wallet-outline" focused={focused} />;
}
function MoreTabIcon({ focused }: { focused: boolean }) {
  return <TabIcon name="menu-outline" focused={focused} />;
}
function AddTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.addBtn, focused && styles.addBtnFocused]}>
      <Ionicons name="add" size={28} color={Palette.void} />
    </View>
  );
}

export default function TabsLayout() {
  const { tabBarHeight, bottomInset } = useTabBarHeight();
  const pendingSyncCount = useFinanceStore((s) => s.pendingSyncCount);
  const badge = pendingSyncCount > 0 ? pendingSyncCount : undefined;

  const renderDefaultHeaderRight = useCallback(() => <DefaultHeaderRight />, []);
  const renderHomeHeaderRight = useCallback(() => <HomeHeaderRight />, []);

  const screenOptions = useMemo(
    () => ({
      tabBarStyle: {
        backgroundColor: 'transparent',
        borderTopColor: 'transparent',
        borderTopWidth: 0,
        height: tabBarHeight,
        paddingBottom: bottomInset,
        paddingTop: 6,
        position: 'absolute' as const,
        left: 0,
        right: 0,
        bottom: 0,
        elevation: 0,
      },
      tabBarBackground: GlassTabBarBackground,
      tabBarActiveTintColor: Palette.cyan,
      tabBarInactiveTintColor: Palette.textDim,
      tabBarLabelStyle: { fontSize: 11, fontFamily: Fonts.body },
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerBackground: GlassHeaderBackground,
      headerShadowVisible: false,
      headerTintColor: Palette.text,
      headerTitleStyle: { fontFamily: Fonts.display, fontWeight: '700' as const },
      headerRight: renderDefaultHeaderRight,
    }),
    [tabBarHeight, bottomInset, renderDefaultHeaderRight]
  );

  const homeOptions = useMemo(
    () => ({
      title: 'Home',
      headerRight: renderHomeHeaderRight,
      tabBarIcon: HomeTabIcon,
    }),
    [renderHomeHeaderRight]
  );

  const searchOptions = useMemo(
    () => ({ title: 'Search', tabBarIcon: SearchTabIcon }),
    []
  );

  const addOptions = useMemo(() => ({ title: 'Add', tabBarIcon: AddTabIcon }), []);

  const savingsOptions = useMemo(
    () => ({ title: 'Savings', tabBarIcon: SavingsTabIcon }),
    []
  );

  const moreOptions = useMemo(
    () => ({
      title: 'More',
      tabBarBadge: badge,
      tabBarIcon: MoreTabIcon,
    }),
    [badge]
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={homeOptions} />
      <Tabs.Screen name="search" options={searchOptions} />
      <Tabs.Screen name="add" options={addOptions} />
      <Tabs.Screen name="savings" options={savingsOptions} />
      <Tabs.Screen name="settings" options={moreOptions} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFocused: { backgroundColor: 'rgba(61,231,255,0.12)' },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: Radii.pill,
    backgroundColor: Palette.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  addBtnFocused: { transform: [{ scale: 1.05 }] },
  headerRight: { flexDirection: 'row', gap: 4, marginRight: 10, alignItems: 'center' },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  syncDot: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  syncDotText: { color: Palette.void, fontSize: 8, fontWeight: '800' },
});
