import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  watch,
} from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import type { CategoriaContenido, Inventario, ResultadoImportacion } from '../shared/contract.js';
import type { Registrar } from './log.js';

export const URL_CONTENIDO = 'turnero://app/contenido';

// Contrato de formatos (arquitectura §11, riesgo 5): MP4 con H.264 y AAC.
const VIDEOS = new Set(['.mp4', '.webm']);
const IMAGENES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VOZ = /^(\d{2})\.(wav|mp3)$/i;
const EXTENSIONES_AUDIO = ['.mp3', '.wav'] as const;
export const LIMITE_VIDEO = 2 * 1024 ** 3;
export const LIMITE_IMAGEN = 25 * 1024 ** 2;
export const RESERVA_DISCO = 512 * 1024 ** 2;

interface OpcionesImportacion {
  espacioLibre?: (carpeta: string) => number | null;
  copiar?: typeof copyFileSync;
}

const espacioLibre = (carpeta: string): number | null => {
  try {
    const info = statfsSync(carpeta);
    return info.bavail * info.bsize;
  } catch (error) {
    if (['ENOSYS', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? '')) return null;
    throw error;
  }
};

export const TIPOS_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function archivos(carpeta: string): string[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta, { withFileTypes: true })
    .filter((entrada) => entrada.isFile() && !entrada.name.startsWith('.'))
    .map((entrada) => entrada.name)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

const url = (base: string, carpeta: string, nombre: string) =>
  `${base}/${carpeta}/${encodeURIComponent(nombre)}`;

const extensiones = (categoria: CategoriaContenido) => (categoria === 'videos' ? VIDEOS : IMAGENES);

function nombreDisponible(carpeta: string, nombre: string): string {
  if (!existsSync(join(carpeta, nombre))) return nombre;
  const partes = parse(nombre);
  let indice = 2;
  while (existsSync(join(carpeta, `${partes.name} (${indice})${partes.ext}`))) indice++;
  return `${partes.name} (${indice})${partes.ext}`;
}

/** Copia archivos elegidos por el operador sin sobrescribir contenido existente. */
export function importarArchivos(
  raiz: string,
  categoria: CategoriaContenido,
  origenes: string[],
  registrar: Registrar = () => {},
  opciones: OpcionesImportacion = {},
): ResultadoImportacion {
  const carpeta = join(raiz, categoria);
  mkdirSync(carpeta, { recursive: true });
  const agregados: string[] = [],
    omitidos: string[] = [];
  const motivos: Record<string, string> = {};
  const omitir = (nombre: string, motivo: string) => {
    omitidos.push(nombre);
    motivos[nombre] = motivo;
    registrar(`contenido: importación rechazada (${motivo})`);
  };
  for (const origen of origenes) {
    const nombre = basename(origen);
    if (!extensiones(categoria).has(extname(nombre).toLowerCase())) {
      omitir(nombre, `${nombre}: formato no compatible.`);
      continue;
    }
    try {
      const info = statSync(origen);
      if (!info.isFile()) {
        omitir(nombre, `${nombre}: no es un archivo.`);
        continue;
      }
      // Un archivo que aún se descarga puede existir con 0 bytes.
      if (info.size === 0) {
        omitir(nombre, `${nombre}: está vacío.`);
        continue;
      }
      const limite = categoria === 'videos' ? LIMITE_VIDEO : LIMITE_IMAGEN;
      if (info.size > limite) {
        omitir(
          nombre,
          `${nombre}: supera el límite de ${categoria === 'videos' ? '2 GB' : '25 MB'}.`,
        );
        continue;
      }
      const libre = (opciones.espacioLibre ?? espacioLibre)(carpeta);
      if (libre !== null && libre - info.size < RESERVA_DISCO) {
        omitir(nombre, `${nombre}: no hay espacio suficiente en la unidad de datos.`);
        continue;
      }
      const destino = nombreDisponible(carpeta, nombre);
      const temporal = join(carpeta, `.${crypto.randomUUID()}.tmp`);
      try {
        (opciones.copiar ?? copyFileSync)(origen, temporal);
        renameSync(temporal, join(carpeta, destino));
      } finally {
        rmSync(temporal, { force: true });
      }
      agregados.push(destino);
    } catch (error) {
      omitir(
        nombre,
        `${nombre}: no se pudo copiar el archivo. Revise permisos y espacio disponible.`,
      );
      registrar(`contenido: error al copiar ${nombre} (${(error as Error).message})`);
    }
  }
  return { agregados, omitidos, cancelado: false, ...(omitidos.length ? { motivos } : {}) };
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
  } catch {
    return false;
  }
  const partes = ruta.split('/');
  if (partes.length !== 2 || (partes[0] !== 'videos' && partes[0] !== 'banner')) return false;
  const absoluta = resolve(raiz, partes[0], partes[1]);
  const relativa = relative(raiz, absoluta);
  if (
    !relativa ||
    relativa.startsWith('..') ||
    isAbsolute(relativa) ||
    !existsSync(absoluta) ||
    !statSync(absoluta).isFile()
  )
    return false;
  rmSync(absoluta);
  return true;
}

/**
 * Inventario de la carpeta de contenido. Lo que no se puede reproducir se ignora y se
 * registra una sola vez por archivo (CU-06 1a).
 */
export function inventariar(
  raiz: string,
  registrar: Registrar = () => {},
  reportados = new Set<string>(),
  base = URL_CONTENIDO,
): Inventario {
  for (const carpeta of ['videos', 'banner', 'voz'])
    mkdirSync(join(raiz, carpeta), { recursive: true });
  const ignorar = (ruta: string, motivo = 'formato no soportado') => {
    if (reportados.has(ruta)) return;
    reportados.add(ruta);
    registrar(`contenido: ${motivo}, se ignora ${ruta}`);
  };
  const tieneContenido = (ruta: string) => existsSync(ruta) && statSync(ruta).size > 0;
  const filtrar = (carpeta: string, permitidas: Set<string>) =>
    archivos(join(raiz, carpeta))
      .filter((nombre) => {
        if (permitidas.has(extname(nombre).toLowerCase())) return true;
        ignorar(`${carpeta}/${nombre}`);
        return false;
      })
      .map((nombre) => url(base, carpeta, nombre));

  const voz = Array.from({ length: 100 }, (): string | null => null);
  for (const nombre of archivos(join(raiz, 'voz'))) {
    const coincide = VOZ.exec(nombre);
    if (coincide) {
      if (!tieneContenido(join(raiz, 'voz', nombre))) {
        ignorar(`voz/${nombre}`, 'archivo vacío');
        continue;
      }
      const numero = Number(coincide[1]);
      // MP3 permite reemplazar una voz WAV de fábrica sin tener que borrar el original.
      if (!voz[numero] || coincide[2].toLowerCase() === 'mp3')
        voz[numero] = url(base, 'voz', nombre);
    } else ignorar(`voz/${nombre}`);
  }

  const aviso = EXTENSIONES_AUDIO.map((extension) => `aviso${extension}`).find((nombre) =>
    tieneContenido(join(raiz, nombre)),
  );

  return {
    videos: filtrar('videos', VIDEOS),
    banner: filtrar('banner', IMAGENES),
    voz,
    aviso: aviso ? `${base}/${aviso}` : null,
  };
}

/**
 * Primer arranque: copia el contenido de fábrica (el que el instalador deja junto al .exe) a la
 * carpeta de datos. Si ya existe no se toca: desde ahí es del administrador, y lo que borre no
 * vuelve. Se copia a un temporal y se renombra, para que un corte a medias se reintente completo.
 */
export function sembrarContenido(
  origen: string,
  destino: string,
  registrar: Registrar = () => {},
): void {
  if (!existsSync(origen)) return;
  if (existsSync(destino)) {
    repararAudioDeFabrica(origen, destino, registrar);
    return;
  }
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

/** Repone solo audio obligatorio faltante o vacío; respeta MP3 personalizados válidos y multimedia. */
function repararAudioDeFabrica(origen: string, destino: string, registrar: Registrar) {
  const util = (ruta: string) => {
    if (!existsSync(ruta)) return false;
    const info = statSync(ruta);
    return info.isFile() && info.size > 0;
  };
  const reparar = (archivo: string) => {
    const fuente = join(origen, archivo);
    const objetivo = join(destino, archivo);
    if (!util(fuente)) return;
    const temporal = `${objetivo}.${crypto.randomUUID()}.tmp`;
    const copia = `${objetivo}.incompleto-${crypto.randomUUID()}`;
    try {
      mkdirSync(dirname(objetivo), { recursive: true });
      copyFileSync(fuente, temporal);
      if (existsSync(objetivo)) renameSync(objetivo, copia);
      try {
        renameSync(temporal, objetivo);
      } catch (error) {
        if (existsSync(copia)) renameSync(copia, objetivo);
        throw error;
      }
      registrar(
        `contenido: se reparó ${archivo}${existsSync(copia) ? `; archivo vacío conservado en ${copia}` : ''}`,
      );
    } catch (error) {
      registrar(`contenido: no se pudo reparar ${archivo} (${(error as Error).message})`);
    } finally {
      rmSync(temporal, { force: true });
    }
  };
  for (let n = 0; n < 100; n++) {
    const numero = String(n).padStart(2, '0');
    if (EXTENSIONES_AUDIO.some((extension) => util(join(destino, 'voz', `${numero}${extension}`))))
      continue;
    const disponible = EXTENSIONES_AUDIO.map((extension) => `voz/${numero}${extension}`).find(
      (archivo) => util(join(origen, archivo)),
    );
    if (disponible) reparar(disponible);
  }
  if (!EXTENSIONES_AUDIO.some((extension) => util(join(destino, `aviso${extension}`)))) {
    const disponible = EXTENSIONES_AUDIO.map((extension) => `aviso${extension}`).find((archivo) =>
      util(join(origen, archivo)),
    );
    if (disponible) reparar(disponible);
  }
}

/** Vigila la carpeta completa: copiar o borrar archivos se refleja sin reiniciar (RF-14). */
export function vigilarContenido(
  raiz: string,
  alCambiar: (inventario: Inventario) => void,
  registrar: Registrar = () => {},
): { inicial: Inventario; detener: () => void } {
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
  return {
    inicial,
    detener: () => {
      clearTimeout(temporizador);
      vigilante.close();
    },
  };
}
