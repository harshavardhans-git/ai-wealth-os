# Chapter 16 — Decision Log

Architecture decisions that **changed after the blueprint was written**. Each entry
records what we originally decided, what we learned, what we changed, and what it
cost — because a design that never changed during implementation is usually a
design nobody actually built.

The earlier chapters are left as originally written, with a pointer to the
relevant entry here. Erasing the original reasoning would hide the most useful
part: the *revision*.

---

## ADR-001 · Natural-language capture uses a deterministic parser, not an LLM

**Status:** Accepted · Supersedes the LLM design in Chapter 9 · Decided during Sprint 4

### Context

Chapters 0, 1, 3 and 9 designed the flagship feature (A1 — natural-language
transaction capture) around a hosted language model, with a `ClaudeAdapter`, a
structured-output contract, a token budget, and a demo-mode cache to keep the
public demo free.

Two things surfaced once we reached implementation:

1. **The owner did not want the project to depend on a third-party AI account** —
   not wanting to own, fund, or risk leaking a vendor credential in a personal
   portfolio project.
2. **Re-examining the problem, the model was not actually load-bearing.**
   `"coffee 250 yesterday"` is a *bounded extraction* problem: an amount, a date,
   a category from a known list, an account from a known list. That is a parsing
   problem, not a reasoning one.

### Decision

Implement capture as a **deterministic parser** (`capture.parser.ts`): a pure
function over the user's own categories and accounts.

Keep the **seam** — `captureService` calls exactly one function with a clear
signature — so an LLM implementation can be added later as a second module and a
one-line import change. We did **not** introduce an interface for it: with one
implementation, an interface is a guess about what varies (see the "extract, don't
invent" reasoning in Ch 5 §5.7's ORM discussion).

### Consequences

**Gained**
- ₹0 per capture, forever — no metering, no budget, no demo-mode cache needed
- Deterministic: the same sentence always yields the same draft, so it is
  fully unit-testable (22 cases, all passing) and demos identically every time
- No vendor account, no API key to leak, no network dependency, works offline
- Latency is sub-millisecond rather than 1–2 seconds

**Lost**
- Messier phrasing an LLM would handle (*"grabbed lunch with the team, my share
  was about 400"*) is not understood. The parser fails **visibly** — it returns a
  low confidence, and the UI opens the plain form instead of pretending.
- The word "AI" is no longer defensible, which forced the rename (ADR-002).

**Unchanged — and this is the important part.** Every Chapter 9 guardrail still
applies, because none of them were really about the model:

| Guardrail | Still true |
|---|---|
| Propose, never persist | Parse returns a draft; saving is a separate confirmed call |
| Re-authorize every id | Ids re-checked against the user's own rows before leaving the service |
| Bound the input | Over-long input rejected, not truncated |
| Rate limit | In place on `/capture/*` |
| Log every attempt | `capture_logs` records input, output, confidence, and acceptance |

The re-authorization check is now *technically redundant* — the parser can only
return ids we handed it — and was kept deliberately. It is the check that would
stop a hallucinated id the day a model sits behind that seam.

### The honest framing for a reader

This is a rules-based parser. It is not machine learning, and the README says so
plainly. What the feature demonstrates is not "we used AI" but something more
durable: **recognising that a problem was bounded, and solving it with the
simplest thing that works.**

---

## ADR-002 · Renamed from "AI Wealth OS" to "Wealth OS"

**Status:** Accepted · Follows from ADR-001

### Context

The product name and Chapter 1's positioning ("AI-first") both claimed something
ADR-001 removed from the code.

### Decision

Rename to **Wealth OS**. Sweep display text, all 16 chapters, the npm scope
(`@wealth-os/*`), and the `ai_parse_logs` table (→ `capture_logs`).

### Consequences

- The name is now defensible in an interview. An unearned "AI" prefix invites
  exactly the question you cannot answer.
- The Render and Vercel **service names were deliberately not renamed**: renaming
  a blueprint-managed service orphans the old one and breaks the live URL. Real
  cost, cosmetic gain. The deployed URLs still read `ai-wealth-os-*`.
- The table rename needed a **hand-written migration** — Prisma generates
  `DROP` + `CREATE` for a rename, which would have destroyed every row.

---

## ADR-003 · No charting library

**Status:** Accepted · Amends Chapter 8 (which specified Recharts)

### Context

Chapter 8 chose Recharts. Sprint 2 needed three visualisations: a six-month
grouped bar chart, horizontal category bars, and progress meters.

### Decision

Build them with plain CSS/SVG.

### Consequences

- None of the three needed scales, axis computation, or interaction beyond hover,
  which is what a charting library actually buys you.
- Exact control over the mark specifications (2px surface gaps, 4px rounded data
  ends) that the data-viz method requires.
- ~100KB and one dependency avoided, consistent with Ch 12's "keep the dependency
  surface small."
- **Revisit if** Phase-3 forecasting needs real time-series axes — that is when a
  library earns its place.

---

## ADR-004 · Chart colours were validated, and the obvious choice failed

**Status:** Accepted · Implements Chapter 11 §11.2's deferred decision

### Context

Chapter 11 deferred the categorical chart palette to build time, specifically so
it could be validated rather than eyeballed.

### Decision

Run the palette through a colour-blindness validator before shipping it.

### Consequences

The intuitive choice — our semantic **green for income, red for expense** —
**failed**: deuteranopia ΔE **4.4** against a target of 8. To a red-green
colourblind reader those two bars are nearly the same colour. Blue/orange scored
**24.7** and shipped instead.

Three light-mode categorical slots fall below 3:1 contrast, which triggered the
relief rule: every category bar carries a visible name and amount, so the chart
is fully readable without relying on fill colour at all.

`MoneyText` keeps green/red, because it always renders an explicit `+`/`−` — a
second, non-colour signal. Colour is never the only carrier of meaning anywhere.

**The transferable lesson:** this is not something taste would have caught. The
palette *looked* fine. It was wrong, and only measurement showed it.
