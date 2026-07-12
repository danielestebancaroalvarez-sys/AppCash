import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Fonts, Palette, Radii } from '@/constants/theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useFinanceStore } from '@/stores/finance-store';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconFocused]}>
      <Text style={[styles.iconGlyph, focused && styles.iconGlyphFocused]}>{label}</Text>
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

export default function TabsLayout() {
  const router = useRouter();
  const { tabBarHeight, bottomInset } = useTabBarHeight();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Palette.deep },
        headerTintColor: Palette.text,
        headerTitleStyle: { fontFamily: Fonts.display, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: Palette.panel,
          borderTopColor: Palette.stroke,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
        tabBarActiveTintColor: Palette.cyan,
        tabBarInactiveTintColor: Palette.textDim,
        tabBarLabelStyle: { fontSize: 11, fontFamily: Fonts.body },
        headerRight: () => (
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push('/notifications' as never)} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>🔔</Text>
            </Pressable>
            <HeaderProfileButton />
          </View>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="◈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon label="⌕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.addBtn, focused && styles.addBtnFocused]}>
              <Text style={styles.addPlus}>+</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="savings"
        options={{
          title: 'Savings',
          tabBarIcon: ({ focused }) => <TabIcon label="◈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon label="⚙" focused={focused} />,
        }}
      />
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
  iconFocused: { backgroundColor: 'rgba(61,231,255,0.15)' },
  iconGlyph: { color: Palette.textDim, fontSize: 16 },
  iconGlyphFocused: { color: Palette.cyan },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: Radii.pill,
    backgroundColor: Palette.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: Palette.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnFocused: { transform: [{ scale: 1.05 }] },
  addPlus: { color: Palette.void, fontSize: 28, fontWeight: '700', marginTop: -2 },
  headerRight: { flexDirection: 'row', gap: 8, marginRight: 12 },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerBtnText: { fontSize: 14 },
});
