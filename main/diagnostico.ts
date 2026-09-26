import { readFileSync, statfsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, Diagnostico, Inventario, Pantallas } from '../shared/contract.js';
import type { Store } from './store.js';
import { RESERVA_DISCO } from './contenido.js';

export function espacioDisponible(carpeta: string): number | null {
  try {
    const datos = statfsSync(carpeta);
    return datos.bavail * datos.bsize;
  } catch {
    return null;
  }
}

function ultimoGuardadoArchivo(ruta: string): string | null {
  try {
    if (statSync(ruta).size > 1024 * 1024) return null;
    const dato: unknown = JSON.parse(readFileSync(ruta, 'utf8'));
    if (!dato || typeof dato !== 'object' || !('guardadoEn' in dato)) return null;
    const fecha = dato.guardadoEn;
    return typeof fecha === 'string' && Number.isFinite(Date.parse(fecha)) ? fecha : null;
  } catch {
    return null;
  }
}

interface FuentesDiagnostico {
  carpetaDatos: string;
  version: string;
  store: Store;
  config: () => Config;
  inventario: () => Inventario;
  pantallas: () => Pantallas;
  ventanas: () => { operador: boolean; publica: boolean };
  salud: () => {
    audio: Diagnostico['audio'];
    youtube: Diagnostico['youtube'];
    ultimoErrorAplicacion: string | null;
  };
  espacio?: (carpeta: string) => number | null;
}

/** Cada fuente se lee por separado: un inventario o comprobación de disco fallidos no ocultan el resto. */
export function crearProveedorDiagnostico(fuentes: FuentesDiagnostico): () => Diagnostico {
  const seguro = <T>(obtener: () => T, respaldo: T): T => {
    try {
      return obtener();
    } catch {
      return respaldo;
    }
  };
  return () => {
    const inventario = seguro(fuentes.inventario, { videos: [], banner: [], voz: [], aviso: null });
    const pantallas = seguro(fuentes.pantallas, { publica: 'ninguna' as const });
    const ventanas = seguro(fuentes.ventanas, { operador: false, publica: false });
    const persistencia = seguro(() => fuentes.store.saludPersistencia(), {
      estado: 'error' as const,
      primerFallo: null,
      restauradaEn: null,
      ultimoGuardado: null,
      ultimoError: null,
      ultimoAnuncio: null,
    });
    const estado = seguro(() => fuentes.store.obtener(), {
      actual: null,
      llamados: [],
      puedeDeshacer: false,
    });
    const salud = seguro(fuentes.salud, {
      audio: 'desconocido' as const,
      youtube: 'inactivo' as const,
      ultimoErrorAplicacion: null,
    });
    const libre = seguro(() => (fuentes.espacio ?? espacioDisponible)(fuentes.carpetaDatos), null);
    const youtubeConfigurado = Boolean(
      seguro(fuentes.config, { youtubeUrl: null } as Config).youtubeUrl,
    );
    return {
      version: fuentes.version,
      electron: process.versions.electron ?? 'no disponible',
      node: process.versions.node,
      plataforma: process.platform,
      arquitectura: process.arch,
      carpetaDatos: fuentes.carpetaDatos,
      rutaConfig: join(fuentes.carpetaDatos, 'config.json'),
      rutaEstado: join(fuentes.carpetaDatos, 'estado.json'),
      rutaLog: join(fuentes.carpetaDatos, 'turnero.log'),
      pantalla: pantallas.publica,
      operadorActivo: ventanas.operador,
      publicaActiva: ventanas.publica,
      persistencia: persistencia.estado,
      ultimoGuardado:
        persistencia.ultimoGuardado ??
        ultimoGuardadoArchivo(join(fuentes.carpetaDatos, 'estado.json')),
      ultimoErrorPersistencia: persistencia.ultimoError,
      ultimoErrorAplicacion: salud.ultimoErrorAplicacion,
      audio: salud.audio,
      youtube: youtubeConfigurado ? salud.youtube : 'inactivo',
      videosValidos: inventario.videos.length,
      bannersValidos: inventario.banner.length,
      vocesValidas: inventario.voz.filter(Boolean).length,
      ultimoAnuncio: persistencia.ultimoAnuncio,
      longitudCola: estado.llamados.length + (estado.actual === null ? 0 : 1),
      espacioLibre: libre,
      espacioBajo: libre !== null && libre < RESERVA_DISCO,
      accionPendiente:
        persistencia.estado === 'error' ||
        !ventanas.publica ||
        salud.audio === 'degradado' ||
        (youtubeConfigurado && salud.youtube === 'no disponible') ||
        (libre !== null && libre < RESERVA_DISCO),
    };
  };
}
