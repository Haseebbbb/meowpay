export type ServiceStatus = 'ok' | 'degraded';

export type DependencyStatus = 'up' | 'down';

export interface HealthStatus {
  status: ServiceStatus;
  uptime: number;
  timestamp: string;
  database: DependencyStatus;
}
