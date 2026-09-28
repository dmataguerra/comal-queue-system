import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const elementos = [
  'config.json',
  'estado.json',
  'contenido',
  'turnero.log',
  ...Array.from({ length: 5 }, (_, indice) => `turnero.log.${indice + 1}`),
];

/** La carpeta final aparece únicamente cuando todos los archivos se han copiado. */
export function crearRespaldo(datos: string, destino: string, ahora = new Date()): string {
  const origen = resolve(datos),
    raiz = resolve(destino);
  if (raiz === origen || raiz.startsWith(`${origen}\\`) || raiz.startsWith(`${origen}/`))
    throw new Error('La carpeta de respaldos debe estar fuera de la carpeta de datos.');
  mkdirSync(raiz, { recursive: true });
  const nombre = `turnero-${ahora.toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  const final = join(raiz, nombre),
    temporal = `${final}.tmp`;
  mkdirSync(temporal);
  try {
    const incluidos: string[] = [];
    for (const elemento of elementos) {
      const ruta = join(origen, elemento);
      if (!existsSync(ruta)) continue;
      cpSync(ruta, join(temporal, elemento), {
        recursive: true,
        preserveTimestamps: true,
        filter: (archivo) => !basename(archivo).endsWith('.tmp'),
      });
      incluidos.push(elemento);
    }
    if (!incluidos.length) throw new Error('No hay datos para respaldar.');
    writeFileSync(
      join(temporal, 'manifest.json'),
      `${JSON.stringify({ fecha: ahora.toISOString(), incluidos }, null, 2)}\n`,
    );
    renameSync(temporal, final);
    return final;
  } catch (error) {
    rmSync(temporal, { recursive: true, force: true });
    throw new Error(`No se pudo crear el respaldo: ${(error as Error).message}`, { cause: error });
  }
}

/** Solo para uso con la aplicación detenida; conserva los datos anteriores para deshacer. */
export function restaurarRespaldo(
  respaldo: string,
  datos: string,
  confirmarAplicacionCerrada: boolean,
): string | null {
  if (!confirmarAplicacionCerrada)
    throw new Error('Cierre la aplicación antes de restaurar un respaldo.');
  const origen = resolve(respaldo),
    destino = resolve(datos);
  const manifiesto: unknown = JSON.parse(readFileSync(join(origen, 'manifest.json'), 'utf8'));
  const incluidos =
    manifiesto && typeof manifiesto === 'object' && 'incluidos' in manifiesto
      ? manifiesto.incluidos
      : null;
  if (
    !Array.isArray(incluidos) ||
    !incluidos.length ||
    !incluidos.every((n: unknown) => typeof n === 'string' && elementos.includes(n))
  )
    throw new Error('El manifiesto del respaldo no es válido.');
  const nombres = incluidos as string[];
  for (const nombre of nombres)
    if (!existsSync(join(origen, nombre))) throw new Error(`Falta ${nombre} en el respaldo.`);
  const temporal = join(dirname(destino), `.${basename(destino)}.restaurar-${crypto.randomUUID()}`);
  const anterior = `${destino}.antes-de-restaurar-${crypto.randomUUID()}`;
  mkdirSync(temporal);
  try {
    for (const nombre of nombres)
      cpSync(join(origen, nombre), join(temporal, nombre), {
        recursive: true,
        preserveTimestamps: true,
      });
    // No se reemplaza el directorio en uso: el llamador debe haber cerrado Electron.
    const teniaDatos = existsSync(destino);
    if (teniaDatos) renameSync(destino, anterior);
    try {
      renameSync(temporal, destino);
    } catch (error) {
      if (teniaDatos) renameSync(anterior, destino);
      throw error;
    }
    return teniaDatos ? anterior : null;
  } catch (error) {
    rmSync(temporal, { recursive: true, force: true });
    throw new Error(`No se pudo restaurar el respaldo: ${(error as Error).message}`, {
      cause: error,
    });
  }
}
