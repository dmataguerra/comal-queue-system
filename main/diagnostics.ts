import { readFileSync, statfsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, Diagnostics, Inventory, Screens } from '../shared/contract.js';
import type { Store } from './store.js';
import { DISK_RESERVE } from './content.js';
export function availableSpace(folder: string): number | null {
  try {
    const stats = statfsSync(folder);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}
function lastSavedAt(filePath: string): string | null {
  try {
    if (statSync(filePath).size > 1024 * 1024) return null;
    const data: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!data || typeof data !== 'object' || !('guardadoEn' in data)) return null;
    const date = data.guardadoEn;
    return typeof date === 'string' && Number.isFinite(Date.parse(date)) ? date : null;
  } catch {
    return null;
  }
}
interface DiagnosticSources {
  carpetaDatos: string;
  version: string;
  store: Store;
  config: () => Config;
  inventario: () => Inventory;
  pantallas: () => Screens;
  ventanas: () => {
    operador: boolean;
    publica: boolean;
  };
  salud: () => {
    audio: Diagnostics['audio'];
    youtube: Diagnostics['youtube'];
    ultimoErrorAplicacion: string | null;
  };
  espacio?: (folder: string) => number | null;
}
export function createDiagnosticsProvider(sources: DiagnosticSources): () => Diagnostics {
  const safely = <T>(get: () => T, backup: T): T => {
    try {
      return get();
    } catch {
      return backup;
    }
  };
  return () => {
    const inventory = safely(sources.inventario, { videos: [], banner: [], voz: [], aviso: null });
    const screens = safely(sources.pantallas, { publica: 'ninguna' as const });
    const windows = safely(sources.ventanas, { operador: false, publica: false });
    const persistence = safely(() => sources.store.saludPersistencia(), {
      estado: 'error' as const,
      primerFallo: null,
      restauradaEn: null,
      ultimoGuardado: null,
      ultimoError: null,
      ultimoAnuncio: null,
    });
    const state = safely(() => sources.store.obtener(), {
      actual: null,
      llamados: [],
      puedeDeshacer: false,
    });
    const health = safely(sources.salud, {
      audio: 'desconocido' as const,
      youtube: 'inactivo' as const,
      ultimoErrorAplicacion: null,
    });
    const free = safely(() => (sources.espacio ?? availableSpace)(sources.carpetaDatos), null);
    const youtubeConfigured = Boolean(
      safely(sources.config, { youtubeUrl: null } as Config).youtubeUrl,
    );
    return {
      version: sources.version,
      electron: process.versions.electron ?? 'no disponible',
      node: process.versions.node,
      plataforma: process.platform,
      arquitectura: process.arch,
      carpetaDatos: sources.carpetaDatos,
      rutaConfig: join(sources.carpetaDatos, 'config.json'),
      rutaEstado: join(sources.carpetaDatos, 'estado.json'),
      rutaLog: join(sources.carpetaDatos, 'turnero.log'),
      pantalla: screens.publica,
      operadorActivo: windows.operador,
      publicaActiva: windows.publica,
      persistencia: persistence.estado,
      ultimoGuardado:
        persistence.ultimoGuardado ?? lastSavedAt(join(sources.carpetaDatos, 'estado.json')),
      ultimoErrorPersistencia: persistence.ultimoError,
      ultimoErrorAplicacion: health.ultimoErrorAplicacion,
      audio: health.audio,
      youtube: youtubeConfigured ? health.youtube : 'inactivo',
      videosValidos: inventory.videos.length,
      bannersValidos: inventory.banner.length,
      vocesValidas: inventory.voz.filter(Boolean).length,
      ultimoAnuncio: persistence.ultimoAnuncio,
      longitudCola: state.llamados.length + (state.actual === null ? 0 : 1),
      espacioLibre: free,
      espacioBajo: free !== null && free < DISK_RESERVE,
      accionPendiente:
        persistence.estado === 'error' ||
        !windows.publica ||
        health.audio === 'degradado' ||
        (youtubeConfigured && health.youtube === 'no disponible') ||
        (free !== null && free < DISK_RESERVE),
    };
  };
}
