import type { Inventory } from '../../shared/contract.js';

const CONTENT_ORIGIN = 'turnero://app/contenido';

const toBrowserUrl = (url: string | null) => url?.replace(CONTENT_ORIGIN, '/contenido') ?? null;

/** Rewrites the app-protocol content URLs of an inventory into browser-reachable paths. */
export function browserInventory(inventory: Inventory): Inventory {
  return {
    revisionAudio: inventory.revisionAudio,
    videos: inventory.videos.map((url) => toBrowserUrl(url)!),
    banner: inventory.banner.map((url) => toBrowserUrl(url)!),
    voz: inventory.voz.map(toBrowserUrl),
    aviso: toBrowserUrl(inventory.aviso),
  };
}
