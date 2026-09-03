/** Naira formatting, matching the mockups: whole naira, no decimals. */
export function naira(value) {
  return '₦' + Number(Math.round(value)).toLocaleString('en-NG');
}

/** Compact naira for badges — ₦186,000 becomes "₦186K". */
export function nairaShort(value) {
  const n = Math.round(value);
  if (Math.abs(n) >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1_000) return '₦' + Math.round(n / 1_000) + 'K';
  return naira(n);
}

/** "+₦46,000" / "−₦46,000" / "Included" — used by the swap and option lists. */
export function delta(value) {
  if (value === 0) return 'Included';
  return (value > 0 ? '+' : '−') + naira(Math.abs(value));
}
