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
- `src/middleware/` — `HttpError`, 404 handler, terminal error handler
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
