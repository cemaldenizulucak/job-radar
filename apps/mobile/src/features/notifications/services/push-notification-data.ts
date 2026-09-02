export const JOB_DISCOVERY_PUSH_TYPE = 'JOB_DISCOVERY';
export const JOB_DISCOVERY_PUSH_ROUTE = '/jobs';

export function isJobDiscoveryNotification(data: unknown): boolean {
  return isRecord(data) && data.type === JOB_DISCOVERY_PUSH_TYPE;
}

export function jobDiscoveryNotificationRoute(data: unknown): '/jobs' | null {
  if (!isJobDiscoveryNotification(data) || !isRecord(data)) {
    return null;
  }

  return data.route === JOB_DISCOVERY_PUSH_ROUTE || typeof data.route !== 'string'
    ? JOB_DISCOVERY_PUSH_ROUTE
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
