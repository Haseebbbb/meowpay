import { db } from '../config/database';

/**
 * Data access for health checks. This is the only layer permitted to touch Knex.
 */
export const healthRepository = {
  /**
   * Round-trips a trivial query to prove the connection pool can reach Postgres.
   * Swallows the error deliberately: an unreachable database is a reportable
   * health state, not an exception the caller should handle.
   */
  async checkConnection(): Promise<boolean> {
    try {
      await db.raw('select 1');
      return true;
    } catch (error) {
      console.error('[health] database connectivity check failed:', error);
      return false;
    }
  },
};
