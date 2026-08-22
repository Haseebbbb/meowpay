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
});
