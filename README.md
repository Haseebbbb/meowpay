# MeowPay

Payments backend built with Node.js, TypeScript, Express 5, Knex and PostgreSQL.

## Prerequisites

- Node.js 20+ (developed on 25)
- Docker + Docker Compose (for PostgreSQL)

## Quick start — everything in Docker

```bash
docker compose up --build
curl -i localhost:3000/health
```

## Local development

Run Postgres in Docker, the API on your machine with hot reload:

```bash
docker compose up -d db

cd backend
cp .env.example .env
npm install
npm run dev
```

The API is then on http://localhost:3000.

```bash
curl -i localhost:3000/health
```

```json
{ "status": "ok", "uptime": 12, "timestamp": "…", "database": "up" }
```

If Postgres is unreachable the same endpoint returns **503** with
`"status": "degraded"` and `"database": "down"`.

## Database

### Schema

| Table | Columns |
| --- | --- |
| `cats` | `id` (uuid, pk) · `name` · `email` (unique) · `password_hash` · `balance` (integer, smallest currency unit) · `created_at` · `updated_at` |
| `transactions` | `id` (uuid, pk) · `type` (`TOPUP` \| `TRANSFER`) · `cat_id` (fk → `cats.id`, the ledger owner of this row) · `direction` (`incoming` \| `outgoing`) · `counterparty_cat_id` (nullable fk → `cats.id`, null for topups) · `amount` (integer) · `status` (`completed` \| `failed`) · `idempotency_key` · `created_at` · `updated_at` |

`transactions` is a ledger: one row per affected cat, not one row per transfer. A
`TRANSFER` writes two rows — `outgoing` for the sender, `incoming` for the receiver —
sharing the same `idempotency_key`, so direction is read straight off the row instead
of inferred from `type` plus which of two FK columns is null. A `TOPUP` writes a
single `incoming` row with `counterparty_cat_id` null (money originates outside the
system). Because sibling rows of one transfer share an `idempotency_key`, the unique
constraint is on `(idempotency_key, direction)` rather than `idempotency_key` alone —
a real retry (same key, same direction) still collides; the incoming/outgoing pair
of one transfer doesn't.

Defined in [`backend/src/migrations/20260822213107_create_cats_and_transactions.ts`](backend/src/migrations/20260822213107_create_cats_and_transactions.ts).

### Running the migration

The backend container runs pending migrations automatically on every start (see
its `Dockerfile` `CMD`) — knex tracks what's already applied, so this is a no-op
once nothing new has landed. With `docker compose up -d --build`, there's nothing
else to do.

To run it manually — e.g. for local dev without Docker, or to roll back:

```bash
cd backend
npm run migrate              # apply pending migrations
npm run migrate:rollback     # drop the last batch (both tables, here)
```

Or against the Dockerized backend: `docker compose exec backend npm run migrate` / `migrate:rollback`.

### Dummy cats

The migration seeds 4 cats for local testing. **All seeded `password_hash` values are placeholders, not real bcrypt-compatible hashes** — you can't log in as them via `POST /auth/login`; they exist so `cats` rows aren't empty. Use `POST /auth/signup` to create a cat you can actually log in as.

| Name | Email | Balance | id |
| --- | --- | --- | --- |
| Whiskers | `whiskers@meowpay.dev` | 10000 | `11111111-1111-1111-1111-111111111111` |
| Mittens | `mittens@meowpay.dev` | 5000 | `22222222-2222-2222-2222-222222222222` |
| Tom | `tom@meowpay.dev` | 0 | `33333333-3333-3333-3333-333333333333` |
| Garfield | `garfield@meowpay.dev` | 25000 | `44444444-4444-4444-4444-444444444444` |

## Authentication

Every request must carry a valid JWT **except** an explicit exemption list —
currently `GET /health`, `POST /auth/signup`, and `POST /auth/login` (see
`PUBLIC_ROUTES` in [`backend/src/middleware/authenticate.ts`](backend/src/middleware/authenticate.ts)).
Everything else, present or future, requires `Authorization: Bearer <token>` —
a new route is protected by default; you opt it *out*, not in.

### Signup

```bash
curl -i -X POST localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Felix","email":"felix@meowpay.dev","password":"secret123"}'
```

Hashes the password (bcrypt-compatible, via `bcryptjs`), inserts a cat with
`balance: 0`, returns `201`:

```json
{ "token": "eyJ...", "cat": { "id": "…", "name": "Felix", "email": "felix@meowpay.dev" } }
```

`409` if the email is already registered. `400` for a missing name, malformed
email, or a password under 6 characters.

### Login

```bash
curl -i -X POST localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"felix@meowpay.dev","password":"secret123"}'
```

Same `{ token, cat }` shape as signup on success (`200`). `401` for either a
wrong password or an unknown email — deliberately the same message for both,
so a caller can't use the error to enumerate registered addresses.

### Using the token

```bash
curl -i localhost:3000/some-protected-route \
  -H "Authorization: Bearer <token>"
```

The JWT payload is `{ id, name, email, iat, exp }` — the same three cat fields
returned from signup/login, so a caller never needs a separate "who am I"
lookup. It's signed with `JWT_SECRET` and expires after `JWT_EXPIRES_IN_SECONDS`
(default 7 days). A missing/malformed header or an invalid/expired token
returns `401` before the request reaches routing at all — a nonexistent path
with no token gets `401`, not `404` (the `404` only surfaces once a valid
token gets you past the auth gate).

## Scripts (`backend/`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon + ts-node, reloading on change |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type check without emitting |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:rollback` | Roll back the last migration batch |
| `npm run migrate:make -- <name>` | Create a new `.ts` migration |
| `npm run migrate:prod` | Apply migrations from compiled `dist/` |

## Environment

Copy `backend/.env.example` to `backend/.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Postgres connection string; startup fails without it |
| `PORT` | no | `3000` | HTTP listen port |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `JWT_SECRET` | yes | — | Signs/verifies auth JWTs; startup fails without it. **Use a real secret outside dev** |
| `JWT_EXPIRES_IN_SECONDS` | no | `604800` (7 days) | How long an issued JWT stays valid |

## Architecture

The backend follows a strict **route → controller → service → repository** layering.
Each layer may only call the one below it — nothing skips a layer.

| Layer | Responsibility | Must NOT |
| --- | --- | --- |
| `src/routes/` | Map path + HTTP verb to a controller method; attach validation middleware | Contain logic |
| `src/controllers/` | Read the request, call a service, shape the response | Touch Knex |
| `src/services/` | Business rules, orchestration, composing repositories | Know about `req`/`res` |
| `src/repositories/` | All Knex/SQL access; returns plain typed objects | Contain business rules |

Supporting directories:

- `src/config/` — validated environment (`env.ts`), Knex config, shared connection pool
- `src/models/` — TypeScript interfaces for rows and payloads (Knex is a query builder, so there are no ORM classes)
- `src/middleware/` — `HttpError`, 404 handler, terminal error handler, the global `authenticate` JWT gate
- `src/utils/` — small cross-cutting helpers used by more than one layer (e.g. `jwt.ts`, used by both `auth.service.ts` and `authenticate.ts`)
- `src/types/` — ambient TypeScript augmentations (e.g. `express.d.ts` adds `req.cat`); see the note in `app.ts` about why it's referenced via `/// <reference>` rather than imported
- `src/migrations/` — Knex migrations
- `src/app.ts` — builds the Express app (no `listen`, so tests can import it)
- `src/index.ts` — starts the server and handles graceful shutdown

`GET /health` is implemented across all four layers as the reference example: the
repository runs `select 1`, the service turns that into a status, the controller
maps the status to 200 or 503.

### Adding a module

For a new domain (say `payments`), add one file per layer and wire it up:

```
src/models/payment.model.ts            # Payment interface
src/migrations/<ts>_create_payments.ts # npm run migrate:make -- create_payments
src/repositories/payment.repository.ts # imports { db } from config/database
src/services/payment.service.ts        # imports the repository
src/controllers/payment.controller.ts  # imports the service
src/routes/payment.route.ts            # imports the controller
```

Then mount it in `src/routes/index.ts`:

```ts
router.use('/payments', paymentRoute);
```

## Project layout

```
meowpay/
├── docker-compose.yml     # postgres + backend
├── backend/
│   ├── knexfile.ts        # knex CLI entry; re-exports src/config/knex.config.ts
│   ├── Dockerfile         # multi-stage build, runs as non-root
│   └── src/
└── web/                   # frontend (added later)
```
