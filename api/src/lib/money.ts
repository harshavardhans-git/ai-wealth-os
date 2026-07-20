/**
 * Money helpers (Ch 5 D1). Money is ALWAYS integer minor units (paise/cents).
 * Floats are never used for arithmetic — `0.1 + 0.2 !== 0.3` in IEEE-754, which in a
 * finance app silently loses money. All conversion lives here, in one place.
 */

const DEFAULT_DECIMALS = 2;

/**
 * "320.50" | 320.5  →  32050   (exact; parsed as text, never via float math)
 */
export function toMinor(
  amount: string | number,
  decimals = DEFAULT_DECIMALS,
): number {
  const raw =
    typeof amount === "number" ? amount.toFixed(decimals) : amount.trim();

  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid money value: ${amount}`);
  }

  const isNegative = raw.startsWith("-");
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = unsigned.split(".");

  const paddedFraction = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const minor = Number(whole) * 10 ** decimals + Number(paddedFraction || "0");

  return isNegative ? -minor : minor;
}

/**
 * 32050 → "320.50"  (string, so no float ever re-enters the picture)
 */
export function fromMinor(
  minor: number,
  decimals = DEFAULT_DECIMALS,
): string {
  const isNegative = minor < 0;
  const digits = Math.abs(Math.trunc(minor))
    .toString()
    .padStart(decimals + 1, "0");

  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);

  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Prisma returns BigInt for our money columns; JSON.stringify(bigint) throws.
 * The repository layer converts here before values cross the API boundary (Ch 5).
 */
export function bigIntToNumber(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error("Amount exceeds JavaScript's safe integer range");
  }
  return Number(value);
}
