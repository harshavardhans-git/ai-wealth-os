/**
 * Client-side money formatting (Ch 5 D1, Ch 11 §11.3).
 * Values arrive from the API as INTEGER minor units. The only division by 100 in the
 * whole app happens here, at the display edge, where a float can no longer cause harm.
 */
export function formatMoney(
  amountMinor: number,
  currency = "INR",
  locale = "en-IN",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
