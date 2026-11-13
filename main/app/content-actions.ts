import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentCategory, ImportResult } from '../../shared/contract.js';
import { AppError } from '../../shared/errors.js';
import type { Logger } from '../../shared/logging.js';
import { importFiles, removeFile } from '../content.js';
interface ContentActionsOptions {
  contentDir: string;
  logger: Logger;
  /** Shows the native file picker; resolves to the chosen paths or null when cancelled. */
  pickFiles: (options: {
    title: string;
    filterName: string;
    extensions: string[];
  }) => Promise<string[] | null>;
  /** Opens a folder in the OS file manager; resolves to an error text or ''. */
  openPath: (path: string) => Promise<string>;
}
/** Operator-triggered content operations, shared by the IPC adapter and the web server. */
export function createContentActions({
  contentDir,
  logger,
  pickFiles,
  openPath,
}: ContentActionsOptions) {
  return {
    async importContent(category: ContentCategory): Promise<ImportResult> {
      const videos = category === 'videos';
      const files = await pickFiles({
        title: videos ? 'Agregar videos a la pantalla 2' : 'Agregar imágenes a la pantalla 2',
        filterName: videos ? 'Videos compatibles' : 'Imágenes compatibles',
        extensions: videos ? ['mp4', 'webm'] : ['jpg', 'jpeg', 'png', 'webp'],
      });
      if (!files) return { agregados: [], omitidos: [], cancelado: true };
      const result = await importFiles(contentDir, category, files, logger);
      if (result.agregados.length)
        logger.info(`contenido: se importaron ${result.agregados.join(', ')}`);
      return result;
    },
    removeContent(url: string): boolean {
      const removed = removeFile(contentDir, url);
      if (removed)
        logger.info(`contenido: se eliminó ${decodeURIComponent(url.split('/').pop() ?? url)}`);
      return removed;
    },
    async openContentFolder(category?: ContentCategory): Promise<void> {
      const folder = join(contentDir, category ?? '');
      mkdirSync(folder, { recursive: true });
      const failure = await openPath(folder);
      if (failure)
        throw new AppError(
          'CONTENT_FOLDER_UNAVAILABLE',
          `No se pudo abrir la carpeta de multimedia: ${failure}`,
        );
    },
  };
}
