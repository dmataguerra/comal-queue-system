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
  dataDir: string;
  version: string;
  store: Store;
  config: () => Config;
  inventory: () => Inventory;
  screens: () => Screens;
  windows: () => {
    operador: boolean;
    publica: boolean;
  };
  health: () => {
    audio: Diagnostics['audio'];
    youtube: Diagnostics['youtube'];
    ultimoErrorAplicacion: string | null;
  };
  freeSpace?: (folder: string) => number | null;
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
    const inventory = safely(sources.inventory, { videos: [], banner: [], voz: [], aviso: null });
    const screens = safely(sources.screens, { publica: 'ninguna' as const });
    const windows = safely(sources.windows, { operador: false, publica: false });
    const persistence = safely(() => sources.store.persistenceHealth(), {
      estado: 'error' as const,
      primerFallo: null,
      restauradaEn: null,
      ultimoGuardado: null,
      ultimoError: null,
      ultimoAnuncio: null,
    });
    const state = safely(() => sources.store.getSnapshot(), {
      actual: null,
      llamados: [],
      puedeDeshacer: false,
    });
    const health = safely(sources.health, {
      audio: 'desconocido' as const,
      youtube: 'inactivo' as const,
      ultimoErrorAplicacion: null,
    });
    const free = safely(() => (sources.freeSpace ?? availableSpace)(sources.dataDir), null);
    const youtubeConfigured = Boolean(
      safely(sources.config, { youtubeUrl: null } as Config).youtubeUrl,
    );
    return {
      version: sources.version,
      electron: process.versions.electron ?? 'no disponible',
      node: process.versions.node,
      plataforma: process.platform,
      arquitectura: process.arch,
      carpetaDatos: sources.dataDir,
      rutaConfig: join(sources.dataDir, 'config.json'),
      rutaEstado: join(sources.dataDir, 'estado.json'),
      rutaLog: join(sources.dataDir, 'turnero.log'),
      pantalla: screens.publica,
      operadorActivo: windows.operador,
      publicaActiva: windows.publica,
      persistencia: persistence.estado,
      ultimoGuardado:
        persistence.ultimoGuardado ?? lastSavedAt(join(sources.dataDir, 'estado.json')),
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
