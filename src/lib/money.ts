const formatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
});

export function formatAud(amount: number): string {
  return formatter.format(amount || 0);
}

/** Compact AUD for chart labels (e.g. $12, $1.2k). */
export function formatAudShort(amount: number): string {
  const n = amount || 0;
  if (n <= 0) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
