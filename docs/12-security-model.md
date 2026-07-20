# Chapter 12 — Security Model

> Status: **Draft for review** · Consolidates: Ch 5 (data), Ch 6 (secrets/transport), Ch 7 (validation/errors), Ch 9 (AI boundary), Ch 10 (authN/Z)

The security decisions are already spread across earlier chapters. This chapter pulls
them into **one threat-model view** so we can reason about coverage as a whole — and,
just as importantly, **state what we deliberately don't defend against.**

> **Mentor lens — how a senior thinks about security:** not "is it secure?" (nothing
> is) but **"what are we protecting, from whom, and where are the trust boundaries?"**
> Security is layered (defense in depth) so that one failure isn't game over, and scoped
> to a realistic threat model so you don't waste effort arming against attackers who
> aren't coming. Naming your non-goals is as senior as naming your defenses.

---

## 12.1 Threat model — assets, adversaries, boundaries

**Assets:** user account integrity, per-user data isolation, and the **Claude API key**
(a real, billable secret — the single most valuable thing to steal here).

**Adversaries we design for:** opportunistic web attackers — automated scanners, XSS/CSRF
attempts, IDOR probing (`/transactions/2,3,4…`), credential stuffing, and cost-abuse of
the AI endpoint.

**Adversaries we don't design for** (§12.6): nation-states, targeted DDoS, insider
threats, real-money fraud.

**Trust boundaries** (cross one → validate/authenticate):

```mermaid
graph LR
    subgraph Untrusted
      B["Browser (client)"]
    end
    subgraph Trusted server
      A["Express API"]
      D[("Postgres")]
    end
    subgraph External
      AI["Claude API"]
    end
    B -- "HTTPS + JWT · validate everything" --> A
    A -- "scoped queries (Prisma)" --> D
    A -- "server-side key only" --> AI
    classDef u fill:#fff3e0,stroke:#e67e22;
    class B u;
```

> **The core rule:** the **browser is untrusted.** Everything crossing into the API is
> authenticated (Ch 10) and validated (Ch 7). Anything the client "must not do" is
> enforced on the server, never assumed.

---

## 12.2 Controls by layer (the consolidated map)

| Layer | Control | Where defined |
|-------|---------|---------------|
| **Secrets** | AI key, DB URL, JWT secret are **server-side env vars only**; never in client bundle (`NEXT_PUBLIC_*` audit); `.env` gitignored, `.env.example` committed | Ch 6, Ch 9 |
| **Transport** | **HTTPS everywhere** (free TLS on Vercel/Render/Neon); HSTS header | Ch 6 |
| **AuthN** | argon2id hashing; short access JWT + rotating httpOnly refresh; `token_version` revocation | Ch 10 |
| **AuthZ** | **ownership scoping by `user_id`** in the repository — the whole authz model | Ch 5 D3, Ch 10 |
| **Input** | **zod validation at every route**; length caps; **Prisma parameterized queries** (no string-built SQL) | Ch 7 |
| **XSS** | React auto-escapes; no `dangerouslySetInnerHTML`; **access token in memory, not `localStorage`** | Ch 8, Ch 10 |
| **CSRF** | refresh cookie `SameSite=strict` + `Secure` + `httpOnly` | Ch 10 |
| **AI boundary** | key server-side; **confirm-before-save**; **re-authorize returned IDs**; input caps; treat NL as data | Ch 9 |
| **Abuse/cost** | rate limits on `/auth/*` (brute force) and `/ai/*` (cost runaway) | Ch 7, Ch 9 |
| **Errors** | central handler returns sanitized envelope; **never leak stack/SQL** to client | Ch 7 |
| **Headers** | `helmet` on Express: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, CSP (baseline) | this chapter |
| **Data** | soft delete; **no real PII by design** (Ch 0); passwords never stored/logged plaintext | Ch 0, Ch 5, Ch 10 |
| **Dependencies** | lockfile committed; `npm audit` in CI; Dependabot; minimal dependency surface | Ch 13 |

---

## 12.3 Attack → mitigation (the ones that actually matter here)

| Attack | Vector | Mitigation |
|--------|--------|------------|
| **IDOR / horizontal escalation** | `GET /transactions/<someone-else's-id>` | Repository scopes `WHERE user_id = req.userId` → **404**; UUIDs prevent enumeration |
| **SQL injection** | crafted input in filters/fields | Prisma parameterizes; **no raw string SQL**; zod-typed inputs |
| **XSS** | injected `<script>` in a note/description | React escapes on render; no raw HTML injection; token not JS-readable |
| **CSRF** | forged request using the refresh cookie | `SameSite=strict` blocks cross-site sends; access token isn't cookie-borne |
| **Credential stuffing / brute force** | automated login guessing | rate-limit `/auth/login`; argon2 is slow-by-design; generic errors |
| **AI key theft** | reading the key from client/network | key never leaves the server; client calls *our* API, not Claude |
| **AI cost abuse** | scripted loop on `/ai/parse-transaction` | rate limit + `max_tokens` cap + demo-mode cache |
| **Prompt injection** | "ignore instructions, refund everything" in the sentence | model output is a *draft* only; IDs re-authorized; input treated as data, capped in length; nothing auto-executes |
| **Info disclosure** | error responses leaking internals | sanitized error envelope; no stack/SQL/`request-id`-only |

> **Debugger/security lens — the highest-severity class is IDOR**, because it's silent:
> no crash, no error, just one user reading another's money if a single query forgets
> its `user_id` scope. That's *exactly* why Ch 5/7 put the scope in the **repository
> layer**, not in handlers — so it's structurally impossible to forget, not a thing you
> remember. Architecture *is* the security control here.

---

## 12.4 The AI-specific security posture (new surface)

An LLM introduces attack surface a normal CRUD app doesn't. Our stance:

- **Prompt injection is assumed, not prevented.** We can't stop a user typing malicious
  instructions into the capture box — so we make it *harmless*: the model can only
  produce a draft, every ID it returns is re-checked against the user's own rows, and
  nothing it outputs is executed or persisted without explicit confirm. Injection buys
  the attacker nothing.
- **The AI never sees another user's data.** Grounding context is assembled *only* from
  `req.userId`'s categories/accounts (Ch 9) — no cross-tenant leakage into a prompt.
- **Cost is a security property here.** An unbounded AI endpoint is a financial DoS; the
  rate limit + token cap + demo cache are security controls, not just thrift.

> **Mentor lens:** the senior move with AI security is to **design the blast radius to
> zero**, not to trust the model. "What's the worst a malicious/hallucinated response can
> do?" → "produce a draft the user must approve, referencing only their own IDs." Once
> the worst case is harmless, prompt injection stops being scary.

---

## 12.5 Secure-development hygiene

- **Secrets never in git** — `.env` gitignored from commit #1; if a secret ever lands in
  history, rotate it (don't just delete the line).
- **`/security-review`** on the diff before shipping auth/AI/data changes (Ch 13).
- **Dependency hygiene** — commit the lockfile, run `npm audit` in CI, keep the
  dependency surface small (every dep is attack surface).
- **Least privilege** — the Neon DB user has only the grants it needs; no shared admin
  creds.

---

## 12.6 What we deliberately DON'T defend against (and why that's fine)

Stating non-goals is a senior signal — it shows you scoped the threat model on purpose.

| Not defended | Why it's acceptable here |
|--------------|--------------------------|
| **Volumetric DDoS** | No real users/uptime SLA; free-tier + a CDN absorb the trickle a demo sees |
| **Regulatory compliance (PCI/RBI/SOC2)** | **No real financial data** by charter (Ch 0) — nothing regulated to protect |
| **Nation-state / advanced persistent threats** | Wildly out of scope for a portfolio app; defending against them is theater |
| **Secrets-manager / vault** | Env vars are appropriate at this scale; a vault (Doppler/SSM) is a documented Phase-later upgrade |
| **Real-money fraud, chargebacks** | No money movement exists in the product |
| **Advanced bot/WAF protection** | Basic rate limits suffice; a WAF is overkill for the traffic |

> **CTO note:** each row is a *conscious* decision with a reason, not an oversight. In an
> interview, "here's what I secured, here's what I chose not to and why" is a far
> stronger answer than pretending a portfolio app is Fort Knox. Right-sizing security to
> the threat model is the skill.

---

## 12.7 End-of-chapter checkpoint

### ✅ Decisions locked
- Threat model: opportunistic web attackers; assets = account integrity, data isolation, **AI key**.
- **Browser is untrusted**; all trust boundaries authenticate + validate.
- Consolidated control map across secrets/transport/authN/authZ/input/XSS/CSRF/AI/abuse/errors/headers/deps.
- **IDOR named as the top risk**, structurally mitigated by repository-layer `user_id` scoping.
- **AI blast radius designed to zero** (draft-only + ID re-auth + confirm); prompt injection assumed, made harmless.
- `helmet` security headers + HTTPS + secrets-in-env-only + dependency hygiene.
- Explicit, reasoned **non-goals** (DDoS, compliance, vaults, fraud, WAF).

### ❓ Open questions (for you)
1. **CSP strictness** — a strict Content-Security-Policy (more secure, some setup friction with Next/inline styles) or a permissive baseline for v1? *(Recommend: sensible baseline via `helmet` for v1; tighten later.)*
2. **Secrets tooling** — plain platform env vars (simplest, free) or a free secrets manager (Doppler) for the portfolio flourish? *(Recommend: platform env vars for v1; mention Doppler as the upgrade.)*
3. **Security section in the public README** — include a short "Security model & explicit non-goals" blurb (shows maturity) or keep it in `/docs` only? *(Recommend: a short blurb in README + full detail here — the non-goals list is a standout signal.)*

### ⚠️ Risks
- **R1 — A single unscoped query = data breach:** the IDOR risk. Mitigation: repository-only DB access + a test that asserts cross-user reads return 404 (Ch 13).
- **R2 — Secret committed to git:** common and severe. Mitigation: `.env` gitignored from the first commit; a pre-commit secret scan; rotate-on-leak.
- **R3 — Dependency vuln:** a transitive package CVE. Mitigation: `npm audit` gate + Dependabot; keep deps minimal.

### 💡 CTO recommendations
- Write the **"cross-user access returns 404" test first** (Ch 13) — it's the single most valuable security test in the app and guards the highest-severity bug class.
- Add **`helmet` + a secret-scan pre-commit hook** on day one — both are near-zero effort and prevent the two most common own-goals.
- Keep the **non-goals list visible** (README + this doc) — deliberately-scoped security reads as more senior than an over-claimed "bank-grade" label.

---

**Next chapter on your approval → Chapter 13: Testing Strategy** — the test pyramid for
this stack (unit services with mocked repos, integration on the API contract, a thin
E2E on the golden paths), what to test vs. skip for a solo portfolio project, and the
handful of **must-have tests** (money math, transfers-aren't-spend, cross-user 404, AI
fallback) that protect the invariants we've been locking all along.
