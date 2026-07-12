import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFinanceStore } from '@/stores/finance-store';
import { Palette, Fonts } from '@/constants/theme';
import { syncNow } from '@/lib/sync/engine';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: ReactNode }) {
  const ready = useFinanceStore((s) => s.ready);
  const booting = useFinanceStore((s) => s.booting);
  const session = useFinanceStore((s) => s.session);
  const bootstrap = useFinanceStore((s) => s.bootstrap);
  const refresh = useFinanceStore((s) => s.refresh);
  const router = useRouter();
  const segments = useSegments();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!ready) return;
    const root = String(segments[0] ?? '');
    const inAuth = root === 'login';
    const signedIn = Boolean(session);
    if (!signedIn && !inAuth) {
      router.replace('/login' as never);
    } else if (signedIn && inAuth) {
      router.replace('/(tabs)' as never);
    }
  }, [ready, session, segments, router]);

  useEffect(() => {
    if (!ready || !session) return;
    let alive = true;
    const tick = async () => {
      if (!alive || syncing) return;
      setSyncing(true);
      try {
        // Background: only push when there are pending changes; pull lightly
        await syncNow({ force: false, push: true, pull: true });
        await refresh();
      } finally {
        if (alive) setSyncing(false);
      }
    };
    // First sync after a short delay so login/create-sheet writes settle
    const boot = setTimeout(tick, 8000);
    const id = setInterval(tick, 120000);
    return () => {
      alive = false;
      clearTimeout(boot);
      clearInterval(id);
    };
  }, [ready, session, refresh]);

  if (!ready || booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={Palette.cyan} size="large" />
        <Text style={styles.bootText}>AppCash</Text>
        <Text style={styles.bootSub}>Loading your finance grid…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: Palette.deep },
            headerTintColor: Palette.text,
            headerTitleStyle: { fontFamily: Fonts.display, fontWeight: '700' },
            contentStyle: { backgroundColor: Palette.void },
            headerShadowVisible: false,
          }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications', presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ title: 'Account', presentation: 'modal' }} />
          <Stack.Screen name="receipt/review" options={{ title: 'Review receipt', presentation: 'modal' }} />
          <Stack.Screen name="fixed/index" options={{ title: 'Fixed income & bills' }} />
          <Stack.Screen name="fixed/edit" options={{ title: 'Edit fixed item', presentation: 'modal' }} />
          <Stack.Screen name="categories" options={{ title: 'Categories' }} />
          <Stack.Screen name="insights" options={{ title: 'Market prediction' }} />
          <Stack.Screen name="savings/edit" options={{ title: 'Savings goal', presentation: 'modal' }} />
          <Stack.Screen name="transaction/edit" options={{ title: 'Edit entry', presentation: 'modal' }} />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: Palette.void,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bootText: {
    color: Palette.cyan,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bootSub: { color: Palette.textMuted },
});
