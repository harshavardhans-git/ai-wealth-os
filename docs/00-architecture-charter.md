# Chapter 0 — Architecture Charter

> Status: **Locked** · Owner: CTO + Dheeraj · This charter governs all later chapters.

## Context

**Wealth OS** is a flagship **portfolio / skills-showcase** project. The goal is
to demonstrate senior-level *product + full-stack + AI-first* engineering at
**near-zero running cost** — not to operate a real fintech handling real money
(which would add compliance and cost we explicitly avoid).

We are in an **architecture-only phase**. The deliverable is professional
documentation, produced **chapter by chapter**, each finalized before the next.

## Locked decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Scope** | MVP wedge + phased roadmap | Architect the whole system as extensible; build v1 around core tracking + ONE flagship AI feature. |
| **Market** | Region-agnostic, multi-currency (INR default) | No live bank integrations (cost + business approval + compliance). Data enters via manual + CSV/statement import. |
| **Data reality** | Simulated + user-entered | Seeded demo data + real manual entry + CSV import. No real bank links, no real PII, no compliance. |
| **Stack** | React/Next.js + Node/Express + PostgreSQL (Neon), TypeScript | Clean service separation; all free-tier deployable. |
| **Cost** | ~$0 / month at showcase scale | Free tiers + "demo mode" for AI. |

## MVP wedge (v1)

- **Core (non-AI):** auth, accounts, transactions, categories, budgets, dashboard, CSV import, seeded demo data.
- **Flagship AI:** **Natural-language transaction capture** — `"coffee 250 yesterday"` → a categorized, dated transaction with a confirm step. Highest wow-per-token, proves the AI-first thesis, cheapest to run.

## Phase roadmap

- **Phase 1 (MVP):** the wedge above.
- **Phase 2:** AI CFO chat over your data, Financial Health Score, monthly AI insight/report.
- **Phase 3:** Goals & planning, cash-flow forecast, expense prediction, automation rules, smart notifications.
- **Phase 4:** Receipt OCR, bank-statement parser, document understanding, investments, voice commands.

## Free / cheap infrastructure

- **Next.js** → Vercel free tier · **Express API** → Render/Railway/Fly free tier · **Postgres** → Neon free tier.
- **Auth** → Auth.js or self-hosted JWT (both free).
- **AI** → cheap model + strict token budget + **demo mode** (cached responses → $0 for recruiters clicking around).

## Documentation roadmap

0. Architecture Charter *(this file)*
1. Product Vision, Mission, Problem, Target Users
2. Competitor Analysis & Positioning
3. Feature Inventory, MVP Wedge & Phase Roadmap
4. Information Architecture & Navigation Map
5. Domain Models & Database Design
6. System Architecture
7. Backend Architecture
8. Frontend Architecture
9. AI Architecture
10. Authentication Flow & Authorization Model
11. Design System, UI Components & Wireframes
12. Security Model
13. Testing Strategy
14. Deployment & Scaling Strategy
15. Development Roadmap & Future Roadmap

## Working process

Chapter by chapter. No auto-advance — each chapter is approved before the next.
Every chapter ends with **Decisions · Open questions · Risks · CTO recommendations.**
