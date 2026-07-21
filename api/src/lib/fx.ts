/**
 * Currency conversion for the `amount_base_minor` snapshot (Ch 5 §5.5).
 *
 * v1 uses a small STATIC rate table on purpose: no live FX provider means no cost,
 * no network failure point, and no runtime dependency — and the snapshot is
 * historically honest because it is taken at capture time. Swapping in a live rate
 * provider later means changing this file only.
 */
/**
 * Rates are stored as INTEGERS scaled by RATE_SCALE — ten-thousandths of a rupee
 * — for the same reason money is stored in minor units: `83.5` is not exactly
 * representable in binary floating point, and a rate is a multiplier applied to
 * every amount in the system.
 *
 * Keeping them integral also lets the SQL backfill (Ch 5 §5.5) do exact rational
 * arithmetic in `numeric`, instead of collapsing the pair into one lossy ratio.
 */
const RATE_SCALE = 10_000;

const RATES_TO_INR: Record<string, number> = {
  INR: 1 * RATE_SCALE,
  USD: 835_000,
  EUR: 902_000,
  GBP: 1_058_000,
  AED: 227_000,
  SGD: 621_000,
  AUD: 553_000,
  CAD: 614_000,
  JPY: 5_600,
};

/**
 * The scaled rate pair for a conversion, or null when either side is unknown.
 *
 * Exposed so callers that convert in SQL can pass both integers through and let
 * Postgres divide exactly, rather than pre-dividing in JS and passing a float.
 */
export function ratePair(
  from: string,
  to: string,
): { fromRate: number; toRate: number } | null {
  const fromRate = RATES_TO_INR[from.toUpperCase()];
  const toRate = RATES_TO_INR[to.toUpperCase()];

  // Unknown currency → fall back to 1:1 rather than throwing. Documented
  // limitation: a rate we don't know is better than a failed capture.
  if (!fromRate || !toRate) return null;

  return { fromRate, toRate };
}

/**
 * Converts integer minor units between currencies.
 *
 * Multiply first, divide once, round once. Dividing first would round twice and
 * drift — which is exactly the bug this signature is shaped to prevent.
 */
export function convertMinor(
  amountMinor: number,
  from: string,
  to: string,
): number {
  if (from === to) return amountMinor;

  const rates = ratePair(from, to);
  if (!rates) return amountMinor;

  return Math.round((amountMinor * rates.fromRate) / rates.toRate);
}
