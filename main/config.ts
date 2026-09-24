import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { Config } from './contrato.js';
import type { Registrar } from './log.js';
import { esYouTube } from '../nucleo/youtube.js';

export const CONFIG_POR_DEFECTO: Config = {
  youtubeUrl: null,
  repeticiones: 1,
  volumenVoz: 1,
  volumenMusica: 0.6,
  atenuacionMusica: 0.15,
  segundosBanner: 8,
  pantallaPublica: null,
  recargaDiaria: '04:00',
  mensajes: [
    'Presenta tu ticket al recoger tu pedido.',
    'El café también nos une.',
    'Gracias por ser parte de Troyanos.',
  ],
};

type Validador = (valor: unknown) => boolean;
const fraccion: Validador = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const validadores: { [K in keyof Config]: Validador } = {
  youtubeUrl: (v) => v === null || esYouTube(v),
  repeticiones: (v) => v === 1 || v === 2,
  // Más de 1 amplifica la voz (ganancia de Web Audio); por encima de ~2 puede distorsionar.
  volumenVoz: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 3,
  volumenMusica: fraccion,
  atenuacionMusica: fraccion,
  segundosBanner: (v) => Number.isInteger(v) && (v as number) >= 3 && (v as number) <= 120,
  pantallaPublica: (v) => v === null || Number.isInteger(v),
  recargaDiaria: (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
  mensajes: (v) =>
    Array.isArray(v) &&
    v.length <= 10 &&
    v.every((m) => typeof m === 'string' && m.trim() && m.length <= 160),
};

/** Mezcla con los valores por defecto. Un valor inválido usa el default y se registra. */
export function validarConfig(bruto: unknown, registrar: Registrar = () => {}): Config {
  const entrada =
    bruto && typeof bruto === 'object' && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : {};
  const config = structuredClone(CONFIG_POR_DEFECTO) as unknown as Record<string, unknown>;
  for (const clave of Object.keys(entrada)) {
    if (!(clave in validadores)) {
      registrar(`config.json: se ignora la clave desconocida "${clave}".`);
      continue;
    }
    if (validadores[clave as keyof Config](entrada[clave])) config[clave] = entrada[clave];
    else
      registrar(
        `config.json: valor inválido en "${clave}"; se usa ${JSON.stringify(config[clave])}.`,
      );
  }
  return config as unknown as Config;
}

/** Si config.json falta, se crea con los valores por defecto para que el administrador lo edite. */
export function leerConfig(ruta: string, registrar: Registrar = () => {}): Config {
  if (!existsSync(ruta)) {
    try {
      writeFileSync(ruta, `${JSON.stringify(CONFIG_POR_DEFECTO, null, 2)}\n`);
    } catch (error) {
      registrar(`No se pudo crear config.json: ${(error as Error).message}`);
    }
    return structuredClone(CONFIG_POR_DEFECTO);
  }
  try {
    return validarConfig(JSON.parse(readFileSync(ruta, 'utf8')), registrar);
  } catch (error) {
    registrar(
      `config.json no se pudo leer (${(error as Error).message}); se usan los valores por defecto.`,
    );
    return structuredClone(CONFIG_POR_DEFECTO);
  }
}

/** Vigila config.json. Mientras el archivo es JSON inválido (a media edición) se conserva el anterior. */
export function vigilarConfig(
  ruta: string,
  alCambiar: (config: Config) => void,
  registrar: Registrar = () => {},
): () => void {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let anterior = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
  const vigilante = watch(dirname(ruta), (_evento, archivo) => {
    if (archivo !== basename(ruta)) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      let texto: string;
      try {
        texto = readFileSync(ruta, 'utf8');
      } catch {
        return;
      }
      if (texto === anterior) return;
      let dato: unknown;
      try {
        dato = JSON.parse(texto);
      } catch {
        registrar('config.json tiene JSON inválido; se conserva la configuración anterior.');
        return;
      }
      anterior = texto;
      alCambiar(validarConfig(dato, registrar));
    }, 300);
  });
  return () => {
    clearTimeout(temporizador);
    vigilante.close();
  };
}

/** Milisegundos hasta la próxima ocurrencia de "HH:MM" en hora local. */
export function msHastaHora(hhmm: string, ahora = new Date()): number {
  const [horas, minutos] = hhmm.split(':').map(Number);
  const objetivo = new Date(ahora);
  objetivo.setHours(horas, minutos, 0, 0);
  if (objetivo <= ahora) objetivo.setDate(objetivo.getDate() + 1);
  return objetivo.getTime() - ahora.getTime();
}
