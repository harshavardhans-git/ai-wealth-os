# Wealth OS — Architecture Blueprint

The complete pre-build architecture for Wealth OS, written chapter by chapter. Each
chapter ends with locked decisions, open questions, risks, and CTO recommendations.

> **How to read this:** Chapters build on each other. Ch 0 sets the constraints; Ch 1–3
> define *what* and *why*; Ch 4–11 define *how it's built*; Ch 12–15 define *how it's
> secured, tested, shipped, and sequenced*. The consistency across chapters — one
> decision showing up correctly everywhere — is the point.

| # | Chapter | What it decides |
|---|---------|-----------------|
| 00 | [Architecture Charter](./00-architecture-charter.md) | Scope, market, data reality, stack, cost — the constraints |
| 01 | [Product Vision, Mission, Problem, Users](./01-product-vision.md) | The "understanding gap"; persona; the wedge |
| 02 | [Competitor Analysis & Positioning](./02-competitor-analysis.md) | Where we sit differently: low-effort + high-guidance |
| 03 | [Feature Inventory, MVP & Roadmap](./03-feature-inventory-roadmap.md) | Feature IDs, the v1 line, the DoD, 4 phases |
| 04 | [Information Architecture & Navigation](./04-information-architecture.md) | Screens, routes, Quick-Capture overlay, user flows |
| 05 | [Domain Models & Database Design](./05-domain-models-database.md) | 7 tables, ERD, integer money, `user_id` scoping, soft delete |
| 06 | [System Architecture](./06-system-architecture.md) | Components, the API contract, request lifecycles, async seam |
| 07 | [Backend Architecture](./07-backend-architecture.md) | Layers, folders, middleware pipeline, endpoint contract |
| 08 | [Frontend Architecture](./08-frontend-architecture.md) | Server/client split, three kinds of state, component tiers |
| 09 | [Capture Architecture](./09-ai-architecture.md) ⚠️ | The flagship's design — **superseded**, see Ch 16 · ADR-001 |
| 10 | [Auth Flow & Authorization](./10-auth-and-authorization.md) | JWT scheme, refresh rotation, ownership-based authz |
| 11 | [Design System & Wireframes](./11-design-system-wireframes.md) | Tokens, dark mode, `MoneyText`, hero-screen wireframes, seed data |
| 12 | [Security Model](./12-security-model.md) | Threat model, control map, AI posture, explicit non-goals |
| 13 | [Testing Strategy](./13-testing-strategy.md) | Invariant-driven pyramid, the 9 must-have tests |
| 14 | [Deployment & Scaling](./14-deployment-scaling.md) | Free-tier topology, CI/CD, the honest scaling story |
| 15 | [Development & Future Roadmap](./15-development-future-roadmap.md) | 6-sprint build order, DoD gate, Phase 2–4 vision |
| **16** | **[Decision Log](./16-decision-log.md)** | **What changed during implementation, and why** — the parser vs LLM call, the rename, no charting library, the palette that failed validation |

## The through-lines

A few decisions, made once, reappear correctly across the whole design:

- **`user_id` scoping** → authorization model (10) + top security control (12) + a must-have test (13)
- **Integer minor-unit money** → schema (05) + `MoneyText` UI (11) + the first test (13)
- **The capture guardrails** → flagship (09) + security posture (12) — and they held *unchanged* when the LLM was replaced by a parser (16), which is the proof they were designed around the right thing
- **Stateless API + async seam** (06) → pre-paid the scaling story (14)
