import { describe, expect, it } from "vitest";
import { parseTransactionText, type ParseContext } from "./capture.parser";

const CATEGORIES = [
  { id: "cat-food", name: "Food & Dining", kind: "expense" as const },
  { id: "cat-transport", name: "Transport", kind: "expense" as const },
  { id: "cat-groceries", name: "Groceries", kind: "expense" as const },
  { id: "cat-rent", name: "Rent & Housing", kind: "expense" as const },
  { id: "cat-shopping", name: "Shopping", kind: "expense" as const },
  { id: "cat-salary", name: "Salary", kind: "income" as const },
];

const ACCOUNTS = [
  { id: "acc-bank", name: "HDFC Bank", type: "bank" },
  { id: "acc-card", name: "HDFC Credit Card", type: "card" },
  { id: "acc-cash", name: "Cash", type: "cash" },
];

// A Sunday, so weekday arithmetic is easy to reason about.
const TODAY = new Date("2026-07-19T12:00:00.000Z");

const context: ParseContext = {
  categories: CATEGORIES,
  accounts: ACCOUNTS,
  today: TODAY,
};

const parse = (input: string) => parseTransactionText(input, context);
const dayOf = (iso: string | undefined) => iso?.slice(0, 10);

describe("parseTransactionText — the flagship", () => {
  it("parses the canonical example", () => {
    const draft = parse("coffee 250 yesterday");

    expect(draft).not.toBeNull();
    expect(draft!.amountMajor).toBe("250.00");
    expect(draft!.type).toBe("expense");
    expect(draft!.categoryId).toBe("cat-food");
    expect(dayOf(draft!.occurredAt)).toBe("2026-07-18");
  });

  it("returns null without an amount — nothing to record", () => {
    expect(parse("had coffee yesterday")).toBeNull();
    expect(parse("")).toBeNull();
  });

  describe("amounts", () => {
    it("reads currency symbols and separators", () => {
      expect(parse("rent ₹22,000")!.amountMajor).toBe("22000.00");
      expect(parse("rs 450 for petrol")!.amountMajor).toBe("450.00");
      expect(parse("shopping 1,250.50")!.amountMajor).toBe("1250.50");
    });

    it("understands k shorthand", () => {
      expect(parse("rent 22k")!.amountMajor).toBe("22000.00");
      expect(parse("laptop 1.5k")!.amountMajor).toBe("1500.00");
    });

    it("does not mistake a date for an amount", () => {
      // "19 july" must not be read as ₹19
      expect(parse("groceries 1450 on 19 july")!.amountMajor).toBe("1450.00");
      expect(parse("dinner 800 on 12/07")!.amountMajor).toBe("800.00");
    });
  });

  describe("dates", () => {
    it("defaults to today when nothing is said", () => {
      const draft = parse("lunch 300")!;
      expect(dayOf(draft.occurredAt)).toBe("2026-07-19");
      expect(draft.matched.date).toBe(false);
    });

    it("handles relative words", () => {
      expect(dayOf(parse("coffee 250 today")!.occurredAt)).toBe("2026-07-19");
      expect(dayOf(parse("coffee 250 yesterday")!.occurredAt)).toBe("2026-07-18");
      expect(dayOf(parse("coffee 250 3 days ago")!.occurredAt)).toBe("2026-07-16");
    });

    it("handles weekdays as the most recent past one", () => {
      // Today is Sunday 19 July; last Friday is the 17th.
      expect(dayOf(parse("dinner 900 on friday")!.occurredAt)).toBe("2026-07-17");
      expect(dayOf(parse("dinner 900 last friday")!.occurredAt)).toBe("2026-07-17");
    });

    it("handles explicit dates", () => {
      expect(dayOf(parse("groceries 1200 on 12 july")!.occurredAt)).toBe("2026-07-12");
      expect(dayOf(parse("groceries 1200 july 12")!.occurredAt)).toBe("2026-07-12");
      // Day-first, matching Indian convention
      expect(dayOf(parse("groceries 1200 on 12/07")!.occurredAt)).toBe("2026-07-12");
    });
  });

  describe("income vs expense", () => {
    it("treats spend as the default", () => {
      expect(parse("uber 240")!.type).toBe("expense");
    });

    it("detects income words", () => {
      expect(parse("salary 85000 credited")!.type).toBe("income");
      expect(parse("refund 1200 received")!.type).toBe("income");
    });

    it("only offers categories of the matching kind", () => {
      const draft = parse("salary 85000")!;
      expect(draft.type).toBe("income");
      expect(draft.categoryId).toBe("cat-salary");
    });
  });

  describe("categories", () => {
    it("matches everyday words via synonyms", () => {
      expect(parse("swiggy 480")!.categoryId).toBe("cat-food");
      expect(parse("uber to office 180")!.categoryId).toBe("cat-transport");
      expect(parse("bigbasket 1450")!.categoryId).toBe("cat-groceries");
      expect(parse("amazon order 2300")!.categoryId).toBe("cat-shopping");
    });

    it("matches the user's own category names", () => {
      expect(parse("transport 300")!.categoryId).toBe("cat-transport");
    });

    it("leaves category null when nothing matches", () => {
      const draft = parse("something odd 500")!;
      expect(draft.categoryId).toBeNull();
      expect(draft.matched.category).toBe(false);
    });
  });

  describe("accounts", () => {
    it("matches by account name", () => {
      expect(parse("coffee 250 hdfc")!.accountId).toBe("acc-bank");
    });

    it("matches by account type words", () => {
      expect(parse("dinner 900 with card")!.accountId).toBe("acc-card");
      expect(parse("chai 30 cash")!.accountId).toBe("acc-cash");
    });

    it("leaves account null when unstated", () => {
      expect(parse("coffee 250")!.accountId).toBeNull();
    });
  });

  describe("confidence", () => {
    it("is highest when everything is understood", () => {
      const full = parse("swiggy 480 yesterday with card")!;
      expect(full.confidence).toBeGreaterThan(0.9);
      expect(full.matched).toEqual({
        amount: true, date: true, category: true, account: true,
      });
    });

    it("drops when only an amount is understood", () => {
      const sparse = parse("something 500")!;
      expect(sparse.confidence).toBeLessThan(0.6);
    });

    it("never claims certainty", () => {
      expect(parse("swiggy 480 yesterday with card")!.confidence).toBeLessThanOrEqual(0.98);
    });
  });

  it("keeps the original text as the note", () => {
    expect(parse("Coffee 250 Yesterday")!.note).toBe("Coffee 250 Yesterday");
  });
});
