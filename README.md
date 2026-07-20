# Wealth OS

> A **personal financial operating system** — type one sentence, get a categorized
> transaction. Understand your money without spreadsheets or bank lock-in.

### ▶ [Live demo](https://ai-wealth-os-web.vercel.app) · [API health](https://ai-wealth-os-api.onrender.com/health)

> The API runs on a free tier that sleeps when idle — **the first request may take
> ~30 seconds** to wake it. Hit the health link first if the app looks stuck.

**Status:** deployed and working. Tracking, dashboard, budgets, CSV import and
natural-language capture are all live. Full architecture in [`/docs`](./docs/README.md).

---

## The one-liner

Most finance tools *record* your money and leave the thinking to you. **Wealth OS
interprets it.** You bring your data — by sentence, or by CSV — and it does the thinking.

**The wedge:** type `"coffee 250 yesterday with card"` → a categorized, budget-aware
transaction, confirmed in one tap.

```
"coffee 250 yesterday"     → ₹250.00 · Food & Dining · 18 Jul
"uber to office 180"       → ₹180.00 · Transport
"dinner 900 with card"     → ₹900.00 · HDFC Credit Card
"salary 85000 credited"    → +₹85,000 · income · Salary
"rent 22k"                 → ₹22,000.00 · Rent & Housing
```

**How that parsing works — stated plainly:** it is a deterministic parser, not a
language model. `"coffee 250 yesterday"` is a *bounded* extraction problem — an
amount, a date, a category, an account — so rules solve it exactly, for free,
offline, with no third-party dependency. It is a pure function, which is why all
22 of its cases are directly unit-tested. An LLM would handle messier phrasing;
the seam for one exists, but has deliberately not been taken.

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 · React 19 · TypeScript · TanStack Query · Tailwind v4 |
| Backend | Node + Express (TypeScript), layered: route → service → repository |
| Database | PostgreSQL (Neon) via Prisma |
| Auth | Self-rolled JWT (in-memory access + httpOnly rotating refresh) · argon2id |
| Charts | Hand-built CSS/SVG — no charting library |
| Deploy | Vercel + Render + Neon — **~$0/month** |

## Architecture highlights

- **Money as integer minor units** — exact arithmetic, no float drift. The first
  test in the repo proves `0.1 + 0.2` breaks in floats but not here.
- **Authorization is one rule:** every query is scoped by `user_id` in the
  repository layer. Cross-user access returns **404, never 403** — we don't even
  confirm another user's row exists.
- **Capture proposes, never persists.** A parse returns an editable draft; every id
  it returns is re-authorized against your own rows before it can be saved.
- **Balances and budget progress are derived, never stored** — a stored balance
  drifts out of sync with the transactions that define it.
- **Transfers are two linked legs** written in one database transaction, and are
  excluded from every spend aggregate — moving your own money isn't spending.
- **Chart colours were validated, not eyeballed.** The obvious green/red for
  income vs expense *failed* colour-blind separation (deutan ΔE 4.4 against a
  target of 8), so the charts use blue/orange instead.
- **Designed so it *could* scale** without being over-built — see the
  bottleneck-ordered table in [Chapter 14](./docs/14-deployment-scaling.md).
- **Security model with explicit, reasoned non-goals** —
  [Chapter 12](./docs/12-security-model.md).

## Documentation

A 16-chapter architecture blueprint written *before* the code, in
**[`/docs`](./docs/README.md)** — product vision through deployment, the way an
engineering team would spec a product before building it.

## Local development

```bash
npm install                       # installs all workspaces
cp .env.example api/.env          # then fill in DATABASE_URL + JWT secrets
npm run db:migrate                # apply the schema
npm run db:seed                   # 18 system categories

npm run dev:api                   # terminal 1 → :4000
npm run dev:web                   # terminal 2 → :3000
```

```bash
npm test                          # 44 tests across both workspaces
npm run typecheck                 # both workspaces
```

Deployment runbook: [`DEPLOY.md`](./DEPLOY.md).

---

*A portfolio project demonstrating product thinking, full-stack architecture, and
disciplined engineering. No real financial data — simulated and user-entered by design.*
