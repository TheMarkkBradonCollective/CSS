# CSS — Customer Service Specialists

Two-sided marketplace scaffold from [CSS.md](./CSS.md): businesses post paid missions; certified Specialists (Levels 1–5) accept them and submit reports with photos stored in R2.

## Monorepo layout

| Path | Description |
|------|-------------|
| `apps/api` | Cloudflare Worker (Hono) + Neon Postgres + R2 |
| `apps/web` | Vite + React + TypeScript (Cloudflare Pages) |
| `migrations/` | SQL schema for core tables |
| `scripts/migrate.mjs` | Apply migrations using `DATABASE_URL` |

## Prerequisites

- Node.js 20+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler` or use the local copy after `npm install`)
- Neon account — **create a Postgres project named `CSS`**
- Cloudflare account (Workers, Pages, R2)

## 1. Install

```bash
npm install
```

## 2. Database (Neon)

1. Create a Neon project named **CSS**.
2. Copy the connection string (pooled recommended for Workers).
3. Apply migrations:

```bash
export DATABASE_URL="postgresql://..."
npm run migrate
```

Tables: `users`, `businesses`, `specialists`, `missions`, `mission_assignments`, `reports`, `report_photos`, `sessions` (see `migrations/002_auth.sql` for `password_hash` + sessions).

## 3. API Worker

Create an R2 bucket (name must match `wrangler.toml` or update the file):

```bash
npx wrangler r2 bucket create css-report-photos
```

Set the database secret (never commit the URL):

```bash
cd apps/api
npx wrangler secret put DATABASE_URL
# paste your Neon connection string when prompted
```

Local dev (optional `apps/api/.dev.vars`):

```
DATABASE_URL=postgresql://...
```

Run:

```bash
npm run dev:api
# http://localhost:8787
```

Deploy:

```bash
cd apps/api && npx wrangler deploy
```

### Worker bindings & secrets

| Name | Type | Purpose |
|------|------|---------|
| `DATABASE_URL` | **Secret** | Neon Postgres connection string |
| `REPORT_PHOTOS` | **R2 bucket** | Report photo objects (`css-report-photos`) |
| `ENVIRONMENT` | Var | Optional label (`development` in `wrangler.toml`) |

Auth uses **opaque session tokens** stored in Postgres (`sessions` table). Passwords are hashed in the Worker with WebCrypto PBKDF2-SHA256. **No `JWT_SECRET` is required** for the current implementation.

## 4. Web app (Cloudflare Pages)

```bash
npm run dev:web
# http://localhost:5173 — set VITE_API_URL to your local or deployed API
```

Build & deploy via Pages (connect repo or CLI):

```bash
cd apps/web
npm run build
npx wrangler pages deploy dist --project-name=css-web
```

Set Pages environment variable:

- `VITE_API_URL` — public URL of the deployed `css-api` Worker

`apps/web/wrangler.toml` documents `pages_build_output_dir = "dist"`.

## 5. Core loop (email + password auth)

1. **Register** at `/register` (business or specialist) or **sign in** at `/login`.
2. **Business** — post a mission on `/business`.
3. **Specialist** — accept an open mission on `/specialist` (level ≥ mission requirement).
4. Submit report with **photo** (multipart upload → R2 + DB).
5. **Business** — open **View report** on a completed mission (text + photo via API).

Sessions: `POST /auth/login` or `/auth/register` returns a `token`. Send `Authorization: Bearer <token>` on protected routes. `POST /auth/logout` revokes the session; `GET /auth/me` returns the current user.

After upgrading an existing database, run `npm run migrate` so `002_auth.sql` is applied. Users created before real auth have no password and must register again or reset via a future admin flow.

## 6. Tests

```bash
npm test
```

Runs Vitest tests in `apps/api` (health, CORS, auth register/login/session, password hashing).

## API overview

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account (business or specialist) |
| POST | `/auth/login` | — | Email + password sign-in |
| POST | `/auth/logout` | authenticated | Revoke session |
| GET | `/auth/me` | authenticated | Current user |
| POST | `/missions` | business | Create mission |
| GET | `/missions/mine` | business | List own missions |
| GET | `/missions/available` | specialist | Open missions |
| POST | `/missions/:id/accept` | specialist | Accept mission |
| POST | `/assignments/:id/report` | specialist | Submit report + photo |
| GET | `/missions/:id/report` | business | View submitted report |
| GET | `/reports/photos/:photoId` | — | Stream photo from R2 |

## Product context

See [CSS.md](./CSS.md) for mission types, specialist categories, and certification levels (CSS Level 1–5).

## License

Private / unset — add as needed.
