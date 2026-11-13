import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CONFIG, validateConfig } from './config.js';
import { writeJsonAtomic } from './atomic-write.js';
import { localDate } from './persistence.js';
import { silentLogger, type Logger } from '../shared/logging.js';
import { isYouTube } from '../core/youtube.js';
export function migrateFrom02(
  legacyBase: string,
  dataDir: string,
  logger: Logger = silentLogger,
  now = new Date(),
): boolean {
  const statePath = join(dataDir, 'estado.json');
  const configPath = join(dataDir, 'config.json');
  if (!existsSync(legacyBase) || existsSync(statePath)) return false;
  const db = new DatabaseSync(legacyBase, { readOnly: true });
  try {
    const rows = db
      .prepare(
        "SELECT number, last_announced_at AS fecha FROM turns WHERE status = 'ready' ORDER BY rank DESC",
      )
      .all() as {
      number: string;
      fecha: string;
    }[];
    const today = localDate(now);
    const seen = new Set<number>();
    const activeRows = rows
      .filter((row) => {
        const turnNumber = Number(row.number);
        if (!/^\d{2}$/.test(row.number) || turnNumber > 99 || seen.has(turnNumber)) return false;
        const date = new Date(row.fecha);
        if (!Number.isFinite(date.getTime()) || localDate(date) !== today) return false;
        seen.add(turnNumber);
        return true;
      })
      .slice(0, 6);
    if (!existsSync(configPath)) {
      const configRows = db
        .prepare("SELECT key, value FROM configuration WHERE key IN ('settings', 'multimedia')")
        .all() as {
        key: string;
        value: string;
      }[];
      const previous = Object.fromEntries(
        configRows.map((row) => [row.key, JSON.parse(row.value)]),
      );
      const settings = previous.settings as
        | {
            footerMessages?: unknown;
          }
        | undefined;
      const media = previous.multimedia as
        | {
            type?: unknown;
            url?: unknown;
          }
        | undefined;
      const config = validateConfig(
        {
          ...DEFAULT_CONFIG,
          ...(settings?.footerMessages ? { mensajes: settings.footerMessages } : {}),
          ...(media?.type === 'youtube' && isYouTube(media.url) ? { youtubeUrl: media.url } : {}),
        },
        logger,
      );
      writeJsonAtomic(configPath, config, 2);
    }
    const numbers = activeRows.map((row) => Number(row.number));
    const state = {
      fecha: today,
      actual: numbers[0] ?? null,
      llamados: numbers.slice(1),
      desde: Object.fromEntries(activeRows.map((row) => [Number(row.number), now.toISOString()])),
      guardadoEn: now.toISOString(),
    };
    writeJsonAtomic(statePath, state);
    logger.info(
      `Se migró 0.2.0: ${activeRows.length} turnos vigentes a ${statePath}. La base anterior permanece en ${legacyBase}.`,
    );
    return true;
  } catch (error) {
    logger.error(`No se pudo migrar 0.2.0 desde ${legacyBase}: ${(error as Error).message}`);
    throw new Error('No se pudo migrar la base de 0.2.0. La base anterior no se modificó.', {
      cause: error,
    });
  } finally {
    db.close();
  }
}
