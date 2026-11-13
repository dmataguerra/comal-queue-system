import type { Inventario } from '../../shared/contract.js';

const CONTENT_ORIGIN = 'turnero://app/contenido';

const toBrowserUrl = (url: string | null) => url?.replace(CONTENT_ORIGIN, '/contenido') ?? null;

/** Rewrites the app-protocol content URLs of an inventory into browser-reachable paths. */
export function browserInventory(inventario: Inventario): Inventario {
  return {
    revisionAudio: inventario.revisionAudio,
    videos: inventario.videos.map((url) => toBrowserUrl(url)!),
    banner: inventario.banner.map((url) => toBrowserUrl(url)!),
    voz: inventario.voz.map(toBrowserUrl),
    aviso: toBrowserUrl(inventario.aviso),
  };
}
