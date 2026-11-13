import {
  validateAction,
  validateAudioAck,
  validateCategory,
  validateOptionalCategory,
  validateContentUrl,
  validateYouTube,
  validateVolumes,
  validateMessage,
  validateLevel,
  validateHealth,
} from '../ipc-validation.js';
import type { ServerOptions } from './types.js';

/** A POST handler receives the parsed JSON body and returns the JSON response value. */
export type ApiHandler = (data: unknown) => unknown;

export function createApiRoutes(options: ServerOptions): Map<string, ApiHandler> {
  return new Map<string, ApiHandler>([
    ['/api/accion', (data) => options.store.dispatch(validateAction(data))],
    [
      '/api/volumen',
      (data) => {
        if (!Array.isArray(data) || data.length !== 2) throw new Error('Volumen inválido.');
        options.setVolume(...validateVolumes(data[0], data[1]));
        return null;
      },
    ],
    [
      '/api/youtube',
      (data) => {
        if (data !== null)
          throw new Error(
            'YouTube no está admitido en navegador. Usa la aplicación de escritorio o contenido local.',
          );
        options.setYouTube(validateYouTube(data));
        return null;
      },
    ],
    [
      '/api/salud',
      (data) => {
        if (!Array.isArray(data) || data.length !== 2) throw new Error('Salud inválida.');
        options.reportHealth(...validateHealth(data[0], data[1]));
        return null;
      },
    ],
    [
      '/api/registro',
      (data) => {
        const [message, level] = Array.isArray(data) ? (data as unknown[]) : [data];
        options.logger.child('renderer:browser')[validateLevel(level)](validateMessage(message));
        return null;
      },
    ],
    [
      '/api/audio',
      (data) => {
        options.confirmAnnouncement(...validateAudioAck(data));
        return null;
      },
    ],
    ['/api/contenido/importar', (data) => options.importContent(validateCategory(data))],
    [
      '/api/contenido/quitar',
      (data) => {
        if (typeof data !== 'string' || !data.startsWith('/contenido/'))
          throw new Error('Archivo inválido.');
        return options.removeContent(validateContentUrl(`turnero://app${data}`));
      },
    ],
    [
      '/api/contenido/abrir',
      async (data) => {
        await options.openContentFolder(validateOptionalCategory(data === null ? undefined : data));
        return null;
      },
    ],
  ]);
}
