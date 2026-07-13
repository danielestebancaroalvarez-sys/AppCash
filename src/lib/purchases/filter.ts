/** Heuristic: receipt line products vs real merchants / purchase titles. */
export function isLikelyProductName(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (/\b\d+(\.\d+)?\s?(g|kg|ml|l|pk|pack|pack)\b/i.test(n)) return true;
  if (/\b\d+\s?x\s?\d+\b/i.test(n)) return true;
  if (/^(wv|ww|z|aldi)\b/i.test(n)) return true;
  if (/\b(mince|jogger|jacket|saucepan|cookies|salami|ham|milk|juice)\b/i.test(n) && n.length > 12) {
    return true;
  }
  // Very long SKU-like titles without store words
  if (n.length > 28 && !/\b(woolworths|coles|aldi|kmart|bunnings|costco|target)\b/i.test(n)) {
    return true;
  }
  return false;
}

export function isPurchaseLevelTransaction(t: {
  receipt_id?: string;
  merchant?: string;
  note?: string;
}): boolean {
  if (t.receipt_id) return true;
  const label = t.merchant || t.note || '';
  if (/^receipt\b/i.test(label)) return true;
  return !isLikelyProductName(label);
}
