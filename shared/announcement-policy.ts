export const MAX_ANNOUNCEMENTS = 6;
export const MAX_ANNOUNCEMENT_WAIT_MS = 45000;
export const MAX_ANNOUNCEMENT_DURATION_MS = 30000;
export const MAX_ANNOUNCEMENT_HISTORY = 100;
import type { AudioDelivery } from './contract.js';
export function latestDeliveries(deliveries: AudioDelivery[]): AudioDelivery[] {
  const byNumber = new Map<number, AudioDelivery>();
  for (const delivery of deliveries) {
    if ((byNumber.get(delivery.n)?.id ?? -1) < delivery.id) byNumber.set(delivery.n, delivery);
  }
  return [...byNumber.values()];
}
