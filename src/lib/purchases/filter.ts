const STORE_WORDS =
  /\b(kmart|metro|woolworths|coles|aldi|bunnings|costco|target|officeworks|big\s?w|harvey\s?norman|jb\s?hi|chemist|warehouse|iga|foodworks|asian\s?grocery|supermarket|petrol|bp|shell|7-?eleven|mcdonald|hungry\s?jack|kfc|subway)\b/i;

/** Real shop / merchant names we should keep in Top Merchants & Search. */
export function isKnownStoreName(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (STORE_WORDS.test(n)) return true;
  // Short proper store-like tokens (Metro, Kmart alone)
  if (/^(kmart|metro|coles|aldi|target|costco)$/i.test(n)) return true;
  return false;
}

/**
 * Heuristic: receipt line products vs real merchants / purchase titles.
 * Catches Kmart Z-codes (ZMENS ACTIVE), Woolworths WV…, sized groceries, etc.
 */
export function isLikelyProductName(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (isKnownStoreName(n)) return false;

  // House-brand / SKU prefixes: ZMENS, ZESSENTIAL, WV Lite Milk…
  if (/^(z|wv|ww)[a-z0-9]/i.test(n)) return true;

  if (/\b\d+(\.\d+)?\s?(g|kg|ml|l|pk|pack)\b/i.test(n)) return true;
  if (/\b\d+\s?x\s?\d+\b/i.test(n)) return true;

  if (
    /\b(mince|jogger|jacket|hoodie|saucepan|frypan|mouse|glasses|cookies|salami|ham|milk|juice|bag)\b/i.test(
      n
    ) &&
    n.length > 8
  ) {
    return true;
  }

  // ALL-CAPS multi-word product titles without store words
  if (n.length > 6 && n === n.toUpperCase() && /\s/.test(n) && !STORE_WORDS.test(n)) {
    return true;
  }

  if (n.length > 28 && !STORE_WORDS.test(n)) return true;

  return false;
}

export function isPurchaseLevelTransaction(t: {
  receipt_id?: string;
  merchant?: string;
  note?: string;
}): boolean {
  if (t.receipt_id) return true;
  const label = (t.merchant || t.note || '').trim();
  if (!label) return false;
  if (/^receipt\b/i.test(label)) return true;
  if (isKnownStoreName(label)) return true;
  return !isLikelyProductName(label);
}
