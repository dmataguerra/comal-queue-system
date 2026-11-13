import type { Config, AudioDelivery, Inventory, Screens } from '../../shared/contract.js';
/** Anything that can push state to clients: the IPC adapter and the local web server. */
export interface BroadcastTarget {
  difundirConfig(config: Config): void;
  difundirContenido(inventory: Inventory): void;
  difundirPantallas(screens: Screens): void;
  difundirEntregaAudio(delivery: AudioDelivery): void;
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
    config: (config: Config) => targets.forEach((t) => t.difundirConfig(config)),
    content: (inventory: Inventory) => targets.forEach((t) => t.difundirContenido(inventory)),
    screens: (screens: Screens) => targets.forEach((t) => t.difundirPantallas(screens)),
    audioDelivery: (delivery: AudioDelivery) =>
      targets.forEach((t) => t.difundirEntregaAudio(delivery)),
  };
}
export type Broadcaster = ReturnType<typeof createBroadcaster>;
