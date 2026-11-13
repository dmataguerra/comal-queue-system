import type { Config, EntregaAudio, Inventario, Pantallas } from '../../shared/contract.js';
/** Anything that can push state to clients: the IPC adapter and the local web server. */
export interface BroadcastTarget {
  difundirConfig(config: Config): void;
  difundirContenido(inventario: Inventario): void;
  difundirPantallas(pantallas: Pantallas): void;
  difundirEntregaAudio(entrega: EntregaAudio): void;
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
    content: (inventario: Inventario) => targets.forEach((t) => t.difundirContenido(inventario)),
    screens: (pantallas: Pantallas) => targets.forEach((t) => t.difundirPantallas(pantallas)),
    audioDelivery: (entrega: EntregaAudio) =>
      targets.forEach((t) => t.difundirEntregaAudio(entrega)),
  };
}
export type Broadcaster = ReturnType<typeof createBroadcaster>;
