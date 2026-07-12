import { Redirect } from 'expo-router';
import { useFinanceStore } from '@/stores/finance-store';

export default function Index() {
  const ready = useFinanceStore((s) => s.ready);
  const session = useFinanceStore((s) => s.session);
  if (!ready) return null;
  if (session) return <Redirect href={'/(tabs)' as never} />;
  return <Redirect href={'/login' as never} />;
}
