import { existsSync, mkdirSync, readdirSync, watch } from 'node:fs';
import { extname, join } from 'node:path';
import type { Inventario } from './contrato.js';
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
