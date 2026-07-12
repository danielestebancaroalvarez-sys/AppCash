/** Convert a fixed amount for its billing period into a weekly equivalent. */
export function prorateWeekly(amount: number, period: string): number {
  switch (period) {
    case 'weekly':
      return amount;
    case 'fortnightly':
      return amount / 2;
    case 'yearly':
      return amount / 52;
    case 'monthly':
    default:
      return (amount * 12) / 52;
  }
}
