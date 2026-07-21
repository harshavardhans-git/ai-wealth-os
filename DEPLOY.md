# Deployment

Free-tier topology (Ch 14): **Vercel** (web) + **Render** (API) + **Neon** (Postgres).
Target cost: **~$0/month**.

---

## 1. Database — Neon

Already provisioned. Copy the connection string from the Neon dashboard; it becomes
`DATABASE_URL` on Render.

## 2. API — Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → point it at the repo. It reads `render.yaml`.
3. Set the secret env vars in the dashboard (they are `sync: false` in the blueprint,
   so they are never committed):
   - `DATABASE_URL` — the Neon connection string
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate fresh ones:
     `openssl rand -hex 32`
   - `WEB_ORIGIN` — the Vercel URL, e.g. `https://ai-wealth-os.vercel.app`
4. Deploy. The build runs `prisma migrate deploy`, so the schema is applied
   automatically before the new version serves traffic.
5. Verify: `curl https://<your-api>.onrender.com/health`

## 3. Web — Vercel

1. Vercel → **New Project** → import the repo.
2. **Root Directory: `web`** (important — it's a monorepo).
3. Environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://<your-api>.onrender.com/api/v1`
4. Deploy.

## 4. Seed the system categories

Against the production database, once:

```bash
DATABASE_URL="<neon-url>" npm run db:seed -w @wealth-os/api
```

---

## Cold starts (Ch 14 §14.4)

Render's free tier sleeps after ~15 minutes idle; the next request pays a ~30s
spin-up. **Before demoing, warm it up:**

```bash
curl https://<your-api>.onrender.com/health
```

Demo mode keeps the AI feature instant regardless (Ch 9 §9.5).

## Rollback

- **Vercel** keeps every deploy — one-click rollback.
- **Render** — redeploy a previous build.
- Migrations are expand/contract (backward compatible), so the previous API version
  keeps working during a rollout.
