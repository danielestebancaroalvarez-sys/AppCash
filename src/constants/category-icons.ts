import { Ionicons } from '@expo/vector-icons';
import { CategoryPalette } from '@/constants/theme';

export type CategoryIconId = string;

export const CATEGORY_ICON_OPTIONS: Array<{
  id: string;
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
  { id: 'bus', ion: 'bus-outline', label: 'Bus' },
  { id: 'train', ion: 'train-outline', label: 'Train' },
  { id: 'gift', ion: 'gift-outline', label: 'Gift' },
  { id: 'shield', ion: 'shield-checkmark-outline', label: 'Safe' },
  { id: 'plane', ion: 'airplane-outline', label: 'Travel' },
  { id: 'heart', ion: 'heart-outline', label: 'Health' },
  { id: 'cafe', ion: 'cafe-outline', label: 'Cafe' },
  { id: 'beer', ion: 'beer-outline', label: 'Drinks' },
  { id: 'phone', ion: 'phone-portrait-outline', label: 'Phone' },
  { id: 'laptop', ion: 'laptop-outline', label: 'Tech' },
  { id: 'wifi', ion: 'wifi-outline', label: 'Internet' },
  { id: 'tv', ion: 'tv-outline', label: 'TV' },
  { id: 'game', ion: 'game-controller-outline', label: 'Fun' },
  { id: 'film', ion: 'film-outline', label: 'Movies' },
  { id: 'music', ion: 'musical-notes-outline', label: 'Music' },
  { id: 'school', ion: 'school-outline', label: 'School' },
  { id: 'book', ion: 'book-outline', label: 'Books' },
  { id: 'paw', ion: 'paw-outline', label: 'Pets' },
  { id: 'medical', ion: 'medkit-outline', label: 'Medical' },
  { id: 'fitness', ion: 'bicycle-outline', label: 'Sport' },
  { id: 'shirt', ion: 'shirt-outline', label: 'Clothes' },
  { id: 'cut', ion: 'cut-outline', label: 'Hair' },
  { id: 'sparkle', ion: 'sparkles-outline', label: 'Beauty' },
  { id: 'bed', ion: 'bed-outline', label: 'Stay' },
  { id: 'construct', ion: 'construct-outline', label: 'Repair' },
  { id: 'hammer', ion: 'hammer-outline', label: 'Tools' },
  { id: 'leaf', ion: 'leaf-outline', label: 'Garden' },
  { id: 'water', ion: 'water-outline', label: 'Water' },
  { id: 'flame', ion: 'flame-outline', label: 'Gas' },
  { id: 'card', ion: 'card-outline', label: 'Bank' },
  { id: 'cash', ion: 'cash-outline', label: 'Cash' },
  { id: 'wallet', ion: 'wallet-outline', label: 'Wallet' },
  { id: 'pricetag', ion: 'pricetag-outline', label: 'Sale' },
  { id: 'basket', ion: 'basket-outline', label: 'Shop' },
  { id: 'storefront', ion: 'storefront-outline', label: 'Store' },
  { id: 'cube', ion: 'cube-outline', label: 'Item' },
  { id: 'pizza', ion: 'pizza-outline', label: 'Takeaway' },
  { id: 'ice', ion: 'ice-cream-outline', label: 'Treats' },
  { id: 'baby', ion: 'happy-outline', label: 'Kids' },
  { id: 'people', ion: 'people-outline', label: 'Family' },
  { id: 'ring', ion: 'diamond-outline', label: 'Event' },
  { id: 'trophy', ion: 'trophy-outline', label: 'Goal' },
  { id: 'rocket', ion: 'rocket-outline', label: 'Start' },
  { id: 'globe', ion: 'globe-outline', label: 'World' },
  { id: 'umbrella', ion: 'umbrella-outline', label: 'Insurance' },
  { id: 'document', ion: 'document-text-outline', label: 'Tax' },
  { id: 'calendar', ion: 'calendar-outline', label: 'Date' },
  { id: 'tag', ion: 'cube-outline', label: 'Other' },
];

const ION_BY_ID = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map((o) => [o.id, o.ion])
) as Record<string, keyof typeof Ionicons.glyphMap>;

export function categoryIonicon(icon: string): keyof typeof Ionicons.glyphMap {
  return ION_BY_ID[icon] ?? 'cube-outline';
}

/** Icon for a receipt line-item (product inside a purchase). */
export function receiptItemIonicon(): keyof typeof Ionicons.glyphMap {
  return 'cube-outline';
}

/** Icon for a merchant / store purchase. */
export function merchantIonicon(): keyof typeof Ionicons.glyphMap {
  return 'storefront-outline';
}

export const CATEGORY_COLOR_OPTIONS = [
  ...CategoryPalette,
  '#5B8CFF',
  '#FF7EB6',
  '#6BFFD8',
  '#C4B5FD',
  '#FCA5A5',
  '#FDE68A',
] as string[];
