/**
 * Currency conversion for the `amount_base_minor` snapshot (Ch 5 §5.5).
 *
 * v1 uses a small STATIC rate table on purpose: no live FX provider means no cost,
 * no network failure point, and no runtime dependency — and the snapshot is
 * historically honest because it is taken at capture time. Swapping in a live rate
 * provider later means changing this file only.
 */
const RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 83.5,
  EUR: 90.2,
  GBP: 105.8,
  AED: 22.7,
  SGD: 62.1,
  AUD: 55.3,
  CAD: 61.4,
  JPY: 0.56,
};

/** Converts integer minor units between currencies, rounding to the nearest unit. */
export function convertMinor(
  amountMinor: number,
  from: string,
  to: string,
): number {
  if (from === to) return amountMinor;

  const fromRate = RATES_TO_INR[from.toUpperCase()];
  const toRate = RATES_TO_INR[to.toUpperCase()];

  // Unknown currency → fall back to 1:1 rather than throwing. Documented
  // limitation: a rate we don't know is better than a failed capture.
  if (!fromRate || !toRate) return amountMinor;

  return Math.round((amountMinor * fromRate) / toRate);
}
