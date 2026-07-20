import { describe, expect, it } from "vitest";
import { parseAmount, parseCsv, parseFlexibleDate } from "./csv";

/**
 * The CSV parser is hand-written, so it carries its own weight in tests.
 * Every case here is something a real bank statement actually contains — the
 * naive `split(",")` implementation fails the second test onwards.
 */
describe("parseCsv", () => {
  it("parses a plain file", () => {
    expect(parseCsv("date,note,amount\n2026-07-01,Coffee,250")).toEqual([
      ["date", "note", "amount"],
      ["2026-07-01", "Coffee", "250"],
    ]);
  });

  it("keeps commas that live inside quoted fields", () => {
    expect(parseCsv('date,note\n2026-07-01,"SWIGGY, HYDERABAD"')).toEqual([
      ["date", "note"],
      ["2026-07-01", "SWIGGY, HYDERABAD"],
    ]);
  });

  it("handles escaped quotes", () => {
    expect(parseCsv('note\n"He said ""hello"""')).toEqual([
      ["note"],
      ['He said "hello"'],
    ]);
  });

  it("handles newlines inside quoted fields", () => {
    expect(parseCsv('note,amount\n"line one\nline two",100')).toEqual([
      ["note", "amount"],
      ["line one\nline two", "100"],
    ]);
  });

  it("handles CRLF line endings and a UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseFlexibleDate", () => {
  it("parses ISO dates", () => {
    expect(parseFlexibleDate("2026-07-19")?.toISOString()).toBe(
      "2026-07-19T00:00:00.000Z",
    );
  });

  it("parses DD/MM/YYYY as day-first, not month-first", () => {
    // 07/03/2026 is 7 March in an Indian statement, not 3 July.
    expect(parseFlexibleDate("07/03/2026")?.toISOString()).toBe(
      "2026-03-07T00:00:00.000Z",
    );
  });

  it("parses DD-MM-YY", () => {
    expect(parseFlexibleDate("19-07-26")?.toISOString()).toBe(
      "2026-07-19T00:00:00.000Z",
    );
  });

  it("returns null for junk instead of throwing", () => {
    expect(parseFlexibleDate("not a date")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("parses plain numbers", () => {
    expect(parseAmount("250.50")).toBe(250.5);
  });

  it("strips currency symbols and thousands separators", () => {
    expect(parseAmount("₹1,25,000.00")).toBe(125000);
    expect(parseAmount("$1,200.50")).toBe(1200.5);
  });

  it("treats accounting parentheses as negative", () => {
    expect(parseAmount("(450.00)")).toBe(-450);
  });

  it("reads Dr/Cr markers", () => {
    expect(parseAmount("1,200.00 Dr")).toBe(-1200);
    expect(parseAmount("1,200.00 Cr")).toBe(1200);
  });

  it("handles leading minus", () => {
    expect(parseAmount("-320.50")).toBe(-320.5);
  });

  it("returns null for junk", () => {
    expect(parseAmount("N/A")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});
