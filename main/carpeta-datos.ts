import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function resolverCarpetaDatos(opciones: {
  personalizada?: string;
  empaquetada: boolean;
  perfil: string;
  raiz: string;
}): string {
  if (opciones.personalizada) return resolve(opciones.personalizada);
  return opciones.empaquetada ? join(opciones.perfil, 'datos') : opciones.raiz;
}

/** Copia una sola vez, sin escribir en Documentos ni publicar una copia incompleta. */
export function migrarDatosDocumentos(origen: string, destino: string): boolean {
  if (existsSync(destino)) return false;
  let nombres: string[];
  try {
    nombres = readdirSync(origen);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new Error(
      `No se pudieron leer los datos anteriores en ${origen}. No se iniciará una jornada vacía.`,
      { cause: error },
    );
  }
  const conocidos = nombres.filter((nombre) =>
    ['config.json', 'estado.json', 'contenido', 'turnero.log'].includes(nombre),
  );
  if (!conocidos.length) return false;
  mkdirSync(dirname(destino), { recursive: true });
  const temporal = mkdtempSync(join(dirname(destino), '.migracion-documentos-'));
  try {
    for (const nombre of conocidos) {
      cpSync(join(origen, nombre), join(temporal, nombre), {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: (ruta) => {
          if (lstatSync(ruta).isSymbolicLink())
            throw new Error(`La migración requiere revisar el enlace: ${ruta}`);
          return true;
        },
      });
    }
    renameSync(temporal, destino);
    return true;
  } catch (error) {
    throw new Error(
      `No se pudo copiar ${origen} a ${destino}. Los datos originales se conservan; revise permisos, espacio y disponibilidad de archivos de OneDrive.`,
      { cause: error },
    );
  } finally {
    // Solo se elimina el directorio temporal creado por esta invocación.
    if (dirname(temporal) === dirname(destino)) rmSync(temporal, { recursive: true, force: true });
  }
}
