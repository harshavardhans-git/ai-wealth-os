# Chapter 13 — Testing Strategy

> Status: **Draft for review** · Protects invariants from: Ch 5 (money, transfers), Ch 7 (layers), Ch 9 (AI fallback), Ch 10/12 (auth, cross-user)

Tests are not about hitting a coverage number — they're about **protecting the
invariants we've spent twelve chapters locking**, so a future change (yours, months
later) can't silently break them. For a solo portfolio project, the goal is
**maximum confidence per test written**, not exhaustiveness.

> **Mentor lens — what to test, from a senior's ROI view:** test the things that are
> (a) *easy to get wrong*, (b) *expensive if wrong*, and (c) *unlikely to be caught by
> eye*. Money math, cross-user isolation, and the AI fallback score high on all three.
> A getter that returns `this.name` scores zero — testing it is busywork that inflates
> coverage and slows you down. **Coverage is a vanity metric; protected invariants are
> the real one.**

---

## 13.1 The test pyramid for this stack

```
        ▲  E2E (Playwright) — few, golden paths only
       ▲▲▲  Integration (Supertest + test DB) — the API contract
      ▲▲▲▲▲  Unit (Vitest) — services, money, mappers, guards
     ▲▲▲▲▲▲▲  Types (TS + zod + shared types) — the free base layer
```

| Layer | Tool | Tests what | How many |
|-------|------|------------|----------|
| **Types** | TypeScript + zod + `packages/types` | shape/contract errors — *at compile time* | free, always on |
| **Unit** | Vitest | pure logic: `money`, service rules, ID re-auth, mappers | most |
| **Integration** | Vitest + Supertest + test DB | endpoint behavior end-to-end through the layers | the contract-critical ones |
| **E2E** | Playwright | real browser on 2–3 golden paths | a handful |

> **Mentor lens — pyramid economics:** unit tests are fast, precise, and cheap →
> write many. E2E tests are slow, flaky, and broad → write few, only for flows too
> important to leave unverified. Inverting the pyramid (lots of E2E) is the classic
> junior mistake — a slow, brittle suite everyone learns to ignore. Note the **types
> layer is the widest and costs nothing**: our shared `packages/types` + zod turn a
> whole class of "wrong shape" bugs into compile errors (Ch 7/8).

---

## 13.2 The must-have tests (the invariants, made executable)

These are non-negotiable — each guards a rule locked earlier. If nothing else gets
tested, these do.

| # | Invariant | Test | Guards (chapter) |
|---|-----------|------|------------------|
| 1 | **Money is exact** | `toMinor("0.1")+toMinor("0.2") === toMinor("0.3")`; format round-trips; no float | Ch 5 D1 |
| 2 | **Transfers aren't spend** | dashboard aggregates exclude `type='transfer'`; a transfer moves balance, adds 0 to expense | Ch 5, Ch 7 |
| 3 | **Cross-user isolation** | user B requesting user A's transaction id → **404**; list never returns A's rows | Ch 5 D3, Ch 12 |
| 4 | **AI can't hard-fail** | adapter throws → service returns fallback signal (not a 500); low `confidence` → manual-form path | Ch 9 |
| 5 | **AI never writes bad refs** | a returned `categoryId` not owned by the user → coerced to `null`, never persisted | Ch 9 |
| 6 | **Demo mode = $0** | demo/cache hit returns a draft **without** calling the adapter (assert adapter not invoked) | Ch 9 |
| 7 | **Auth lifecycle** | hash≠plaintext & verifies; access token issue/verify; **refresh rotation** invalidates the old; `token_version` bump kills refresh | Ch 10 |
| 8 | **Soft delete hides rows** | deleted transaction absent from lists/aggregates but recoverable | Ch 5 D4 |
| 9 | **Budget progress** | progress = sum of matching expense txns in period; excludes transfers/other categories | Ch 5 |

> **Debugger lens — #1 and #3 are the crown jewels.** #1 (money) because a float bug is
> silent and corrupts trust; #3 (cross-user 404) because it's the highest-severity
> security bug (IDOR, Ch 12). Writing these **first** — before the features — is
> test-driven protection of the two things a finance app cannot get wrong.

---

## 13.3 Testing the AI feature (special case)

- **Never call the real Claude API in tests** — it costs money and is non-deterministic
  (a test that sometimes passes is worse than no test). **Mock the `ClaudeAdapter`** and
  test the *service logic around it*: context assembly, ID re-authorization, confidence
  routing, fallback on error, demo-cache short-circuit.
- **Prompt quality is evaluated separately, offline.** A tiny **eval set** (`~15
  sentences → expected fields`) run manually against the live model measures parse
  accuracy when tuning the prompt. This is *not* in CI (cost/nondeterminism) — it's a
  dev tool, and its existence is itself a senior signal.

> **Mentor lens:** the boundary between "test the deterministic code I wrote" (CI,
> mocked model) and "evaluate the probabilistic model behavior" (offline eval set) is a
> distinction most people miss. Mixing them gives you a flaky, expensive CI. Separating
> them gives you fast tests *and* a real quality signal.

---

## 13.4 What we deliberately DON'T test (ROI discipline)

| Skipped | Why |
|---------|-----|
| UI snapshot tests | High churn, low signal; they break on every design tweak and get rubber-stamped |
| Third-party libs (Prisma, zod, Radix) | Not our code; already tested upstream |
| Trivial getters/pass-throughs | Nothing to break; testing them inflates coverage, not confidence |
| Exhaustive edge cases on non-critical paths | Diminishing returns for a portfolio; focus on the invariants |
| 100% coverage as a target | A number, not a goal — chasing it produces low-value tests |

> **CTO note:** "we test the invariants and golden paths, and here's what we skip and
> why" is a *more* senior answer than "we have 95% coverage." Judgment about what *not*
> to test is the skill.

---

## 13.5 Tooling, data & CI

- **Runner:** Vitest (fast, TS-native) for unit + integration; **Supertest** to drive
  the Express app in-process; **Playwright** for E2E.
- **Test data:** a separate test database (a **Neon branch** or local Postgres in
  Docker); **factory functions** build fixtures; each test runs in a transaction rolled
  back after — isolated, repeatable, no cross-test bleed.
- **CI (GitHub Actions on every PR):** `lint → typecheck → unit+integration → npm audit`.
  E2E runs on the golden paths (can be a separate/nightly job to keep PRs fast). A red
  check blocks merge.
- **`/verify`** (this environment's skill) and **`/security-review`** on nontrivial
  diffs before shipping — drive the real flow, don't just trust green unit tests.

> **Mentor lens — test *behavior*, not *implementation*.** Assert *what* a service
> returns for given inputs, not *how* it computes it. Implementation-coupled tests
> ("was this private method called?") break on every refactor and punish improvement.
> Behavior tests survive refactors and are the ones that actually catch regressions.

---

## 13.6 The reviewer/debugger connection (your mentorship goal)

The must-have tests double as your **PR-review checklist** (Ch 7/8) made executable:
when you review a change to transactions, budgets, or auth, you ask "does an invariant
test cover this?" A change that breaks #3 (cross-user) or #1 (money) should turn a check
red *before* a human reads it. This is how tests turn "would I approve this PR?" from a
judgment call into an automated gate.

---

## 13.7 End-of-chapter checkpoint

### ✅ Decisions locked
- **Invariant-driven testing**, not coverage-driven; maximum confidence per test.
- **Pyramid:** free types layer → many units → contract integration → few E2E golden paths.
- **9 must-have invariant tests**, each traced to the chapter it protects; **money (#1)** and **cross-user 404 (#3)** written first.
- **AI tested with a mocked adapter**; prompt quality via a **separate offline eval set** (not CI).
- Explicit **skip list** (snapshots, third-party, trivial, 100%-coverage).
- **Vitest + Supertest + Playwright**, isolated test DB via factories + rollback, **GitHub Actions** gate + `/verify` + `/security-review`.
- **Test behavior, not implementation.**

### ❓ Open questions (for you)
1. **E2E scope for v1** — 2 flows (signup→dashboard, quick-capture→saved) or 4 (add those two + CSV import + set budget)? *(Recommend: 2 golden paths for v1; add more as time allows.)*
2. **Test DB** — Neon branch (mirrors prod, needs network) vs. local Postgres in Docker (fast, offline)? *(Recommend: local Docker Postgres for speed; Neon branch optional for a prod-like run.)*
3. **TDD depth** — write the 9 invariant tests *first* (true TDD, more discipline) or test-alongside as each feature lands? *(Recommend: TDD for the crown jewels #1 and #3; test-alongside for the rest — pragmatic, not dogmatic.)*

### ⚠️ Risks
- **R1 — Skipping tests under deadline pressure:** the invariants get dropped first, exactly when they matter. Mitigation: the 9 must-haves are the *floor*, part of "done" (Ch 3 DoD).
- **R2 — Flaky E2E eroding trust:** a suite that cries wolf gets ignored. Mitigation: keep E2E tiny and stable; put the load on units.
- **R3 — Real AI calls sneaking into CI:** cost + nondeterminism. Mitigation: the adapter is mocked in the test setup; a lint/guard against importing the real SDK in tests.

### 💡 CTO recommendations
- Write **money (#1)** and **cross-user 404 (#3)** as the *very first* tests in the repo — they protect the two unforgivable bug classes and set the testing tone.
- Keep the **CI gate green and fast** (< a couple minutes) — a slow gate gets bypassed; speed is what keeps the discipline alive.
- Treat the **offline AI eval set as a living artifact** — grow it whenever a real parse fails; it's how the wedge's quality improves methodically (Ch 9).

---

**Next chapter on your approval → Chapter 14: Deployment & Scaling Strategy** — the
free-tier deployment topology (Vercel + Render/Railway + Neon), environment/secrets
setup, the manual warm-up for cold starts (Ch 6), CI/CD from GitHub, and an honest
scaling story: what breaks first at 10× and 100×, and the cheap next step for each —
"designed so it *could* scale," articulated.
