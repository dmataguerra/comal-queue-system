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
export function resolveDataDir(options: {
  personalizada?: string;
  empaquetada: boolean;
  perfil: string;
  raiz: string;
}): string {
  if (options.personalizada) return resolve(options.personalizada);
  return options.empaquetada ? join(options.perfil, 'datos') : options.raiz;
}
export function migrateDocumentsData(source: string, destination: string): boolean {
  if (existsSync(destination)) return false;
  let names: string[];
  try {
    names = readdirSync(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new Error(
      `No se pudieron leer los datos anteriores en ${source}. No se iniciará una jornada vacía.`,
      { cause: error },
    );
  }
  const known = names.filter((name) =>
    ['config.json', 'estado.json', 'contenido', 'turnero.log'].includes(name),
  );
  if (!known.length) return false;
  mkdirSync(dirname(destination), { recursive: true });
  const tempPath = mkdtempSync(join(dirname(destination), '.migracion-documentos-'));
  try {
    for (const name of known) {
      cpSync(join(source, name), join(tempPath, name), {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: (filePath) => {
          if (lstatSync(filePath).isSymbolicLink())
            throw new Error(`La migración requiere revisar el enlace: ${filePath}`);
          return true;
        },
      });
    }
    renameSync(tempPath, destination);
    return true;
  } catch (error) {
    throw new Error(
      `No se pudo copiar ${source} a ${destination}. Los datos originales se conservan; revise permisos, espacio y disponibilidad de archivos de OneDrive.`,
      { cause: error },
    );
  } finally {
    if (dirname(tempPath) === dirname(destination))
      rmSync(tempPath, { recursive: true, force: true });
  }
}
