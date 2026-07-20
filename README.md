# AI Wealth OS

> An AI-first **personal financial operating system** — type one sentence, get a
> categorized transaction. Understand your money without spreadsheets or bank lock-in.

### ▶ [Live demo](https://ai-wealth-os-web.vercel.app) · [API health](https://ai-wealth-os-api.onrender.com/health)

> The API runs on a free tier that sleeps when idle — **the first request may take
> ~30 seconds** to wake it. Hit the health link first if the app looks stuck.

**Status:** deployed and working. Core money tracking is complete; the AI capture
feature is next. Full architecture in [`/docs`](./docs/README.md).

---

## The one-liner

Most finance tools *record* your money and leave the thinking to you. **AI Wealth OS
interprets it.** You bring your data — by sentence, or by CSV — and it does the thinking.

**The wedge:** type `"coffee 250 yesterday with card"` → a categorized, budget-aware
transaction, confirmed in one tap.

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (React, TypeScript) · TanStack Query · shadcn/ui · Recharts |
| Backend | Node + Express (TypeScript), layered: route → service → repository |
| Database | PostgreSQL (Neon) via Prisma |
| Auth | Self-rolled JWT (in-memory access + httpOnly rotating refresh) · argon2id |
| AI | Claude (Haiku 4.5) — structured outputs, confirm-before-save, demo-mode cache |
| Deploy | Vercel + Render + Neon — **~$0/month** |

## Architecture highlights (the senior signals)

- **Money as integer minor units** — exact arithmetic, no float drift.
- **Authorization = one rule:** every query scoped by `user_id` in the repository layer.
- **AI blast radius designed to zero:** the model only proposes a draft; every ID it
  returns is re-authorized against the user's own data before anything is saved.
- **Designed so it *could* scale** (stateless API + async seam) without being
  over-built — see the bottleneck-ordered scaling table in
  [Chapter 14](./docs/14-deployment-scaling.md).
- **Security model with explicit, reasoned non-goals** —
  [Chapter 12](./docs/12-security-model.md).

## Documentation

The full architecture blueprint lives in **[`/docs`](./docs/README.md)** — 16 chapters
from product vision to deployment, written the way an engineering team would spec a
product before building it.

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
npm test                          # invariant tests (money exactness, …)
npm run typecheck                 # both workspaces
```

Deployment runbook: [`DEPLOY.md`](./DEPLOY.md).

---

*A portfolio project demonstrating product thinking, full-stack architecture, and
AI-first engineering. No real financial data — simulated + user-entered by design.*
