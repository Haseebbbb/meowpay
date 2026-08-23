// Postgres error SQLSTATE codes the app checks for. Not transaction-domain
// specific — any repository racing a unique constraint can reuse this.
export const POSTGRES_ERROR_CODE = {
  UNIQUE_VIOLATION: '23505',
} as const;
