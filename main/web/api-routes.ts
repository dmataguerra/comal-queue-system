import {
  validarAccion,
  validarAcuseAudio,
  validarCategoria,
  validarCategoriaOpcional,
  validarUrlContenido,
  validarYouTube,
  validarVolumenes,
  validarMensaje,
  validarNivel,
  validarSalud,
} from '../seguridad-ipc.js';
import type { OpcionesServidor } from './types.js';

/** A POST handler receives the parsed JSON body and returns the JSON response value. */
export type ApiHandler = (dato: unknown) => unknown;

export function createApiRoutes(opciones: OpcionesServidor): Map<string, ApiHandler> {
  return new Map<string, ApiHandler>([
    ['/api/accion', (dato) => opciones.store.despachar(validarAccion(dato))],
    [
      '/api/volumen',
      (dato) => {
        if (!Array.isArray(dato) || dato.length !== 2) throw new Error('Volumen inválido.');
        opciones.configurarVolumen(...validarVolumenes(dato[0], dato[1]));
        return null;
      },
    ],
    [
      '/api/youtube',
      (dato) => {
        if (dato !== null)
          throw new Error(
            'YouTube no está admitido en navegador. Usa la aplicación de escritorio o contenido local.',
          );
        opciones.configurarYouTube(validarYouTube(dato));
        return null;
      },
    ],
    [
      '/api/salud',
      (dato) => {
        if (!Array.isArray(dato) || dato.length !== 2) throw new Error('Salud inválida.');
        opciones.informarSalud(...validarSalud(dato[0], dato[1]));
        return null;
      },
    ],
    [
      '/api/registro',
      (dato) => {
        const [mensaje, nivel] = Array.isArray(dato) ? (dato as unknown[]) : [dato];
        opciones.logger.child('renderer:browser')[validarNivel(nivel)](validarMensaje(mensaje));
        return null;
      },
    ],
    [
      '/api/audio',
      (dato) => {
        opciones.confirmarAnuncio(...validarAcuseAudio(dato));
        return null;
      },
    ],
    ['/api/contenido/importar', (dato) => opciones.importarContenido(validarCategoria(dato))],
    [
      '/api/contenido/quitar',
      (dato) => {
        if (typeof dato !== 'string' || !dato.startsWith('/contenido/'))
          throw new Error('Archivo inválido.');
        return opciones.quitarContenido(validarUrlContenido(`turnero://app${dato}`));
      },
    ],
    [
      '/api/contenido/abrir',
      async (dato) => {
        await opciones.abrirCarpetaContenido(
          validarCategoriaOpcional(dato === null ? undefined : dato),
        );
        return null;
      },
    ],
  ]);
}
