// Jest `globalSetup`: runs once, in a separate process from the test workers,
// before any integration test file executes. Responsible for making sure the
// test database exists and is migrated — NOT for setting env vars for the
// test files themselves (globalSetup's process.env changes don't propagate
// to workers; see test/setupTestEnv.js, which does the same DATABASE_URL
// derivation independently since it runs in a different process).
const path = require('node:path');
const { execSync } = require('node:child_process');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = async function globalSetup() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL is not set — check backend/.env or the environment');
  }

  const databaseUrl = baseUrl.replace(/\/[^/]+$/, '/meowpay_test');
  const dbName = databaseUrl.split('/').pop();
  const adminUrl = databaseUrl.replace(/\/[^/]+$/, '/postgres');

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${dbName}`);
  } catch (error) {
    if (error.code !== '42P04') {
      // 42P04 = duplicate_database — already exists, fine.
      throw error;
    }
  } finally {
    await client.end();
  }

  // Reuse the exact same migration path as dev/prod, just pointed at the test DB.
  execSync('npx knex --knexfile knexfile.ts migrate:latest', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
};
