import type { TurneroApi } from '../../shared/contract';
export type QueueTransport = TurneroApi;
declare global {
  interface Window {
    turnero?: QueueTransport;
  }
}
export function getQueueTransport(): QueueTransport | undefined {
  return window.turnero;
}
