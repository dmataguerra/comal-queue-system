import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, watch } from 'node:fs';
import { basename, extname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import type { CategoriaContenido, Inventario, ResultadoImportacion } from './contrato.js';
import type { Registrar } from './log.js';

export const URL_CONTENIDO = 'turnero://app/contenido';

// Contrato de formatos (arquitectura §11, riesgo 5): MP4 con H.264 y AAC.
const VIDEOS = new Set(['.mp4', '.webm']);
const IMAGENES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VOZ = /^(\d{2})\.wav$/i;

export const TIPOS_MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

function archivos(carpeta: string): string[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta, { withFileTypes: true })
    .filter((entrada) => entrada.isFile() && !entrada.name.startsWith('.'))
    .map((entrada) => entrada.name)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

const url = (base: string, carpeta: string, nombre: string) => `${base}/${carpeta}/${encodeURIComponent(nombre)}`;

const extensiones = (categoria: CategoriaContenido) => categoria === 'videos' ? VIDEOS : IMAGENES;

function nombreDisponible(carpeta: string, nombre: string): string {
  if (!existsSync(join(carpeta, nombre))) return nombre;
  const partes = parse(nombre);
  let indice = 2;
  while (existsSync(join(carpeta, `${partes.name} (${indice})${partes.ext}`))) indice++;
  return `${partes.name} (${indice})${partes.ext}`;
}

/** Copia archivos elegidos por el operador sin sobrescribir contenido existente. */
export function importarArchivos(raiz: string, categoria: CategoriaContenido, origenes: string[], registrar: Registrar = () => {}): ResultadoImportacion {
  const carpeta = join(raiz, categoria);
  mkdirSync(carpeta, { recursive: true });
  const agregados: string[] = [], omitidos: string[] = [];
  for (const origen of origenes) {
    const nombre = basename(origen);
    if (!extensiones(categoria).has(extname(nombre).toLowerCase())) { omitidos.push(nombre); continue; }
    try {
      if (!statSync(origen).isFile()) { omitidos.push(nombre); continue; }
      const destino = nombreDisponible(carpeta, nombre);
      copyFileSync(origen, join(carpeta, destino));
      agregados.push(destino);
    } catch (error) {
      omitidos.push(nombre);
      registrar(`contenido: no se pudo importar ${nombre} (${(error as Error).message})`);
    }
  }
  return { agregados, omitidos, cancelado: false };
}

/** Elimina solamente un archivo que pertenezca al inventario público de video o banner. */
export function quitarArchivo(raiz: string, direccion: string): boolean {
  const inventario = inventariar(raiz);
  if (![...inventario.videos, ...inventario.banner].includes(direccion)) return false;
  let ruta: string;
  try {
    const destino = new URL(direccion);
    if (`${destino.protocol}//${destino.host}` !== 'turnero://app') return false;
    ruta = decodeURIComponent(destino.pathname).replace(/^\/contenido\//, '');
  } catch { return false; }
  const partes = ruta.split('/');
  if (partes.length !== 2 || (partes[0] !== 'videos' && partes[0] !== 'banner')) return false;
  const absoluta = resolve(raiz, partes[0], partes[1]);
  const relativa = relative(raiz, absoluta);
  if (!relativa || relativa.startsWith('..') || isAbsolute(relativa) || !existsSync(absoluta) || !statSync(absoluta).isFile()) return false;
  rmSync(absoluta);
  return true;
}

/**
 * Inventario de la carpeta de contenido. Lo que no se puede reproducir se ignora y se
 * registra una sola vez por archivo (CU-06 1a).
 */
export function inventariar(raiz: string, registrar: Registrar = () => {}, reportados = new Set<string>(), base = URL_CONTENIDO): Inventario {
  for (const carpeta of ['videos', 'banner', 'voz']) mkdirSync(join(raiz, carpeta), { recursive: true });
  const ignorar = (ruta: string) => {
    if (reportados.has(ruta)) return;
    reportados.add(ruta);
    registrar(`contenido: formato no soportado, se ignora ${ruta}`);
  };
  const filtrar = (carpeta: string, permitidas: Set<string>) => archivos(join(raiz, carpeta)).filter((nombre) => {
    if (permitidas.has(extname(nombre).toLowerCase())) return true;
    ignorar(`${carpeta}/${nombre}`);
    return false;
  }).map((nombre) => url(base, carpeta, nombre));

  const voz: (string | null)[] = Array(100).fill(null);
  for (const nombre of archivos(join(raiz, 'voz'))) {
    const coincide = VOZ.exec(nombre);
    if (coincide) voz[Number(coincide[1])] = url(base, 'voz', nombre);
    else ignorar(`voz/${nombre}`);
  }

  return {
    videos: filtrar('videos', VIDEOS),
    banner: filtrar('banner', IMAGENES),
    voz,
    aviso: existsSync(join(raiz, 'aviso.wav')) ? `${base}/aviso.wav` : null,
  };
}

/**
 * Primer arranque: copia el contenido de fábrica (el que el instalador deja junto al .exe) a la
 * carpeta de datos. Si ya existe no se toca: desde ahí es del administrador, y lo que borre no
 * vuelve. Se copia a un temporal y se renombra, para que un corte a medias se reintente completo.
 */
export function sembrarContenido(origen: string, destino: string, registrar: Registrar = () => {}): void {
  if (existsSync(destino) || !existsSync(origen)) return;
  const temporal = `${destino}.tmp`;
  try {
    rmSync(temporal, { recursive: true, force: true });
    cpSync(origen, temporal, { recursive: true });
    renameSync(temporal, destino);
    registrar(`contenido: se copió el contenido de fábrica a ${destino}`);
  } catch (error) {
    registrar(`contenido: no se pudo copiar el contenido de fábrica (${(error as Error).message})`);
  }
}

/** Vigila la carpeta completa: copiar o borrar archivos se refleja sin reiniciar (RF-14). */
export function vigilarContenido(raiz: string, alCambiar: (inventario: Inventario) => void, registrar: Registrar = () => {}): { inicial: Inventario; detener: () => void } {
  const reportados = new Set<string>();
  const inicial = inventariar(raiz, registrar, reportados);
  let ultimo = JSON.stringify(inicial);
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vigilante = watch(raiz, { recursive: true }, () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const inventario = inventariar(raiz, registrar, reportados);
      const texto = JSON.stringify(inventario);
      if (texto === ultimo) return;
      ultimo = texto;
      alCambiar(inventario);
    }, 500);
  });
  return { inicial, detener: () => { clearTimeout(temporizador); vigilante.close(); } };
}
