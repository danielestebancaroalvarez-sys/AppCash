export type CategoryType = 'income' | 'expense' | 'savings';
export type Period = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';
export type Direction = 'in' | 'out';
export type TransactionType =
  | 'fixed'
  | 'variable'
  | 'income_sporadic'
  | 'expense_sporadic'
  | 'savings_contrib';
export type NotificationStatus = 'pending' | 'sent' | 'read';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  role: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  is_system: boolean;
  updated_at: string;
}

export interface FixedItem {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  amount_aud: number;
  period: Period;
  direction: Direction;
  auto_debit: boolean;
  notify_days_before: number;
  active: boolean;
  next_due: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  category_id: string;
  amount_aud: number;
  date: string;
  note: string;
  merchant: string;
  receipt_id: string;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  store: string;
  total_aud: number;
  photo_uri_or_drive_id: string;
  purchased_at: string;
  raw_gemini_json: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  name: string;
  qty: number;
  unit_price_aud: number;
  line_total_aud: number;
  category_guess: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_aud: number;
  current_aud: number;
  deadline: string;
  user_id: string;
  updated_at: string;
  kind: SavingsGoalKind;
  color: string;
  /** Icon id for custom kinds (see category-icons). */
  icon: string;
  plan_mode: SavingsPlanMode;
  contribution_aud: number;
  contribution_frequency: ContributionFrequency;
  yield_mode: SavingsYieldMode;
  annual_rate: number;
  reminder: boolean;
}

export type SavingsGoalKind =
  | 'emergency'
  | 'vacation'
  | 'home'
  | 'retirement'
  | 'education'
  | 'vehicle'
  | 'family'
  | 'wedding'
  | 'investment'
  | 'custom'
  | 'other';

export type SavingsPlanMode = 'contribution' | 'deadline';
export type SavingsYieldMode = 'none' | 'yield';
export type ContributionFrequency = 'weekly' | 'fortnightly' | 'monthly';

export interface SavingsSim {
  id: string;
  goal_id: string;
  weekly_amount: number;
  result_weeks: number;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  due_at: string;
  related_fixed_id: string;
  status: NotificationStatus;
  updated_at: string;
}

export interface ProductStat {
  id: string;
  product_name_normalized: string;
  avg_price: number;
  buy_frequency_days: number;
  last_seen: string;
  purchase_count: number;
  updated_at: string;
}

export interface OutboxItem {
  id: string;
  sheet: string;
  operation: 'upsert' | 'delete';
  payload_json: string;
  created_at: string;
  attempts: number;
}

export interface GoogleSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  email: string;
  name: string;
  photoUrl?: string;
  spreadsheetId?: string;
}

export interface ParsedReceipt {
  store: string;
  purchased_at: string;
  total_aud: number;
  items: Array<{
    name: string;
    qty: number;
    unit_price_aud: number;
    line_total_aud: number;
    category_guess: string;
  }>;
}
