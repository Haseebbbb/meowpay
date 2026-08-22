import type { Knex } from 'knex';

// Fixed, recognizable UUIDs so the seed rows are easy to reference in the README
// and in manual testing — not required by the schema, just a dev convenience.
const DUMMY_CATS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Whiskers',
    email: 'whiskers@meowpay.dev',
    password_hash: 'dummy-hash-not-for-production-use',
    balance: 10000,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Mittens',
    email: 'mittens@meowpay.dev',
    password_hash: 'dummy-hash-not-for-production-use',
    balance: 5000,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Tom',
    email: 'tom@meowpay.dev',
    password_hash: 'dummy-hash-not-for-production-use',
    balance: 0,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Garfield',
    email: 'garfield@meowpay.dev',
    password_hash: 'dummy-hash-not-for-production-use',
    balance: 25000,
  },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cats', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.integer('balance').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enu('type', ['TOPUP', 'TRANSFER'], { useNative: false, enumName: 'transaction_type' }).notNullable();
    // One ledger row per affected cat: a TRANSFER writes two rows (outgoing for the
    // sender, incoming for the receiver) so direction is read directly off the row
    // instead of inferred from `type` + which of from/to is null.
    table.uuid('cat_id').notNullable().references('id').inTable('cats');
    table.enu('direction', ['incoming', 'outgoing'], { useNative: false, enumName: 'transaction_direction' }).notNullable();
    // Null for TOPUP rows — money originates outside the system, there's no other cat.
    table.uuid('counterparty_cat_id').nullable().references('id').inTable('cats');
    table.integer('amount').notNullable();
    table.enu('status', ['completed', 'failed'], { useNative: false, enumName: 'transaction_status' }).notNullable();
    // Both sibling rows of a TRANSFER share one idempotency_key, so it can't be
    // unique alone — (idempotency_key, direction) is unique instead: a genuine
    // retry (same key, same direction) still collides, but the incoming/outgoing
    // pair of one transfer doesn't.
    table.string('idempotency_key').notNullable();
    table.timestamps(true, true);

    table.unique(['idempotency_key', 'direction']);
    table.index('cat_id');
    table.index('counterparty_cat_id');
  });

  await knex('cats').insert(DUMMY_CATS);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('cats');
}
