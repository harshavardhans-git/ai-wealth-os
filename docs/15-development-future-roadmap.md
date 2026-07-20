# Chapter 15 — Development Roadmap & Future Roadmap

> Status: **Draft for review** · Depends on: everything · Closes the loop from Ch 0.

The final chapter turns the blueprint into an **executable build order** — the sequence
a developer could start Monday morning — and then sketches the Phase 2–4 future the
architecture already accommodates.

> **Mentor lens — how a senior sequences a build:** not by feature excitement, but by
> **dependency + risk + a walking skeleton**. You de-risk the scary integration parts
> first, prove the whole stack end-to-end with the thinnest possible slice, then widen.
> Core-first, AI-last (the charter rule) is exactly this: build the stable data
> foundation the AI writes into *before* the AI.

---

## 15.1 The guiding sequencing principles

1. **Walking skeleton first** — deploy an empty-but-wired app (all 3 services, CI green,
   public URL) before building features (Ch 14). Proves the hard integration parts early.
2. **Vertical slice over horizontal layers** — build *one feature end-to-end*
   (DB → repo → service → API → hook → UI) before starting the next, rather than "all
   models, then all APIs, then all UI." *Why:* a vertical slice proves every layer talks
   to the next and gives you a working thing to test; horizontal layering leaves you with
   nothing runnable until the very end. **Transactions** is the natural first slice — the
   core object everything else hangs off.
3. **Core-first, AI-last** — the flagship (A1) is built on top of finished `C1–C9`, so it
   writes into a stable, tested data model (Ch 3, Ch 9).
4. **Crown-jewel tests first** — money exactness and cross-user 404 (Ch 13) are written
   before the features they guard.

---

## 15.2 Phase 1 build order (sprint-sized chunks)

Office-time pace, so "sprint" = a coherent chunk, not a fixed calendar. Each maps to
feature IDs (Ch 3) and ends at a runnable state.

| Sprint | Goal | Delivers | Exit state |
|--------|------|----------|-----------|
| **0 · Skeleton** | wire everything | monorepo, CI, deploy to 3 hosts, design tokens + `MoneyText`, Prisma schema + first migration, **auth module (C1)** + crown-jewel tests (money, cross-user) | empty app live on a public URL, CI green, you can sign up |
| **1 · Core slice** | transactions end-to-end | accounts (C2), categories + seed (C4), **transactions CRUD (C3)** through the repo→service→API→hook→UI stack | you can add/list/edit a real transaction in the browser |
| **2 · The interpreted view** | dashboard + budgets | dashboard summary (C6), budgets + progress (C5), multi-currency plumbing (C9), the pattern/feature components (Ch 11) | dashboard answers "how am I doing?"; budgets show live progress |
| **3 · Friction-killers** | real data in | CSV import (C7), **engineered seed/demo dataset (C8)** + pre-seeded `ai_parse_logs` | app looks *full* on first load; you can import your own CSV |
| **4 · The flagship** | the wedge | `ClaudeAdapter`, demo-mode cache, **NL capture (A1)** + Quick-Capture overlay, confidence→fallback routing | type "coffee 250 yesterday" → a saved, categorized transaction |
| **5 · Ship** | polish + prove | DoD verification, dark-mode pass, a11y check, README (scaling table, security non-goals, warm-up), Sentry, `/verify` + `/security-review` | **DoD met (Ch 3 §3.4); portfolio-ready** |

> **Mentor lens — notice Sprint 0 deploys *nothing useful* on purpose.** A "walking
> skeleton" (empty app, fully wired, live) feels like slow progress but is the highest-
> leverage move: it surfaces every integration problem (CORS, env vars, monorepo build,
> migrations, cold starts) while the app is trivial to debug — not at the end when it's
> tangled with features. Deferring deployment to "when it's ready" is the mistake that
> turns launch week into launch month.

---

## 15.3 The gate: Definition of Done (from Ch 3)

Phase 1 is *done* — and portfolio-shippable — only when all 8 DoD conditions hold
(Ch 3 §3.4): user isolation, instant populated demo, the working NL wedge end-to-end,
form + CSV entry, the interpreted dashboard, live budgets, a public $0 deployment, and
$0 demo mode. **The DoD is the anti-scope-creep gate** — anything not on it is backlog.

> **CTO note:** every deferred feature (Ch 3's OUT-list) will feel cheap to pull forward
> mid-build. The DoD is your defense: *"is it on the list? no → backlog."* Shipping a
> tight v1 beats a sprawling 70%-done one, every time — especially for a portfolio, where
> "deployed and complete" outweighs "ambitious and broken."

---

## 15.4 Future roadmap (the architecture already fits it)

The phases from Ch 3, with the *enabling architecture already decided* called out —
this is the payoff of designing for extensibility without building it early.

| Phase | Theme | Features | Already-in-place enabler |
|-------|-------|----------|--------------------------|
| **2 · Understanding** | it talks back | AI CFO chat (A3), NL queries (A2), Health Score (A5), monthly report (A8), recurring txns (C10) | the **AI adapter pattern** (Ch 9) + **async seam** for reports (Ch 6.7) |
| **3 · Planning** | it looks forward | goals (A11), cash-flow forecast (A9), expense prediction (A10), budget planner (A6), recs (A7), notifications (A12), automation rules (A13) | forecasting reads the **stable transaction history**; jobs run on the **queue/worker seam** |
| **4 · Documents & reach** | it reads & listens | receipt OCR (A14), statement parser (A15), doc understanding (A16), investments (A17), voice (A18) | same **`ClaudeAdapter` seam** (swap in a vision model); a new domain module (Ch 7) |

> **Mentor lens — this table is the whole thesis in one view.** Every future feature
> plugs into a seam we *already built for one reason* (the AI adapter for A1, the async
> seam for nothing yet, the `user_id` scope, the module structure). That's what
> "extensible without over-building" means: the hooks exist, the machinery doesn't, and
> adding Phase 2 is *feature work*, not *re-architecture*. Ch 0 promised "no major
> restructuring later" — this table is the proof.

---

## 15.5 What "success" looks like (closing the loop to Ch 1)

Success for this portfolio project (Ch 1 §1.7), restated as a finish line:

1. A recruiter opens the live URL → a **full, believable** financial app in < 5 s.
2. They try Quick Capture → it **works** (the wow), at $0 (demo mode).
3. The `/docs` reads like a real eng org wrote it (**these 16 chapters**).
4. Nothing about the architecture looks like a tutorial clone.

> **CTO note:** you now have all four. Chapters 1–14 are #3 and #4 already; Sprints 0–5
> deliver #1 and #2. The documentation *is* half the deliverable.

---

## 15.6 End-of-chapter checkpoint

### ✅ Decisions locked
- **Sequencing principles:** walking skeleton → vertical slice → core-first, AI-last → crown-jewel tests first.
- **6-sprint Phase-1 build order**, each mapped to feature IDs and a runnable exit state.
- **Transactions** is the first vertical slice; **A1 is built last**, on a stable data model.
- **DoD (Ch 3 §3.4) is the release gate** and the anti-scope-creep defense.
- **Phase 2–4 future roadmap** with each feature's enabling architecture already decided.
- Success criteria closed back to Ch 1.

### ❓ Open questions (for you)
1. **First build step after approval** — should I (when we move to the build phase) start with **Sprint 0 (walking skeleton)**, or would you rather I first generate a top-level **`README.md` + `/docs` index** that ties all 16 chapters together as the portfolio front page? *(Recommend: the README/index next — it makes the docs presentable immediately and costs little; then Sprint 0.)*
2. **Repo initialization** — want me to `git init` the `~/ai-wealth-os` folder and set up the monorepo skeleton (workspaces, folders) as the concrete first move, or keep it docs-only for now? *(Recommend: git init + skeleton when you're ready to start building.)*
3. **Pace** — office-time, so do you want the build broken into these 6 sprints as-is, or re-chunked into smaller/bigger pieces to fit your available time blocks? *(Recommend: keep the 6, but we can split Sprint 2 or 4 if a block is short.)*

### ⚠️ Risks
- **R1 — Scope creep mid-build:** the perennial threat. Mitigation: the DoD gate; the OUT-list is the backlog.
- **R2 — Skipping the walking skeleton:** "I'll deploy later" → integration pain at the end. Mitigation: Sprint 0 deploys first, on purpose.
- **R3 — Over-polishing one screen** while others lag. Mitigation: reach DoD across *all* v1 screens before deep polish; polish the dashboard + Quick Capture last and most.

### 💡 CTO recommendations
- Start with the **walking skeleton (Sprint 0)** — nothing de-risks a project faster than a live, wired, empty app with green CI.
- Keep the **DoD checklist visible** (pin it in the repo) and check items off as you go — it's your definition of "shippable."
- When you build, **apply the mentorship loop** (explain-before-coding → blocks → reviewer/debugger lens → consistency) per change — the docs give every decision its "why," so the code reviews itself against them.

---

## 🏁 Blueprint complete

That's all 16 chapters. From the Chapter 0 charter to this build order, **Wealth OS is
now a complete, internally-consistent architecture** a developer could execute without
major restructuring — the goal set in Chapter 0.

**The through-lines that make it hang together:**
- One data rule (`user_id` scoping) became the **authorization model** (Ch 10) *and* the
  top **security control** (Ch 12) *and* a **must-have test** (Ch 13).
- One money rule (integer minor units) runs from the **schema** (Ch 5) to **`MoneyText`**
  (Ch 11) to the **first test** (Ch 13).
- One AI discipline (adapter + confirm + re-auth + demo cache) became the **flagship**
  (Ch 9), the **security posture** (Ch 12), and the **template for every future AI
  feature** (Ch 15).
- Two Ch 6 decisions (stateless API, async seam) pre-paid the **scaling story** (Ch 14).

That consistency — where a decision made once shows up correctly everywhere — is the
real signal that this was architected, not assembled.
