import type { Config, AudioDelivery, Inventory, Screens } from '../../shared/contract.js';
/** Anything that can push state to clients: the IPC adapter and the local web server. */
export interface BroadcastTarget {
  broadcastConfig(config: Config): void;
  broadcastContent(inventory: Inventory): void;
  broadcastScreens(screens: Screens): void;
  broadcastAudioDelivery(delivery: AudioDelivery): void;
}
/**
 * Fan-out hub. Producers hold the hub and transports register when they are ready, so no
 * producer needs a reference to a transport that has not been created yet.
 */
export function createBroadcaster() {
  const targets = new Set<BroadcastTarget>();
  return {
    add(target: BroadcastTarget) {
      targets.add(target);
      return () => {
        targets.delete(target);
      };
    },
    config: (config: Config) => targets.forEach((t) => t.broadcastConfig(config)),
    content: (inventory: Inventory) => targets.forEach((t) => t.broadcastContent(inventory)),
    screens: (screens: Screens) => targets.forEach((t) => t.broadcastScreens(screens)),
    audioDelivery: (delivery: AudioDelivery) =>
      targets.forEach((t) => t.broadcastAudioDelivery(delivery)),
  };
}
export type Broadcaster = ReturnType<typeof createBroadcaster>;
