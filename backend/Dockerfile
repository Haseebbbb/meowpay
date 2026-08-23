# ---- build stage ----------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- dev stage --------------------------------------------------------------
# Used by docker-compose.yml (target: dev). Source is bind-mounted at runtime,
# not copied here, so nodemon on the host and in the container watch the same files.
FROM node:24-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm ci

EXPOSE 3000

# Runs pending migrations before every start. knex tracks applied migrations in
# the knex_migrations table, so this is a no-op ("Already up to date") once
# nothing new has landed — safe to run on every container start/rebuild.
CMD ["sh", "-c", "npm run migrate && npm run dev"]

# ---- runtime stage --------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3000

# Same idempotent migrate-then-start pattern as the dev stage, against the
# compiled config/migrations since ts-node isn't installed in this stage.
CMD ["sh", "-c", "npm run migrate:prod && node dist/index.js"]
