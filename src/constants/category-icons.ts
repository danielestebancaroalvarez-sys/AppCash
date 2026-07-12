import { Ionicons } from '@expo/vector-icons';
import { CategoryPalette } from '@/constants/theme';

export type CategoryIconId =
  | 'cart'
  | 'home'
  | 'briefcase'
  | 'sparkles'
  | 'bolt'
  | 'repeat'
  | 'dumbbell'
  | 'utensils'
  | 'car'
  | 'gift'
  | 'shield'
  | 'plane'
  | 'heart'
  | 'cafe'
  | 'phone'
  | 'school'
  | 'paw'
  | 'medical'
  | 'game'
  | 'tag';

export const CATEGORY_ICON_OPTIONS: Array<{
  id: CategoryIconId;
  ion: keyof typeof Ionicons.glyphMap;
  label: string;
}> = [
  { id: 'cart', ion: 'cart-outline', label: 'Cart' },
  { id: 'home', ion: 'home-outline', label: 'Home' },
  { id: 'briefcase', ion: 'briefcase-outline', label: 'Work' },
  { id: 'sparkles', ion: 'star-outline', label: 'Extra' },
  { id: 'bolt', ion: 'flash-outline', label: 'Power' },
  { id: 'repeat', ion: 'repeat-outline', label: 'Sub' },
  { id: 'dumbbell', ion: 'fitness-outline', label: 'Gym' },
  { id: 'utensils', ion: 'restaurant-outline', label: 'Food' },
  { id: 'car', ion: 'car-outline', label: 'Car' },
  { id: 'gift', ion: 'gift-outline', label: 'Gift' },
  { id: 'shield', ion: 'shield-checkmark-outline', label: 'Safe' },
  { id: 'plane', ion: 'airplane-outline', label: 'Travel' },
  { id: 'heart', ion: 'heart-outline', label: 'Health' },
  { id: 'cafe', ion: 'cafe-outline', label: 'Cafe' },
  { id: 'phone', ion: 'phone-portrait-outline', label: 'Phone' },
  { id: 'school', ion: 'school-outline', label: 'School' },
  { id: 'paw', ion: 'paw-outline', label: 'Pets' },
  { id: 'medical', ion: 'medkit-outline', label: 'Medical' },
  { id: 'game', ion: 'game-controller-outline', label: 'Fun' },
  { id: 'tag', ion: 'pricetag-outline', label: 'Other' },
];

const ION_BY_ID = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map((o) => [o.id, o.ion])
) as Record<string, keyof typeof Ionicons.glyphMap>;

export function categoryIonicon(icon: string): keyof typeof Ionicons.glyphMap {
  return ION_BY_ID[icon] ?? 'pricetag-outline';
}

export const CATEGORY_COLOR_OPTIONS = [...CategoryPalette] as string[];
