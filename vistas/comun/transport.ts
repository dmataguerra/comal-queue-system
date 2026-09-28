import type { TurneroApi } from '../../shared/contract';

/** The UI consumes this transport, independent of how Electron implements it. */
export type QueueTransport = TurneroApi;

declare global {
  interface Window {
    turnero?: QueueTransport;
  }
}

export function getQueueTransport(): QueueTransport | undefined {
  return window.turnero;
}
