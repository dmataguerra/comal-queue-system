import type { QueueApi } from '../../shared/contract';
export type QueueTransport = QueueApi;
declare global {
  interface Window {
    turnero?: QueueTransport;
  }
}
export function getQueueTransport(): QueueTransport | undefined {
  return window.turnero;
}
