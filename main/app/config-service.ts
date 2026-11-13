import type { Config } from '../../shared/contract.js';
import { AppError } from '../../shared/errors.js';
import type { Logger } from '../../shared/logging.js';
import { leerConfig, vigilarConfig } from '../config.js';
import { escribirJsonAtomico } from '../escritura-atomica.js';
interface ConfigServiceOptions {
  path: string;
  logger: Logger;
  /** Called after the in-memory config changed, with the previous value. */
  onChange: (next: Config, previous: Config) => void;
}
const same = (a: Config, b: Config) => JSON.stringify(a) === JSON.stringify(b);
/**
 * Owns config.json. Writes start from the last validated in-memory config instead of
 * re-reading the file, so a half-edited or invalid file on disk can no longer replace the
 * operator's settings with defaults.
 */
export function createConfigService({ path, logger, onChange }: ConfigServiceOptions) {
  let current = leerConfig(path, logger);
  const apply = (next: Config) => {
    if (same(next, current)) return;
    const previous = current;
    current = next;
    onChange(next, previous);
  };
  // The watcher also fires for our own writes; apply() ignores those because nothing changed.
  const stopWatching = vigilarConfig(path, apply, logger);
  return {
    get: () => current,
    update(patch: Partial<Config>) {
      const next = { ...current, ...patch };
      try {
        escribirJsonAtomico(path, next, 2);
      } catch (error) {
        logger.error(`No se pudo guardar config.json: ${(error as Error).message}`);
        throw new AppError(
          'CONFIG_SAVE_FAILED',
          'No se pudo guardar la configuración. Revise disco y permisos.',
          { cause: error },
        );
      }
      apply(next);
    },
    stop: stopWatching,
  };
}
export type ConfigService = ReturnType<typeof createConfigService>;
