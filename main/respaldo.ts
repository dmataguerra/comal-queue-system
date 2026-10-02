import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { esEstadoPersistido } from './persistencia.js';
import { validarConfig } from './config.js';
import { renombrarConReintentos } from './escritura-atomica.js';

const elementos = [
  'config.json',
  'estado.json',
  'contenido',
  'turnero.log',
  ...Array.from({ length: 5 }, (_, indice) => `turnero.log.${indice + 1}`),
];

const dentroDe = (raiz: string, ruta: string) => {
  const diferencia = relative(raiz, ruta);
  return (
    !diferencia ||
    (!isAbsolute(diferencia) &&
      diferencia !== '..' &&
      !diferencia.startsWith(`..\\`) &&
      !diferencia.startsWith('../'))
  );
};

/** La carpeta final aparece únicamente cuando todos los archivos se han copiado. */
export function crearRespaldo(datos: string, destino: string, ahora = new Date()): string {
  const origen = resolve(datos),
    raiz = resolve(destino);
  if (dentroDe(origen, raiz))
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
    renombrarConReintentos(temporal, final);
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
  if (dentroDe(origen, destino) || dentroDe(destino, origen))
    throw new Error('El respaldo y la carpeta de datos deben estar separados.');
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
  // Validar antes de preparar/reemplazar el destino: nunca convertir corrupción en jornada vacía.
  for (const nombre of ['estado.json', 'config.json']) {
    if (!nombres.includes(nombre)) continue;
    let dato: unknown;
    try {
      dato = JSON.parse(readFileSync(join(origen, nombre), 'utf8'));
    } catch {
      throw new Error(`${nombre} del respaldo no es JSON válido. No se restauró.`);
    }
    if (nombre === 'estado.json' && !esEstadoPersistido(dato))
      throw new Error('estado.json del respaldo tiene datos o fechas inválidos. No se restauró.');
    if (nombre === 'config.json') {
      const errores: string[] = [];
      validarConfig(dato, (mensaje) => errores.push(mensaje));
      if (!dato || typeof dato !== 'object' || Array.isArray(dato) || errores.length)
        throw new Error('config.json del respaldo tiene datos inválidos. No se restauró.');
    }
  }
  const temporal = join(dirname(destino), `.${basename(destino)}.restaurar-${crypto.randomUUID()}`);
  const anterior = `${destino}.antes-de-restaurar-${crypto.randomUUID()}`;
  mkdirSync(dirname(destino), { recursive: true });
  mkdirSync(temporal);
  try {
    for (const nombre of nombres)
      cpSync(join(origen, nombre), join(temporal, nombre), {
        recursive: true,
        preserveTimestamps: true,
      });
    // No se reemplaza el directorio en uso: el llamador debe haber cerrado Electron.
    const teniaDatos = existsSync(destino);
    if (teniaDatos) renombrarConReintentos(destino, anterior);
    try {
      renombrarConReintentos(temporal, destino);
    } catch (error) {
      if (teniaDatos) renombrarConReintentos(anterior, destino);
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
