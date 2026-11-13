import { existsSync, readFileSync, watch } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { Config } from '../shared/contract.js';
import { silentLogger, type Logger } from '../shared/logging.js';
import { isYouTube } from '../core/youtube.js';
import { writeJsonAtomic } from './atomic-write.js';
export const DEFAULT_CONFIG: Config = {
  youtubeUrl: null,
  repeticiones: 1,
  volumenVoz: 1,
  volumenMusica: 0.6,
  atenuacionMusica: 0.15,
  segundosBanner: 8,
  pantallaPublica: null,
  recargaDiaria: '04:00',
  mensajes: ['Presenta tu ticket al recoger tu pedido.', 'Gracias por tu preferencia.'],
};
type Validator = (value: unknown) => boolean;
const fraction: Validator = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const validators: {
  [K in keyof Config]: Validator;
} = {
  youtubeUrl: (v) => v === null || isYouTube(v),
  repeticiones: (v) => v === 1 || v === 2,
  volumenVoz: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 3,
  volumenMusica: fraction,
  atenuacionMusica: fraction,
  segundosBanner: (v) => Number.isInteger(v) && (v as number) >= 3 && (v as number) <= 120,
  pantallaPublica: (v) => v === null || Number.isInteger(v),
  recargaDiaria: (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
  mensajes: (v) =>
    Array.isArray(v) &&
    v.length <= 10 &&
    v.every((m) => typeof m === 'string' && m.trim() && m.length <= 160),
};
export function validateConfig(raw: unknown, logger: Logger = silentLogger): Config {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const config = structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(validators, key)) {
      logger.warn(`config.json: se ignora la clave desconocida "${key}".`);
      continue;
    }
    if (validators[key as keyof Config](input[key])) config[key] = input[key];
    else
      logger.warn(
        `config.json: valor inválido en "${key}"; se usa ${JSON.stringify(config[key])}.`,
      );
  }
  return config as unknown as Config;
}
export function readConfig(filePath: string, logger: Logger = silentLogger): Config {
  if (!existsSync(filePath)) {
    try {
      writeJsonAtomic(filePath, DEFAULT_CONFIG, 2);
    } catch (error) {
      logger.error(`No se pudo crear config.json: ${(error as Error).message}`);
      throw new Error('No se pudo crear config.json en la carpeta de datos.', { cause: error });
    }
    return structuredClone(DEFAULT_CONFIG);
  }
  try {
    return validateConfig(JSON.parse(readFileSync(filePath, 'utf8')), logger);
  } catch (error) {
    logger.warn(
      `config.json no se pudo leer (${(error as Error).message}); se usan los valores por defecto.`,
    );
    return structuredClone(DEFAULT_CONFIG);
  }
}
export function watchConfig(
  filePath: string,
  onChange: (config: Config) => void,
  logger: Logger = silentLogger,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const watcher = watch(dirname(filePath), (_event, file) => {
    if (file !== basename(filePath)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      let text: string;
      try {
        text = readFileSync(filePath, 'utf8');
      } catch {
        return;
      }
      if (text === previous) return;
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        logger.warn('config.json tiene JSON inválido; se conserva la configuración anterior.');
        return;
      }
      previous = text;
      onChange(validateConfig(data, logger));
    }, 300);
  });
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}
export function msUntilTime(hhmm: string, now = new Date()): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}
