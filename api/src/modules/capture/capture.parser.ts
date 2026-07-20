/**
 * Natural-language transaction parser (A1 — the flagship).
 *
 * Deterministic by design: `"coffee 250 yesterday"` is a BOUNDED extraction
 * problem — an amount, a date, a category, an account — so rules solve it
 * exactly, for free, offline, with no third-party dependency and nothing to
 * leak. An LLM would handle messier phrasing, but at the cost of latency, spend,
 * a vendor, and non-determinism.
 *
 * This is a pure function: no database, no network, no clock of its own (today
 * is passed in). That makes every rule below directly testable.
 *
 * THE SEAM: `captureService` calls exactly this one function. Swapping in an
 * LLM later means writing a module with the same signature and changing one
 * import — no interface needed until there is a second real implementation.
 */

export interface ParserCategory {
  id: string;
  name: string;
  kind: "income" | "expense";
}

export interface ParserAccount {
  id: string;
  name: string;
  type: string;
}

export interface ParseContext {
  categories: ParserCategory[];
  accounts: ParserAccount[];
  today: Date;
}

export interface ParsedDraft {
  type: "income" | "expense";
  amountMajor: string; // e.g. "250.00" — converted to minor units by the service
  categoryId: string | null;
  accountId: string | null;
  occurredAt: string; // ISO
  note: string;
  confidence: number; // 0–1
  /** Which fields we actually recognised — drives the UI's explanation. */
  matched: {
    amount: boolean;
    date: boolean;
    category: boolean;
    account: boolean;
  };
}

/** Words that flip a sentence from spend to earn. */
const INCOME_WORDS = [
  "salary", "received", "credited", "refund", "refunded", "reimbursed",
  "bonus", "interest", "dividend", "cashback", "got paid", "income",
];

/**
 * Category synonyms. The user's own category names are matched first; this
 * table catches the everyday words people actually type.
 */
const CATEGORY_HINTS: Record<string, string[]> = {
  "Food & Dining": [
    "coffee", "chai", "tea", "lunch", "dinner", "breakfast", "brunch", "snack",
    "swiggy", "zomato", "restaurant", "cafe", "pizza", "burger", "biryani", "food",
  ],
  Groceries: [
    "grocery", "groceries", "bigbasket", "zepto", "blinkit", "instamart",
    "supermarket", "vegetables", "milk", "provisions",
  ],
  Transport: [
    "uber", "ola", "rapido", "cab", "taxi", "auto", "metro", "bus", "train",
    "petrol", "diesel", "fuel", "parking", "toll", "flight",
  ],
  "Rent & Housing": ["rent", "maintenance", "society", "landlord"],
  Utilities: [
    "electricity", "power bill", "water bill", "gas", "internet", "broadband",
    "wifi", "mobile recharge", "recharge", "bill",
  ],
  Shopping: [
    "amazon", "flipkart", "myntra", "clothes", "shoes", "shirt", "shopping",
    "decathlon", "ikea",
  ],
  Entertainment: [
    "movie", "cinema", "pvr", "netflix", "spotify", "concert", "game", "steam",
    "bookmyshow",
  ],
  Health: [
    "medicine", "pharmacy", "doctor", "hospital", "gym", "apollo", "clinic",
    "dentist",
  ],
  Education: ["course", "book", "tuition", "class", "udemy", "coursera"],
  Subscriptions: ["subscription", "membership", "renewal", "prime"],
  Travel: ["hotel", "airbnb", "trip", "vacation", "booking", "irctc"],
  Salary: ["salary", "payday", "paycheck"],
  Freelance: ["freelance", "client", "invoice", "gig", "project payment"],
};

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Amount extraction. Handles ₹/rs prefixes, thousands separators, decimals,
 * and "1.5k" shorthand. Deliberately ignores numbers that are clearly part of a
 * date ("19 july") or an ordinal ("3rd").
 */
function extractAmount(text: string): { value: string; raw: string } | null {
  const cleaned = text
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1__ORDINAL__")
    .replace(/\b(\d{1,2})[/-](\d{1,2})([/-]\d{2,4})?\b/g, " __DATE__ ");

  // ₹1,250.50 · rs 250 · 250 · 1.5k
  const pattern =
    /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(k\b)?/gi;

  let best: { value: number; raw: string } | null = null;

  for (const match of cleaned.matchAll(pattern)) {
    const rawNumber = match[1]!;
    if (rawNumber.includes("__")) continue;

    let value = Number(rawNumber.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    if (match[2]) value *= 1000; // "1.5k"

    // A bare number right before a month name is a date, not money.
    const after = cleaned.slice(match.index! + match[0].length).trim().toLowerCase();
    if (MONTHS.some((month) => after.startsWith(month))) continue;

    if (value <= 0) continue;
    // Prefer the largest plausible number — "coffee 2 cups 250" means 250.
    if (!best || value > best.value) best = { value, raw: match[0].trim() };
  }

  return best ? { value: best.value.toFixed(2), raw: best.raw } : null;
}

/** Date extraction. Returns null when nothing was said, so the caller defaults. */
function extractDate(text: string, today: Date): Date | null {
  const base = startOfDay(today);

  if (/\byesterday\b/.test(text)) return addDays(base, -1);
  if (/\bday before yesterday\b/.test(text)) return addDays(base, -2);
  if (/\btoday\b|\bjust now\b/.test(text)) return base;

  const agoMatch = /\b(\d{1,2})\s*(?:days?)\s*ago\b/.exec(text);
  if (agoMatch) return addDays(base, -Number(agoMatch[1]));

  const weekMatch = /\b(?:last|past)\s+(\w+)\b/.exec(text);
  if (weekMatch) {
    const index = WEEKDAYS.indexOf(weekMatch[1]!.toLowerCase());
    if (index >= 0) {
      const diff = (base.getUTCDay() - index + 7) % 7 || 7;
      return addDays(base, -diff);
    }
    if (weekMatch[1] === "week") return addDays(base, -7);
    if (weekMatch[1] === "month") {
      const d = new Date(base);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d;
    }
  }

  // A bare weekday means the most recent one that has already happened.
  for (const [index, day] of WEEKDAYS.entries()) {
    if (new RegExp(`\\b(?:on\\s+)?${day}\\b`).test(text)) {
      const diff = (base.getUTCDay() - index + 7) % 7 || 7;
      return addDays(base, -diff);
    }
  }

  // "19 july" / "july 19" / "19/07" / "19-07-2026"
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})\\b`).exec(text);
  if (dayMonth) {
    return startOfDay(
      new Date(Date.UTC(base.getUTCFullYear(), MONTHS.indexOf(dayMonth[2]!), Number(dayMonth[1]))),
    );
  }

  const monthDay = new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})\\b`).exec(text);
  if (monthDay) {
    return startOfDay(
      new Date(Date.UTC(base.getUTCFullYear(), MONTHS.indexOf(monthDay[1]!), Number(monthDay[2]))),
    );
  }

  const numeric = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(text);
  if (numeric) {
    const year = numeric[3]
      ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
      : base.getUTCFullYear();
    return startOfDay(
      new Date(Date.UTC(year, Number(numeric[2]) - 1, Number(numeric[1]))),
    );
  }

  return null;
}

function extractCategory(
  text: string,
  categories: ParserCategory[],
  type: "income" | "expense",
): string | null {
  const candidates = categories.filter((category) => category.kind === type);

  // The user's own category names win over our synonym table.
  for (const category of candidates) {
    if (new RegExp(`\\b${category.name.toLowerCase().replace(/[^a-z\s]/g, ".?")}\\b`).test(text)) {
      return category.id;
    }
  }

  for (const category of candidates) {
    const hints = CATEGORY_HINTS[category.name];
    if (!hints) continue;
    if (hints.some((hint) => new RegExp(`\\b${hint}\\b`).test(text))) {
      return category.id;
    }
  }

  return null;
}

function extractAccount(text: string, accounts: ParserAccount[]): string | null {
  for (const account of accounts) {
    const words = account.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.some((word) => new RegExp(`\\b${word}\\b`).test(text))) {
      return account.id;
    }
  }

  const byType: Record<string, string[]> = {
    card: ["card", "credit card", "debit card"],
    cash: ["cash"],
    wallet: ["wallet", "paytm", "upi", "gpay", "phonepe"],
    bank: ["bank", "account", "netbanking"],
  };

  for (const account of accounts) {
    const hints = byType[account.type] ?? [];
    if (hints.some((hint) => new RegExp(`\\b${hint}\\b`).test(text))) {
      return account.id;
    }
  }

  return null;
}

/**
 * Parses one sentence into a transaction draft.
 * Returns null only when there is no amount — without one there is nothing to
 * record, and guessing would be worse than asking.
 */
export function parseTransactionText(
  input: string,
  context: ParseContext,
): ParsedDraft | null {
  const text = input.toLowerCase().trim();
  if (!text) return null;

  const amount = extractAmount(text);
  if (!amount) return null;

  const type: "income" | "expense" = INCOME_WORDS.some((word) =>
    new RegExp(`\\b${word}\\b`).test(text),
  )
    ? "income"
    : "expense";

  const date = extractDate(text, context.today);
  const categoryId = extractCategory(text, context.categories, type);
  const accountId = extractAccount(text, context.accounts);

  const matched = {
    amount: true,
    date: date !== null,
    category: categoryId !== null,
    account: accountId !== null,
  };

  // Confidence is "how much of this sentence did I actually understand?" — it
  // drives whether the UI shows a ready draft or opens the plain form instead.
  const confidence = Math.min(
    0.98,
    0.45 +
      (matched.category ? 0.25 : 0) +
      (matched.date ? 0.18 : 0) +
      (matched.account ? 0.12 : 0),
  );

  return {
    type,
    amountMajor: amount.value,
    categoryId,
    accountId,
    occurredAt: (date ?? startOfDay(context.today)).toISOString(),
    note: input.trim().slice(0, 280),
    confidence: Number(confidence.toFixed(2)),
    matched,
  };
}
