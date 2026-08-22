import path from 'node:path';
import type { Knex } from 'knex';

import { env } from './env';

// Under ts-node this file is src/config/knex.config.ts; after a build it is
// dist/config/knex.config.js. Resolving relative to __dirname keeps the migration
// directory correct in both cases.
const isTypeScript = __filename.endsWith('.ts');

const config: Knex.Config = {
  client: 'pg',
  connection: env.databaseUrl,
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: path.join(__dirname, '..', 'migrations'),
    tableName: 'knex_migrations',
    extension: 'ts',
    loadExtensions: [isTypeScript ? '.ts' : '.js'],
  },
};

export default config;
