import { Ionicons } from '@expo/vector-icons';
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
  { id: 'other', label: 'Other', ion: 'pricetag-outline', color: '#6B7C96' },
];

export function savingsKindMeta(kind: SavingsGoalKind | string | undefined) {
  return SAVINGS_KINDS.find((k) => k.id === kind) ?? SAVINGS_KINDS[SAVINGS_KINDS.length - 1];
}

export const SectionAccents = {
  hero: Palette.cyan,
  progress: '#FF9F6B',
  contribute: Palette.teal,
  simulate: Palette.violet,
  formName: Palette.cyan,
  formKinds: '#FF9F6B',
  formMoney: Palette.teal,
  formPlan: '#FFC857',
  formYield: Palette.violet,
} as const;
