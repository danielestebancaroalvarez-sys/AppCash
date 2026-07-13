import { CategoryPalette } from '@/constants/theme';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import {
  getSetting,
  listCategories,
  listUsers,
  setSetting,
  upsertCategory,
  upsertUser,
} from '@/lib/db';
import type { Category, CategoryType } from '@/types/models';

const DEFAULT_CATEGORIES: Array<{ name: string; type: CategoryType; icon: string; color: string }> = [
  // Income
  { name: 'Salary', type: 'income', icon: 'briefcase', color: CategoryPalette[1] },
  { name: 'Side income', type: 'income', icon: 'sparkles', color: CategoryPalette[0] },
  { name: 'Refunds', type: 'income', icon: 'cash', color: CategoryPalette[5] },
  { name: 'Investments', type: 'income', icon: 'wallet', color: CategoryPalette[4] },
  // Expense
  { name: 'Rent', type: 'expense', icon: 'home', color: CategoryPalette[4] },
  { name: 'Utilities', type: 'expense', icon: 'bolt', color: CategoryPalette[5] },
  { name: 'Internet & phone', type: 'expense', icon: 'wifi', color: CategoryPalette[0] },
  { name: 'Subscriptions', type: 'expense', icon: 'repeat', color: CategoryPalette[3] },
  { name: 'Gym', type: 'expense', icon: 'dumbbell', color: CategoryPalette[6] },
  { name: 'Groceries', type: 'expense', icon: 'cart', color: CategoryPalette[1] },
  { name: 'Restaurants', type: 'expense', icon: 'utensils', color: CategoryPalette[7] },
  { name: 'Coffee & snacks', type: 'expense', icon: 'cafe', color: CategoryPalette[2] },
  { name: 'Transport', type: 'expense', icon: 'car', color: CategoryPalette[2] },
  { name: 'Fuel', type: 'expense', icon: 'flame', color: CategoryPalette[6] },
  { name: 'Health', type: 'expense', icon: 'medical', color: CategoryPalette[3] },
  { name: 'Insurance', type: 'expense', icon: 'umbrella', color: CategoryPalette[5] },
  { name: 'Personal care', type: 'expense', icon: 'sparkle', color: CategoryPalette[7] },
  { name: 'Clothes', type: 'expense', icon: 'shirt', color: CategoryPalette[4] },
  { name: 'Tech & gadgets', type: 'expense', icon: 'laptop', color: CategoryPalette[0] },
  { name: 'Entertainment', type: 'expense', icon: 'film', color: CategoryPalette[3] },
  { name: 'Pets', type: 'expense', icon: 'paw', color: CategoryPalette[1] },
  { name: 'Kids & family', type: 'expense', icon: 'people', color: CategoryPalette[7] },
  { name: 'Home & DIY', type: 'expense', icon: 'construct', color: CategoryPalette[6] },
  { name: 'Education', type: 'expense', icon: 'school', color: CategoryPalette[5] },
  { name: 'Extras', type: 'expense', icon: 'gift', color: CategoryPalette[3] },
  // Savings
  { name: 'Emergency fund', type: 'savings', icon: 'shield', color: CategoryPalette[0] },
  { name: 'Holiday', type: 'savings', icon: 'plane', color: CategoryPalette[5] },
  { name: 'House deposit', type: 'savings', icon: 'home', color: CategoryPalette[4] },
  { name: 'Car fund', type: 'savings', icon: 'car', color: CategoryPalette[2] },
];

/** Always safe to call — fills missing users/categories without wiping real data. */
export async function ensureHouseholdDefaults(
  profileName = 'Me',
  profileEmail = '',
  avatarUrl = ''
): Promise<void> {
  await ensureOwnerProfile(profileName, profileEmail, avatarUrl);

  const users = await listUsers();
  const primaryId = users.find((u) => u.role === 'owner')?.id ?? users[0]?.id;

  const cats = await listCategories();
  const byName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));

  for (const def of DEFAULT_CATEGORIES) {
    if (byName.has(def.name.toLowerCase())) continue;
    const cat: Category = {
      id: createId(),
      name: def.name,
      type: def.type,
      icon: def.icon,
      color: def.color,
      is_system: true,
      updated_at: nowIso(),
    };
    await upsertCategory(cat);
  }

  const active = await getSetting('active_user_id');
  if (!active && primaryId) await setSetting('active_user_id', primaryId);
  await setSetting('currency', 'AUD');
  await setSetting('week_starts', 'Monday');
  if ((await getSetting('sync_interval_sec')) == null) {
    await setSetting('sync_interval_sec', '45');
  }
  await setSetting('seeded_v1', '1');
}

/** @deprecated use ensureHouseholdDefaults */
export async function seedIfNeeded(
  profileName: string,
  profileEmail: string,
  avatarUrl = ''
): Promise<void> {
  await ensureHouseholdDefaults(profileName, profileEmail, avatarUrl);
}

async function ensureOwnerProfile(name: string, email: string, avatarUrl: string) {
  const users = await listUsers();
  const owner = users.find((u) => u.role === 'owner') ?? users[0];
  if (owner) {
    await upsertUser({
      ...owner,
      name: name || owner.name || 'Me',
      email: email || owner.email,
      avatar_url: avatarUrl || owner.avatar_url,
      updated_at: nowIso(),
    });
    return;
  }
  const id = createId();
  await upsertUser({
    id,
    name: name || 'Me',
    email,
    avatar_url: avatarUrl,
    role: 'owner',
    updated_at: nowIso(),
  });
  await setSetting('active_user_id', id);
}
