import { constants, copyFileSync, readFileSync } from 'node:fs';
import { ESTADO_INICIAL, MAX_LLAMADOS, enPantalla, type Estado } from '../nucleo/turnos.js';
import { escribirJsonAtomico } from './escritura-atomica.js';
import { silentLogger, type Logger } from '../shared/logging.js';
export interface Persistido {
  fecha: string;
  actual: number | null;
  llamados: number[];
  desde?: Record<string, string>;
  guardadoEn: string;
}
export interface Cargado {
  estado: Estado;
  desde: Map<number, number>;
  advertencia?: string;
}
const vacio = (advertencia?: string): Cargado => ({
  estado: ESTADO_INICIAL,
  desde: new Map(),
  ...(advertencia ? { advertencia } : {}),
});
export function fechaLocal(fecha = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
const esTurno = (x: unknown): x is number =>
  Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 99;
const esFechaIso = (valor: unknown) =>
  typeof valor === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(valor) &&
  Number.isFinite(Date.parse(valor)) &&
  new Date(valor).toISOString() === valor;
function valido(dato: unknown): dato is Persistido {
  if (!dato || typeof dato !== 'object') return false;
  const { fecha, actual, llamados, desde } = dato as Record<string, unknown>;
  return (
    typeof fecha === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(fecha) &&
    esFechaIso(`${fecha}T00:00:00.000Z`) &&
    (desde === undefined || (!!desde && typeof desde === 'object' && !Array.isArray(desde))) &&
    (actual === null || esTurno(actual)) &&
    Array.isArray(llamados) &&
    llamados.length <= MAX_LLAMADOS &&
    llamados.every(esTurno) &&
    new Set(llamados).size === llamados.length &&
    (actual === null || !llamados.includes(actual))
  );
}
function timestampsValidos(dato: Persistido): boolean {
  return (
    esFechaIso(dato.guardadoEn) &&
    (dato.desde === undefined || Object.values(dato.desde).every(esFechaIso))
  );
}
export function esEstadoPersistido(dato: unknown): dato is Persistido {
  return valido(dato) && timestampsValidos(dato);
}
function preservarCorrupto(ruta: string, motivo: string, logger: Logger): void {
  const copia = `${ruta}.corrupto-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  try {
    copyFileSync(ruta, copia, constants.COPYFILE_EXCL);
    logger.warn(`estado.json ${motivo}; copia diagnóstica en ${copia}; se arranca vacío.`);
  } catch (error) {
    logger.warn(
      `estado.json ${motivo}; no se pudo crear copia diagnóstica: ${(error as Error).message}; se arranca vacío.`,
    );
  }
}
export function leerEstado(ruta: string, hoy: string, logger: Logger = silentLogger): Cargado {
  let texto: string;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return vacio();
    logger.error(`No se pudo leer estado.json: ${(error as Error).message}`);
    throw error;
  }
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    preservarCorrupto(ruta, 'no es JSON válido', logger);
    return vacio(
      'El estado guardado estaba dañado. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (!valido(dato)) {
    preservarCorrupto(ruta, 'tiene una forma inválida', logger);
    return vacio(
      'El estado guardado tenía datos inválidos. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (!timestampsValidos(dato)) {
    preservarCorrupto(ruta, 'tiene timestamps inválidos', logger);
    return vacio(
      'El estado guardado tenía fechas inválidas. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (dato.fecha !== hoy) {
    logger.info(`estado.json pertenece a ${dato.fecha}; se inicia la jornada ${hoy} vacía.`);
    return vacio();
  }
  const estado: Estado = { actual: dato.actual, llamados: dato.llamados, deshacer: null };
  const hora = (valor: unknown) => (typeof valor === 'string' ? Date.parse(valor) : NaN);
  const respaldo = hora(dato.guardadoEn);
  const desde = new Map<number, number>();
  for (const n of enPantalla(estado)) {
    const t = hora(dato.desde?.[n]);
    if (!Number.isNaN(t)) desde.set(n, t);
    else if (!Number.isNaN(respaldo)) desde.set(n, respaldo);
  }
  return { estado, desde };
}
export function guardarEstado(
  ruta: string,
  estado: Estado,
  fecha: string,
  desde: ReadonlyMap<number, number> = new Map(),
  ahora = new Date(),
): void {
  const dato: Persistido = {
    fecha,
    actual: estado.actual,
    llamados: estado.llamados,
    desde: Object.fromEntries([...desde].map(([n, t]) => [n, new Date(t).toISOString()])),
    guardadoEn: ahora.toISOString(),
  };
  escribirJsonAtomico(ruta, dato);
}
