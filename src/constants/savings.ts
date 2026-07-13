import { Ionicons } from '@expo/vector-icons';
import { categoryIonicon } from '@/constants/category-icons';
import { Palette } from '@/constants/theme';
import type { SavingsGoalKind } from '@/types/models';

export const SAVINGS_KINDS: Array<{
  id: SavingsGoalKind;
  label: string;
  ion: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  { id: 'emergency', label: 'Emergency', ion: 'shield-checkmark-outline', color: Palette.teal },
  { id: 'vacation', label: 'Vacation', ion: 'airplane-outline', color: '#3DE7FF' },
  { id: 'home', label: 'Home', ion: 'home-outline', color: '#FF9F6B' },
  { id: 'retirement', label: 'Retirement', ion: 'cash-outline', color: Palette.violet },
  { id: 'education', label: 'Education', ion: 'school-outline', color: '#8B9BB8' },
  { id: 'vehicle', label: 'Vehicle', ion: 'car-outline', color: '#FFC857' },
  { id: 'family', label: 'Family', ion: 'heart-outline', color: '#FF6B9A' },
  { id: 'wedding', label: 'Event', ion: 'gift-outline', color: '#FF7EB6' },
  { id: 'investment', label: 'Invest', ion: 'business-outline', color: '#5B8CFF' },
  { id: 'custom', label: 'Custom', ion: 'add-circle-outline', color: Palette.cyan },
];

export function savingsKindMeta(
  kind: SavingsGoalKind | string | undefined,
  icon?: string
): {
  id: string;
  label: string;
  ion: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  if (kind === 'custom' || kind === 'other') {
    return {
      id: 'custom',
      label: 'Custom',
      ion: icon ? categoryIonicon(icon) : 'pricetag-outline',
      color: Palette.cyan,
    };
  }
  return SAVINGS_KINDS.find((k) => k.id === kind) ?? SAVINGS_KINDS[SAVINGS_KINDS.length - 1];
}

export const SectionAccents = {
  hero: Palette.cyan,
  progress: Palette.cyan,
  contribute: Palette.teal,
  simulate: Palette.violet,
  formName: Palette.cyan,
  formKinds: Palette.cyan,
  formMoney: Palette.teal,
  formPlan: '#FFC857',
  formYield: Palette.violet,
} as const;

/** Distinct card colours so neighbouring goals never share an accent. */
export const SAVINGS_CARD_COLORS = [
  '#3DE7FF',
  '#FF9F6B',
  '#8B7CFF',
  '#2EE6A6',
  '#FF6B9A',
  '#5B8CFF',
  '#FFC857',
  '#6BFFD8',
  '#FF7EB6',
  '#A78BFA',
] as const;

/** Prefer goal.color / kind colour, then fall back to an unused palette slot by index. */
export function resolveSavingsCardColor(
  goal: { color?: string; kind?: string },
  index: number,
  used: Set<string>
): string {
  const preferred = (goal.color || savingsKindMeta(goal.kind).color || '').toLowerCase();
  if (preferred && !used.has(preferred)) {
    used.add(preferred);
    return goal.color || savingsKindMeta(goal.kind).color;
  }
  for (let i = 0; i < SAVINGS_CARD_COLORS.length; i++) {
    const c = SAVINGS_CARD_COLORS[(index + i) % SAVINGS_CARD_COLORS.length];
    if (!used.has(c.toLowerCase())) {
      used.add(c.toLowerCase());
      return c;
    }
  }
  const fallback = SAVINGS_CARD_COLORS[index % SAVINGS_CARD_COLORS.length];
  used.add(fallback.toLowerCase());
  return fallback;
}
