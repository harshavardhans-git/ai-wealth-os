import { describe, expect, it } from "vitest";
import { bigIntToNumber, fromMinor, toMinor } from "./money";

/**
 * Crown-jewel test #1 (Ch 13 §13.2): money is exact.
 * A float bug in a finance app is silent and corrupts trust — this is the first
 * test in the repo for that reason.
 */
describe("money", () => {
  it("is exact where floating point is not", () => {
    // The bug we are defending against, demonstrated:
    expect(0.1 + 0.2).not.toBe(0.3);

    // Our representation has no such problem:
    expect(toMinor("0.1") + toMinor("0.2")).toBe(toMinor("0.3"));
  });

  it("converts major units → minor units", () => {
    expect(toMinor("320.50")).toBe(32050);
    expect(toMinor("0.05")).toBe(5);
    expect(toMinor("1000")).toBe(100000);
    expect(toMinor(250)).toBe(25000);
  });

  it("converts minor units → display string", () => {
    expect(fromMinor(32050)).toBe("320.50");
    expect(fromMinor(5)).toBe("0.05");
    expect(fromMinor(100000)).toBe("1000.00");
    expect(fromMinor(0)).toBe("0.00");
  });

  it("round-trips without drift", () => {
    for (const value of ["0.00", "0.01", "9.99", "1234.56", "99999.99"]) {
      expect(fromMinor(toMinor(value))).toBe(value);
    }
  });

  it("rejects values that are not money", () => {
    expect(() => toMinor("abc")).toThrow();
    expect(() => toMinor("12.3.4")).toThrow();
  });

  it("converts Prisma BigInt safely and refuses unsafe values", () => {
    expect(bigIntToNumber(32050n)).toBe(32050);
    expect(() => bigIntToNumber(BigInt(Number.MAX_SAFE_INTEGER) + 10n)).toThrow();
  });
});
