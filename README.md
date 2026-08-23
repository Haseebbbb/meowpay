# MeowPay

A payments demo — cats sending "treats" to each other. Backend:
Node.js, TypeScript, Express 5, Knex, PostgreSQL. Frontend: React, TypeScript,
Vite, MUI.

The frontend is never containerized — it always runs on the host with
`npm run dev`, and it needs the backend already up and reachable on
`localhost:3000` before it can do anything (auth, balance, transfers all go
through it). **Start the backend first in both flows below.**

## Prerequisites

- Node.js 20+ (developed on 25)
- Docker + Docker Compose (for PostgreSQL, and optionally the backend)

## Quick start — backend in Docker, frontend on your machine

```bash
# 1. Backend + Postgres
docker compose up --build
curl -i localhost:3000/health          # wait for this to return 200 first

# 2. Frontend — only start once the backend responds
cd web
cp .env.example .env
npm install
npm run dev
```

Frontend is then on http://localhost:5173, talking to the backend on :3000.

## Local development

Postgres in Docker, backend on your machine with hot reload, frontend on your
machine:

```bash
# 1. Postgres
docker compose up -d db

# 2. Backend
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

```bash
# 3. Frontend — in a second terminal, once /health above returns 200
cd web
cp .env.example .env
npm install
npm run dev
```

Frontend is then on http://localhost:5173 — `/` is the login/signup screen,
`/dashboard` the balance + transfer/top-up screen. Its `.env` points
`VITE_API_URL` at the backend (default `http://localhost:3000`); the backend's
`CORS_ORIGIN` (see Environment below) must match wherever the frontend
actually runs, or requests get blocked by the browser before they reach
Express at all.

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

The migration seeds 4 cats for local testing, all with the password
**`12345678`** — log in as any of them via `POST /auth/login` directly, no
signup needed.

| Name | Email | Balance | id |
| --- | --- | --- | --- |
| Whiskers | `whiskers@meowpay.dev` | 10000 | `11111111-1111-1111-1111-111111111111` |
| Mittens | `mittens@meowpay.dev` | 5000 | `22222222-2222-2222-2222-222222222222` |
| Tom | `tom@meowpay.dev` | 0 | `33333333-3333-3333-3333-333333333333` |
| Garfield | `garfield@meowpay.dev` | 25000 | `44444444-4444-4444-4444-444444444444` |

This only applies to a **fresh** database — if you migrated before this
change landed, knex won't re-run the seed step (it's tracked as already
applied), so your existing rows keep whatever `password_hash` they had
before. Roll back and reapply (`npm run migrate:rollback && npm run migrate`,
which drops and recreates both tables) to pick it up, or update the affected
rows directly.

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

## Money movement

Everything below requires `Authorization: Bearer <token>` (see Authentication).
The sender/actor is always taken from the token (`req.cat.id`) — never from the
request body — so a client can't spoof `fromCatId`.

### `GET /cats/search?q=`

Case-insensitive partial match on `name` or `email`, excluding your own cat.
Returns `[]` for a query under 2 characters (avoids a full-table scan), max 10
results, `[{ id, name, email }]` — no `password_hash`, no `balance`.

### `GET /me`

`{ id, name, email, balance }` for the authenticated cat.

### `POST /topups`

Body: `{ amount, idempotencyKey }`. Tops up your **own** balance — there's no
`toCatId`, it's always the authenticated cat. `amount` must be a positive
integer. Returns `{ transactionId, newBalance }`: `201` the first time an
`idempotencyKey` is processed, `200` if you resend the same key (the original
result is returned unchanged, balance isn't touched twice).

### `POST /transfers`

Body: `{ toCatId, amount, idempotencyKey }`. `400` if `toCatId` is your own id,
doesn't exist, or `amount` isn't a positive integer. Same `{transactionId,
newBalance}` / `201`-then-`200` idempotency behavior as topups, scoped to your
own id (so someone else generating the same random key never collides with
yours).

**Insufficient balance** → `422` with `{ "error": { "status": 422, "code": "insufficient_balance", "message": "..." } }`.
No transaction row is written on rejection — simpler idempotency semantics
than a `failed` row (which would itself count as "already processed" for a
retry, even though the client might reasonably want to retry after topping up).
Note this nests the code inside the standard `{ error: {...} }` envelope every
other endpoint uses, rather than the bare `{ error: "insufficient_balance" }`
string some API sketches use — kept consistent with the rest of the API.

Concurrency: the sender's row is locked (`SELECT ... FOR UPDATE`) inside the
DB transaction before the balance check, so two simultaneous transfers from
the same sender that would individually fit but together overdraw the balance
resolve to exactly one success and one `422` — the second transaction blocks
on the lock until the first commits, then sees the already-decremented balance.

### `GET /transactions`

All rows belonging to the authenticated cat (sent, received, and topups),
newest first. Each row includes a computed `direction: "sent" | "received" |
"topup"` — collapsed from the ledger's `type`/`direction` columns so the
frontend never has to cross-reference them itself.

### Testing this

- Unit tests (`*.spec.ts`, mocked, no DB): `npm test`.
- Integration tests (`*.integration.spec.ts`, **real** Postgres transactions —
  a mock can't prove `FOR UPDATE` locking actually serializes concurrent
  writes): `npm run test:integration`, requires `docker compose up -d db`.
  Runs against a separate `meowpay_test` database (auto-created + migrated by
  `test/globalSetup.js` on first run), never against dev data. Covers the two
  scenarios above: two simultaneous transfers that together overdraw a
  balance (exactly one succeeds), and sending the same transfer request twice
  with one `idempotencyKey` (same `transactionId`, balance moves once).

  The test database name is derived by swapping the database segment of
  whatever `DATABASE_URL` is already active — `.env`'s on the host, or
  docker-compose's injected value inside the container — rather than a
  separate `.env.test` file with its own hardcoded host. That's what lets the
  exact same command work both ways:

  ```bash
  npm run test:integration                              # on the host
  docker compose exec backend npm run test:integration  # inside the container
  ```

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
| `npm test` | Run the Jest unit test suite (mocked, no DB) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:integration` | Run integration tests against a real, separate `meowpay_test` database |

`test`/`test:watch` invoke `node --localstorage-file=.jest-localstorage .../jest.js`
directly rather than the plain `jest` binary — recent Node versions expose a global
`localStorage` that throws unless backed by a file, and `jest-environment-node`
touches it during setup. The backing file is gitignored and safe to delete.

## Environment

Copy `backend/.env.example` to `backend/.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Postgres connection string; startup fails without it |
| `PORT` | no | `3000` | HTTP listen port |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `JWT_SECRET` | yes | — | Signs/verifies auth JWTs; startup fails without it. **Use a real secret outside dev** |
| `JWT_EXPIRES_IN_SECONDS` | no | `604800` (7 days) | How long an issued JWT stays valid |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Origin allowed to make cross-origin requests — must match wherever `web/` is actually served from |

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

- `src/config/` — validated environment (`env.ts`), Knex config, shared connection pool, and the `Executor` type (`Knex | Knex.Transaction`) repository methods use when a service needs to run several writes atomically (see `transaction.service.ts`'s `db.transaction(...)` calls)
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

A route file can declare more than one absolute path when they belong to the
same domain even if their URLs don't share a prefix — e.g. `cat.route.ts`
declares both `/cats/search` and `/me` (both "about the current/other cats"),
mounted with `router.use('/', catRoute)`. Group by domain, not by URL shape.

## Frontend (`web/`)

Plain Vite + React + TypeScript, no framework router conventions beyond
`react-router-dom`. Never containerized — always `npm run dev` on the host.

| Route | Component | Purpose |
| --- | --- | --- |
| `/` | `src/pages/Auth.tsx` | Login/signup, pill mode toggle, stores the JWT on success |
| `/dashboard` | `src/pages/Dashboard.tsx` | Balance, recent transactions, opens the two modals below |

- `src/api/client.ts` — the one axios instance every request goes through; its
  interceptor attaches `Authorization: Bearer <token>` from `localStorage`
  (key `meowpay_token`) automatically. `src/api/{auth,cats,transactions}.ts`
  are thin typed wrappers over it — reuse these rather than calling
  `apiClient` directly or creating a second instance.
- `src/api/errors.ts` — `extractErrorMessage()` pulls the real backend message
  out of `{error: {message}}` (see Authentication/Money movement above) for
  display, falling back to a generic message for network errors.
- `src/components/{TransferModal,TopupModal}.tsx` — both generate a fresh
  `crypto.randomUUID()` idempotency key per submit attempt (not reused across
  retries), and call `onSuccess` to refetch the dashboard's data on completion.
- `src/theme.ts` — the MUI theme (palette, pill buttons/toggle, 20px cards).
  `typography.fontWeightBold` is deliberately pinned to the same value as
  `fontWeightMedium` (500) so nothing rendered through the theme's `'bold'`
  shorthand can end up at true bold (700).
- No route guards yet — `Dashboard` checks for a token itself on mount and
  redirects to `/` if missing, or if any fetch comes back `401`.

### Scripts (`web/`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server (default `http://localhost:5173`) |
| `npm run build` | Typecheck (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | Run `oxlint` |

### Frontend environment

Copy `web/.env.example` to `web/.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | no | `http://localhost:3000` | Base URL the axios client sends requests to |

## Project layout

```
meowpay/
├── docker-compose.yml     # postgres + backend
├── backend/
│   ├── knexfile.ts        # knex CLI entry; re-exports src/config/knex.config.ts
│   ├── Dockerfile         # multi-stage build, runs as non-root
│   └── src/
└── web/
    ├── .env.example
    └── src/
        ├── api/           # apiClient + typed wrappers (auth, cats, transactions, errors)
        ├── components/     # TransferModal, TopupModal
        ├── pages/         # Auth (/), Dashboard (/dashboard)
        ├── utils/
        ├── theme.ts
        └── App.tsx        # ThemeProvider + CssBaseline + routes
```
