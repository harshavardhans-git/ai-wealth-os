/**
 * A small RFC-4180 CSV parser.
 *
 * Hand-written rather than pulled from a package because the correctness bar is
 * a ~50-line state machine, and Ch 12 asks us to keep the dependency surface
 * small. A naive `split(",")` breaks on the very first quoted field containing a
 * comma — which real bank statements are full of ("SWIGGY, HYDERABAD").
 *
 * Handles: quoted fields, escaped quotes (""), commas and newlines inside
 * quotes, CRLF line endings, and a leading UTF-8 BOM (Excel loves those).
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // an escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (char === "\r") {
      i += 1; // CRLF — the \n does the work
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop entirely blank lines (trailing newline, separator rows).
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/**
 * Parses the date formats bank exports actually use. Returns null rather than
 * throwing, so one bad row can be reported instead of failing the whole file.
 */
export function parseFlexibleDate(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  // ISO: 2026-07-19
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    return new Date(Date.UTC(+iso[1]!, +iso[2]! - 1, +iso[3]!));
  }

  // DD/MM/YYYY or DD-MM-YYYY (the Indian/European convention)
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(raw);
  if (dmy) {
    const year = +dmy[3]! < 100 ? 2000 + +dmy[3]! : +dmy[3]!;
    return new Date(Date.UTC(year, +dmy[2]! - 1, +dmy[1]!));
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Normalizes a money cell. Handles currency symbols, thousands separators,
 * trailing Dr/Cr markers, and accounting-style parentheses for negatives.
 * Returns the signed major-unit value, or null if unparseable.
 */
export function parseAmount(value: string): number | null {
  let raw = value.trim();
  if (!raw) return null;

  let negative = false;

  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  if (/\bdr\b/i.test(raw)) negative = true;
  if (/\bcr\b/i.test(raw)) negative = false;

  raw = raw.replace(/(dr|cr)/gi, "").replace(/[₹$€£,\s]/g, "");

  if (raw.startsWith("-")) {
    negative = true;
    raw = raw.slice(1);
  }

  if (!/^\d+(\.\d+)?$/.test(raw)) return null;

  const amount = Number(raw);
  return negative ? -amount : amount;
}
