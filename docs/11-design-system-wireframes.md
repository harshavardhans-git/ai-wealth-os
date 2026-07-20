# Chapter 11 — Design System, UI Components & Wireframes

> Status: **Draft for review** · Depends on: Ch 4 (screens/IA), Ch 5 (money, categories), Ch 8 (component tiers, shadcn/ui, Recharts)

For a portfolio project, **this chapter is disproportionately important** — it's what a
recruiter *sees* in the first five seconds, before they read a line of code. A generic
UI makes senior architecture look junior; a considered one makes the whole project read
as "built by someone who ships."

> **Mentor lens:** a design system is the same idea as the backend's repository layer —
> **a single source of truth so a decision is made once.** Colors, spacing, and radii
> live in *tokens*; components consume tokens, never raw values. Change a token, the
> whole app updates. Hard-coded `#3b6cff` scattered across 40 files is the CSS version
> of querying Prisma from a controller.

---

## 11.1 Visual direction

**Calm, precise, trustworthy — "financial workspace," not "flashy fintech."**
Benchmarks: Linear (precision), Stripe (trust), Notion (calm). Deliberately **avoid**
the two clichés: the purple-gradient "AI app" look, and the warm-cream/serif default
that reads as editorial, not financial.

- **Type:** one clean grotesque for UI (e.g. Inter/Geist) + tabular figures for numbers
  (money must align in columns — non-negotiable in a finance app).
- **Density:** comfortable, generous whitespace; data-dense where it counts (tables).
- **Motion:** subtle, functional (skeletons, dialog transitions) — never decorative.
- **Both themes first-class:** light and dark, driven by tokens (§11.2).

---

## 11.2 Design tokens (the single source of truth)

Tokens are CSS variables, themed by `:root` / `[data-theme="dark"]`. Components read
**semantic** names (`--color-danger`), never raw hex.

| Token role | Purpose | Light → Dark intent |
|------------|---------|---------------------|
| `--bg` | app background | near-white → near-black |
| `--surface` | cards, panels | white → elevated dark gray |
| `--border` | dividers, inputs | light gray → subtle gray |
| `--text` / `--text-muted` | primary / secondary text | high / medium contrast both themes |
| `--primary` | brand, primary actions | a calm blue-teal (trust, not purple) |
| `--positive` | income / under-budget | green (color-blind-safe pairing) |
| `--negative` | expense / over-budget | red/rose (never red *alone* — see a11y) |
| `--warning` | budget nearing limit | amber |
| Scales | `--space-*` (4px base), `--radius-*`, `--font-size-*`, `--shadow-*` | consistent rhythm |

> **Design decision — semantic tokens, not literal ones.** We name by *meaning*
> (`--negative`) not *value* (`--red-500`). *Why:* the meaning is stable; the value can
> be retuned (and *must* differ per theme) without touching a single component. This is
> exactly the "name the trade-off, centralize the rule" pattern from every prior chapter.

> **Note on chart colors:** semantic UI colors are settled here. The **categorical
> palette for charts** (spend-by-category, etc.) is a distinct problem — it must be
> contrast- and color-blind-validated — so we finalize and validate it at *build time*
> using a proper data-viz method, not eyeball it now. Documented as a build-time task.

---

## 11.3 Component system (the three tiers, concretely)

Built on **shadcn/ui** (Ch 8 — you own the code) + Radix primitives for accessibility.

| Tier | Knows about | Components (v1) |
|------|-------------|-----------------|
| **`ui/` (primitives)** | tokens + Tailwind only; nothing about finance | Button, Input, Select, Card, Dialog, **Command** (⌘K), Table, Badge, Tabs, Tooltip, Skeleton, Toast |
| **`patterns/` (composites)** | primitives; generic app patterns | `MoneyText`, `StatCard`, `DataTable`, `EmptyState`, `QueryBoundary`, `BudgetBar`, `CategoryPill`, `PageHeader` |
| **`features/` (domain)** | patterns + data hooks; knows the domain | `TransactionForm`, `TransactionsTable`, `QuickCapture`, `BudgetList`, `DashboardSummary`, `AccountCard` |

> **The `MoneyText` component is the most important primitive-of-meaning in the app.**
> It takes `amountMinor` + `currency` + `type`, and renders formatted, sign-aware,
> color-coded, tabular-figure money — in *one* place. *Why it matters:* money formatting
> is a rule that must never diverge (Ch 5 D1). If every screen formatted money inline,
> one `parseFloat` reintroduces the float bug. `MoneyText` is the UI edge of the money
> discipline — the mirror of the backend `lib/money`.

---

## 11.4 Wireframes (low-fidelity, hero screens)

### Dashboard (`/app`) — the "how am I doing?" view

```
┌───────────┬──────────────────────────────────────────────── ⌘K [＋ Capture] ─┐
│  ◆ Wealth │  Dashboard                                    Base: ₹ INR   [◑]   │
│           ├──────────────────────────────────────────────────────────────────┤
│ ▸ Dash    │  ┌─Net Worth──────┐ ┌─This Month────┐ ┌─Spent────┐ ┌─Health──┐  │
│   Txns    │  │  ₹ 2,45,300     │ │ +₹52,000 in   │ │ ₹38,410  │ │  (P2)   │  │
│   Accounts│  │  ▲ 4.2% mo      │ │ −₹38,410 out  │ │ of ₹45k  │ │  soon   │  │
│   Budgets │  └────────────────┘ └───────────────┘ └──────────┘ └─────────┘  │
│   Settings│  ┌─Cash flow (6 mo)────────────┐ ┌─Spend by category──────────┐ │
│           │  │  ▁▃▅▂▆▄  (Recharts area)     │ │  ▓ Food  ▓ Rent  ▓ Shop …  │ │
│           │  └─────────────────────────────┘ └────────────────────────────┘ │
│           │  ┌─Budgets────────────────────────────────────────────────────┐ │
│  [Acct ▾] │  │  Food     ▓▓▓▓▓▓▓░░  ₹6.4k/₹8k   Transport ▓▓▓░░░░ ₹1.2k/… │ │
└───────────┴──┴──────────────────────────────────────────────────────────────┘
```

### Quick Capture overlay (⌘K) — the flagship (A1)

```
        ┌──────────────────────────────────────────────────────┐
        │  ＋  Type an expense…                                 │
        │  ┌────────────────────────────────────────────────┐  │
        │  │ coffee 250 yesterday with card                 │  │
        │  └────────────────────────────────────────────────┘  │
        │  AI draft ·  confidence ●●●●○                        │
        │  ┌─ Amount ─┐ ┌─ Category ─┐ ┌─ Account ─┐ ┌─Date─┐  │
        │  │ ₹250.00  │ │ Food ▾     │ │ HDFC Card │ │ 19th │  │
        │  └──────────┘ └────────────┘ └───────────┘ └──────┘  │
        │                              [ Edit ]  [ Save ↵ ]    │
        └──────────────────────────────────────────────────────┘
```

> Note the **confidence dots** and the **fully editable draft** — the Ch 9 safety model
> made visible. Low confidence → this same panel opens as the plain manual form.

### Transactions (`/app/transactions`)

```
Transactions                                   [Filter ▾] [Import CSV] [＋ Add]
┌──────────┬─────────────────────┬────────────┬──────────┬──────────────────┐
│ Date     │ Description         │ Category   │ Account  │           Amount │
├──────────┼─────────────────────┼────────────┼──────────┼──────────────────┤
│ Jul 19   │ Coffee        [AI]  │ ● Food     │ HDFC Card│         −₹250.00 │
│ Jul 18   │ Salary              │ ● Salary   │ HDFC Bank│      +₹52,000.00 │
│ Jul 18   │ Groceries           │ ● Groceries│ Cash     │       −₹1,840.00 │
└──────────┴─────────────────────┴────────────┴──────────┴──────────────────┘
                                                        ‹ 1 2 3 … ›  (offset)
```

> `[AI]` badge = `source='ai'` (Ch 5) — subtly showcases the wedge in the ledger.
> Amounts via `MoneyText`: right-aligned, tabular, sign-colored.

---

## 11.5 Seed & demo dataset (deferred from Ch 5)

The seed is a **first-class feature** (Ch 3) — the recruiter's first impression. India-
flavored data, currency-neutral logic (Ch 1 decision).

**Default system categories** (`is_system=true`, `user_id=NULL`):
- *Expense:* Food & Dining · Groceries · Transport · Rent & Housing · Utilities ·
  Shopping · Entertainment · Health · Education · Subscriptions · Travel · Miscellaneous
- *Income:* Salary · Freelance · Interest · Refunds · Gifts · Other

**Demo user** (`is_demo=true`): 4 accounts (HDFC Bank, HDFC Credit Card, Cash, Paytm
Wallet), **~3 months** of realistic transactions (salary on the 1st, recurring
subscriptions, daily-life spend with variety), 4–5 budgets at varied fill levels, and a
handful of **pre-seeded `ai_parse_logs`** so Quick Capture demos instantly at $0 (Ch 9).

> **Mentor lens:** treat seed data as *product content*, engineered — realistic amounts,
> believable merchants, correct recurrence. A dashboard full of `$100 · Test · Test`
> undoes all the architecture. This is where craft shows.

---

## 11.6 Accessibility (non-optional)

| Concern | Rule |
|---------|------|
| Contrast | WCAG AA (4.5:1 text) in **both** themes; verify tokens |
| Color independence | Never encode meaning by color alone — pair with sign (`+/−`), icon, or label (red/green is the most common color-blindness) |
| Keyboard | Full keyboard nav; ⌘K/Ctrl-K opens Quick Capture; visible focus rings; `Esc` closes dialogs |
| Semantics | Real `<button>`/`<table>`/`<label>`; Radix handles dialog focus-trap + ARIA |
| Motion | Respect `prefers-reduced-motion` |

> **Debugger/inclusion lens:** "positive green / negative red" is a trap — ~8% of men
> can't distinguish them. That's *why* `MoneyText` also carries an explicit `+`/`−` and
> why over-budget shows an icon, not just a red bar. Accessibility isn't a checkbox;
> it's the same "don't rely on one signal" discipline as the AI confidence fallback.

---

## 11.7 End-of-chapter checkpoint

### ✅ Decisions locked
- Visual direction: **calm financial workspace** (Linear/Stripe/Notion), avoiding purple-gradient and cream-serif clichés.
- **Semantic design tokens** in CSS variables; light + dark first-class.
- **shadcn/ui + Radix**, organized in the `ui → patterns → features` tiers.
- **`MoneyText`** as the UI edge of the money-formatting rule.
- Wireframes locked for Dashboard, Quick Capture, Transactions.
- **Default category list + demo dataset** defined; seed treated as engineered product content.
- **Accessibility = AA contrast + no color-only meaning + full keyboard**, enforced structurally.
- Chart **categorical palette** deferred to build-time validation (data-viz method).

### ❓ Open questions (for you)
1. **Primary brand color** — the calm blue-teal I proposed, or do you want a different accent (still avoiding purple)? *(Recommend: blue-teal; easy to retune since it's one token.)*
2. **Font** — Inter (ubiquitous, safe) vs Geist (more distinctive, modern) for UI? *(Recommend: Geist for a touch more character; both free.)*
3. **Logo/name treatment** — since "AI Wealth OS" is a working title (Ch 1), do a simple wordmark + monogram now, or leave a placeholder until the name settles? *(Recommend: simple monogram placeholder; don't over-invest in a name that may change.)*

### ⚠️ Risks
- **R1 — Generic UI undercuts the architecture:** the biggest portfolio risk. Mitigation: invest in tokens, spacing, and the hero screens; polish the dashboard first.
- **R2 — Weak seed data:** unrealistic demo data reads as unfinished. Mitigation: engineer believable seed content (§11.5).
- **R3 — Accessibility regressions:** easy to lose in iteration. Mitigation: contrast + keyboard in the component-review checklist (Ch 13).

### 💡 CTO recommendations
- Build the **token file + `MoneyText` + `StatCard` + `QueryBoundary` first** — the dashboard is assembled from these; nail them and every screen inherits the polish.
- Ship **dark mode from day one**, not as a retrofit — token-based theming makes it nearly free, and it reads as "premium."
- Make the **Quick-Capture overlay pixel-perfect** — it's the hero interaction; disproportionate polish here pays the biggest demo dividend.

---

**Next chapter on your approval → Chapter 12: Security Model** — consolidating the
security decisions scattered across Ch 5/6/7/9/10 into one threat-model view: secrets,
transport, input validation, the AI-key boundary, CSRF/XSS posture, dependency hygiene,
and what we explicitly *don't* defend against (and why that's OK for this project).
