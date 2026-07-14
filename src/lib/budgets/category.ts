import { getSetting, setSetting } from '@/lib/db';

export const CATEGORY_BUDGETS_KEY = 'category_budgets_v1';

export type CategoryBudgets = Record<string, number>;

export async function loadCategoryBudgets(): Promise<CategoryBudgets> {
  const raw = await getSetting(CATEGORY_BUDGETS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CategoryBudgets;
    const out: CategoryBudgets = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveCategoryBudgets(budgets: CategoryBudgets): Promise<void> {
  await setSetting(CATEGORY_BUDGETS_KEY, JSON.stringify(budgets));
}

export async function setCategoryBudget(categoryId: string, amountAud: number): Promise<CategoryBudgets> {
  const budgets = await loadCategoryBudgets();
  if (amountAud <= 0) delete budgets[categoryId];
  else budgets[categoryId] = amountAud;
  await saveCategoryBudgets(budgets);
  return budgets;
}
