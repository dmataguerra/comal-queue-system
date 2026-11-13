import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { messageLogger } from '../shared/logging.js';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { isPersistedState } from './persistence.js';
import { validateConfig } from './config.js';
import { renameWithRetries } from './atomic-write.js';
const backupItems = [
  'config.json',
  'estado.json',
  'contenido',
  'turnero.log',
  ...Array.from({ length: 5 }, (_, index) => `turnero.log.${index + 1}`),
];
const isInside = (root: string, filePath: string) => {
  const relativePath = relative(root, filePath);
  return (
    !relativePath ||
    (!isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..\\`) &&
      !relativePath.startsWith('../'))
  );
};
export function createBackup(dataDir: string, destination: string, now = new Date()): string {
  const source = resolve(dataDir),
    root = resolve(destination);
  if (isInside(source, root))
    throw new Error('La carpeta de respaldos debe estar fuera de la carpeta de datos.');
  mkdirSync(root, { recursive: true });
  const name = `turnero-${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  const finalPath = join(root, name),
    tempPath = `${finalPath}.tmp`;
  mkdirSync(tempPath);
  try {
    const included: string[] = [];
    for (const item of backupItems) {
      const filePath = join(source, item);
      if (!existsSync(filePath)) continue;
      cpSync(filePath, join(tempPath, item), {
        recursive: true,
        preserveTimestamps: true,
        filter: (file) => !basename(file).endsWith('.tmp'),
      });
      included.push(item);
    }
    if (!included.length) throw new Error('No hay datos para respaldar.');
    writeFileSync(
      join(tempPath, 'manifest.json'),
      `${JSON.stringify({ fecha: now.toISOString(), incluidos: included }, null, 2)}\n`,
    );
    renameWithRetries(tempPath, finalPath);
    return finalPath;
  } catch (error) {
    rmSync(tempPath, { recursive: true, force: true });
    throw new Error(`No se pudo crear el respaldo: ${(error as Error).message}`, { cause: error });
  }
}
export function restoreBackup(
  backup: string,
  dataDir: string,
  confirmAppClosed: boolean,
): string | null {
  if (!confirmAppClosed) throw new Error('Cierre la aplicación antes de restaurar un respaldo.');
  const source = resolve(backup),
    destination = resolve(dataDir);
  if (isInside(source, destination) || isInside(destination, source))
    throw new Error('El respaldo y la carpeta de datos deben estar separados.');
  const manifest: unknown = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
  const included =
    manifest && typeof manifest === 'object' && 'incluidos' in manifest ? manifest.incluidos : null;
  if (
    !Array.isArray(included) ||
    !included.length ||
    !included.every((n: unknown) => typeof n === 'string' && backupItems.includes(n))
  )
    throw new Error('El manifiesto del respaldo no es válido.');
  const names = included as string[];
  for (const name of names)
    if (!existsSync(join(source, name))) throw new Error(`Falta ${name} en el respaldo.`);
  for (const name of ['estado.json', 'config.json']) {
    if (!names.includes(name)) continue;
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(source, name), 'utf8'));
    } catch {
      throw new Error(`${name} del respaldo no es JSON válido. No se restauró.`);
    }
    if (name === 'estado.json' && !isPersistedState(data))
      throw new Error('estado.json del respaldo tiene datos o fechas inválidos. No se restauró.');
    if (name === 'config.json') {
      const errors: string[] = [];
      validateConfig(
        data,
        messageLogger((message) => errors.push(message)),
      );
      if (!data || typeof data !== 'object' || Array.isArray(data) || errors.length)
        throw new Error('config.json del respaldo tiene datos inválidos. No se restauró.');
    }
  }
  const tempPath = join(
    dirname(destination),
    `.${basename(destination)}.restaurar-${crypto.randomUUID()}`,
  );
  const previous = `${destination}.antes-de-restaurar-${crypto.randomUUID()}`;
  mkdirSync(dirname(destination), { recursive: true });
  mkdirSync(tempPath);
  try {
    for (const name of names)
      cpSync(join(source, name), join(tempPath, name), {
        recursive: true,
        preserveTimestamps: true,
      });
    const hadData = existsSync(destination);
    if (hadData) renameWithRetries(destination, previous);
    try {
      renameWithRetries(tempPath, destination);
    } catch (error) {
      if (hadData) renameWithRetries(previous, destination);
      throw error;
    }
    return hadData ? previous : null;
  } catch (error) {
    rmSync(tempPath, { recursive: true, force: true });
    throw new Error(`No se pudo restaurar el respaldo: ${(error as Error).message}`, {
      cause: error,
    });
  }
}
