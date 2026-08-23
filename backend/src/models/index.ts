// Domain types live here. Knex is a query builder rather than an ORM, so these are
// plain TypeScript interfaces describing table rows and service payloads — there are
// no model classes with behaviour.
//
// Re-export each model from this barrel so consumers can `import { X } from '../models'`.
export * from './health.model';
export * from './cat.model';
export * from './auth.model';
