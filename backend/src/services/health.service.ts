import type { HealthStatus } from '../models';
import { healthRepository } from '../repositories/health.repository';

/**
 * Business rules for reporting service health. Knows nothing about HTTP —
 * it returns a plain object and lets the controller decide the status code.
 */
export const healthService = {
  async getHealth(): Promise<HealthStatus> {
    const databaseReachable = await healthRepository.checkConnection();

    return {
      status: databaseReachable ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: databaseReachable ? 'up' : 'down',
    };
  },
};
