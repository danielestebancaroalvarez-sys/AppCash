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
