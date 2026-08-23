import dotenv from 'dotenv';

// Loaded once, here. No other module in the codebase reads process.env directly —
// everything imports the validated `env` object below.
dotenv.config();

export type NodeEnv = 'development' | 'test' | 'production';

export interface Env {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  corsOrigin: string;
}

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    // Fail at startup rather than on the first query with a confusing driver error.
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}" is not a valid port number`);
  }

  return port;
}

function parsePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name}: "${raw}" is not a positive integer`);
  }

  return value;
}

function parseNodeEnv(raw: string | undefined): NodeEnv {
  if (raw === 'production' || raw === 'test' || raw === 'development') {
    return raw;
  }

  return 'development';
}

const nodeEnv = parseNodeEnv(process.env['NODE_ENV']);

export const env: Env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parsePort(process.env['PORT'], 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresInSeconds: parsePositiveInt(
    process.env['JWT_EXPIRES_IN_SECONDS'],
    60 * 60 * 24 * 7,
    'JWT_EXPIRES_IN_SECONDS',
  ),
  // Default matches the Vite dev server's default port (web/vite.config.ts).
  corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',
});
