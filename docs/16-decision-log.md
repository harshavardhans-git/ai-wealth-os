# Chapter 16 — Decision Log

Architecture decisions that **changed after the blueprint was written**. Each entry
records what we originally decided, what we learned, what we changed, and what it
cost — because a design that never changed during implementation is usually a
design nobody actually built.

The earlier chapters are left as originally written, with a pointer to the
relevant entry here. Erasing the original reasoning would hide the most useful
part: the *revision*.

| # | Decision | Triggered by |
|---|----------|--------------|
| [001](#adr-001--natural-language-capture-uses-a-deterministic-parser-not-an-llm) | Capture is a deterministic parser, not an LLM | Sprint 4 |
| [002](#adr-002--renamed-from-ai-wealth-os-to-wealth-os) | Renamed "AI Wealth OS" → "Wealth OS" | ADR-001 |
| [003](#adr-003--no-charting-library) | No charting library | Sprint 5 |
| [004](#adr-004--chart-colours-were-validated-and-the-obvious-choice-failed) | Chart palette validated; the obvious choice failed | Sprint 5 |
| [005](#adr-005--refresh-tokens-get-their-own-table) | Refresh tokens get their own table | Post-build audit |
| [006](#adr-006--constraints-belong-in-the-database) | Constraints belong in the database | Post-build audit |
| [007](#adr-007--lint-the-layering-rules) | Lint the layering rules | Post-build audit |

The last three came out of a **doc-vs-code audit run after Phase 1 was
"finished"** — reading every chapter against what shipped. That audit is the most
useful thing in this log: each of those three is a case where the documentation
described a property the code did not have, and CI stayed green throughout
because it tested what was built rather than what was promised.

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

---

## ADR-005 · Refresh tokens get their own table

**Status:** Accepted · Sprint 6 (post-audit)

### Context

Chapter 10 §10.2 promised rotation: *"each refresh issues a new refresh token and
invalidates the old one"*, so a stolen token becomes *"a short race"*.

The code did not do this. Revocation rested entirely on `tokenVersion`, an integer
on the user row — a lever that can only revoke **everything at once**. Refresh
issued a new token carrying the *unchanged* version, so the old token stayed valid
for its full 7 days beside its replacement. Rotation was a rename, not a
behaviour, and the chapter's entire theft-mitigation argument was false.

The audit caught this by reading the claim against the code. No test failed,
because no test asserted the claim.

### Options considered

1. **Bump `tokenVersion` on every refresh.** One line, no schema change. But it
   invalidates *every* session, so signing in on a laptop silently signs you out
   on your phone. It would have made the doc true by making the product worse.
2. **A row per issued token.** A small table, and rotation becomes exact.

### Decision

Option 2. `refresh_tokens(id, user_id, expires_at, revoked_at, replaced_by)`.
The refresh JWT carries its row id as `jti`.

**The token string is never stored — only its id.** A leaked database row is not
a credential, which is the same reasoning as storing a password hash rather than
a password.

### Consequences

Rotation retires exactly one token, so other devices stay signed in.

More usefully, the table makes **reuse detectable**. A token presented after it
was already rotated can only be a copy. We cannot tell whether that is the real
user replaying a stale cookie or an attacker with a stolen one — so we assume the
worst and revoke the whole family. The legitimate user signs in again; a thief
gets nothing and cannot keep the session alive at the real user's expense.

`tokenVersion` stays, as the blunt lever for logout and password change. Two
levers with different blast radii is the right shape, and was the right shape
before — there was just only one of them.

**The transferable lesson:** a security property that no test asserts is a
comment. This one read as implemented for six sprints because the word "rotation"
appeared in the code.

---

## ADR-006 · Constraints belong in the database

**Status:** Accepted · Sprint 6 (post-audit)

### Context

Chapter 5 §5.4 specified eight CHECK constraints. `schema.prisma` carried a note
to add them "via a raw-SQL migration after `migrate dev`". That never happened,
so for six sprints the allowed values of every enum-ish column — transaction
type, category kind, capture source, batch status, positive amounts — lived only
in zod.

Zod protects *requests*. It does not protect the seeder, `createMany`, a psql
session, or any future job. The database, which is the actual source of truth,
would accept anything.

### Decision

Write all eight by hand, plus a ninth Ch 5 never specified: a transfer leg must
carry a direction and nothing else may, because the balance SQL keys on it.

Also convert every timestamp to `timestamptz`. A naive timestamp means whatever
zone the reading server assumes — a deploy region change would silently shift
every transaction's date, and with it the month boundaries the whole dashboard is
computed from. `budgets.starts_on` stays a `DATE`: a budget period starts on a
calendar day, not an instant.

### Consequences

Writing the tests **found a bug in the constraint itself**. A CHECK is satisfied
when its expression evaluates to `NULL`, not only when `TRUE`. So

```sql
CHECK (type = 'transfer' AND transfer_direction IN ('in','out') OR ...)
```

let a transfer with a `NULL` direction straight through: `NULL IN (...)` is
`NULL`, and `NULL OR FALSE` is `NULL`, which passes. The constraint was inert for
precisely the case it existed to catch. It now tests `IS NOT NULL` first.

The four tests that guard these deliberately write **raw SQL**, bypassing zod and
the service layer — because that is the whole point. A rule that only holds when
you go through the API is not a rule the database holds.

**The transferable lesson:** two, both about the same thing. A TODO in a schema
file is not a plan, it is a hope. And SQL's three-valued logic means a constraint
can look correct, pass review, and enforce nothing — the only way to know is to
write the row it should reject.

---

## ADR-007 · Lint the layering rules

**Status:** Accepted · Sprint 6 (post-audit)

### Context

Chapters 7 and 8 both name rules whose violation should "block the PR": routes
must not import Prisma (§7.9), components must not call `fetch` directly (§8.8).

There was no ESLint config in the repository at all, so CI had no lint step and
both rules were enforced by review attention alone. Both had already been broken —
`health.routes.ts` imported Prisma, and the landing page called `fetch` — and
neither had been noticed.

### Decision

Add ESLint to both workspaces, encode the two architectural rules as
`no-restricted-imports` / `no-restricted-globals` with the chapter reference in
the error message, and run lint as the first CI step.

### Consequences

The rule found the existing Prisma violation on its first run. Fixed properly
with a `health.service`, not a suppression comment — and that rewrite improved
the endpoint on its own terms: it now reports a dead database as `degraded` with
a 200 rather than throwing a 500, because a health check exists to describe state,
not to fail.

Two further real defects surfaced from `react-hooks`: setState called
synchronously inside an effect, in the theme provider and the app shell. The
provider now reads `localStorage` through `useSyncExternalStore`, which is what
that API is for — the effect version rendered the wrong theme once and then
re-rendered to correct itself.

**The transferable lesson:** architectural rules decay silently, because nothing
fails when they are broken. Writing a rule in a document asks every future
reader to remember it; writing it as a lint rule asks no one to remember
anything. Four real bugs came out of a config file that took ten minutes.
