import { ipcMain, type WebContents } from 'electron';
import type {
  CategoriaContenido,
  Config,
  Diagnostico,
  EntregaAudio,
  Inicial,
  Inventario,
  Pantallas,
  ResultadoImportacion,
} from '../shared/contract.js';
import type { Logger } from '../shared/logging.js';
import type { Store } from './store.js';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';
import { toApiError, type ApiResult } from '../shared/errors.js';
import {
  autorizarIpc,
  validarAccion,
  validarAcuseAudio,
  validarCantidad,
  validarCategoria,
  validarCategoriaOpcional,
  validarMensaje,
  validarNivel,
  validarSalud,
  validarSinArgumentos,
  validarUrlContenido,
  validarVolumen,
  validarVolumenes,
  validarYouTube,
} from './seguridad-ipc.js';
const ORIGENES_YOUTUBE = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'];
import { scriptVolumen } from './volumen-youtube.js';
interface OpcionesIpc {
  configurarVolumen: (voz: number, multimedia: number) => void;
  configurarYouTube: (url: string | null) => void;
  store: Store;
  inicial: () => Inicial;
  esOperador: (remitente: WebContents) => boolean;
  esPublica: (remitente: WebContents) => boolean;
  urlVista: (vista: 'operador' | 'publica') => string;
  destinos: () => WebContents[];
  importarContenido: (categoria: CategoriaContenido) => Promise<ResultadoImportacion>;
  quitarContenido: (url: string) => boolean;
  abrirCarpetaContenido: (categoria?: CategoriaContenido) => Promise<void>;
  abrirManual: () => Promise<void>;
  logger: Logger;
  diagnostico: () => Diagnostico;
  informarSalud: (tipo: 'audio' | 'youtube', estado: 'correcto' | 'degradado') => void;
  confirmarAnuncio: (
    id: number,
    n: number,
    estado: Exclude<EntregaAudio['estado'], 'pendiente'>,
  ) => void;
}
export function conectarIpc({
  store,
  inicial,
  esOperador,
  esPublica,
  urlVista,
  destinos,
  importarContenido,
  quitarContenido,
  abrirCarpetaContenido,
  abrirManual,
  configurarYouTube,
  configurarVolumen,
  logger,
  diagnostico,
  informarSalud,
  confirmarAnuncio,
}: OpcionesIpc) {
  const difundir = (canal: string, ...datos: unknown[]) => {
    for (const destino of destinos()) if (!destino.isDestroyed()) destino.send(canal, ...datos);
  };
  const autorizar = (
    evento: Parameters<typeof autorizarIpc<WebContents>>[0],
    vista: 'operador' | 'publica' | 'cualquiera',
  ) => autorizarIpc(evento, vista, esOperador, esPublica, urlVista);
  type Vista = 'operador' | 'publica' | 'cualquiera';
  /**
   * Registers an invoke channel. Failures are returned as an ApiResult instead of thrown, because
   * Electron flattens thrown errors into a prefixed string and drops their code.
   */
  const atender = (
    canal: string,
    vista: Vista,
    resolver: (argumentos: unknown[], evento: Electron.IpcMainInvokeEvent) => unknown,
  ) =>
    ipcMain.handle(canal, async (evento, ...argumentos: unknown[]): Promise<ApiResult<unknown>> => {
      try {
        autorizar(evento, vista);
        return { ok: true, value: await resolver(argumentos, evento) };
      } catch (error) {
        const fallo = toApiError(error);
        logger.debug('IPC request rejected', {
          channel: canal,
          code: fallo.code,
          reason: fallo.message,
        });
        return { ok: false, error: fallo };
      }
    });
  atender(IPC_CHANNELS.getInitial, 'cualquiera', (argumentos) => {
    validarSinArgumentos(argumentos);
    return inicial();
  });
  atender(IPC_CHANNELS.diagnostics, 'operador', (argumentos) => {
    validarSinArgumentos(argumentos);
    return diagnostico();
  });
  atender(IPC_CHANNELS.openManual, 'operador', (argumentos) => {
    validarSinArgumentos(argumentos);
    return abrirManual();
  });
  ipcMain.on(IPC_CHANNELS.health, (evento, ...argumentos: unknown[]) => {
    try {
      autorizar(evento, 'publica');
      validarCantidad(argumentos, 2);
      const [tipo, estado] = validarSalud(argumentos[0], argumentos[1]);
      informarSalud(tipo, estado);
    } catch {
      /* Se ignora el mensaje si no supera la validación. */
    }
  });
  ipcMain.on(IPC_CHANNELS.audioReceipt, (evento, ...argumentos: unknown[]) => {
    try {
      autorizar(evento, 'publica');
      confirmarAnuncio(...validarAcuseAudio(argumentos));
    } catch {
      /* Se ignora el mensaje si no supera la validación. */
    }
  });
  atender(IPC_CHANNELS.dispatch, 'operador', (argumentos) => {
    validarCantidad(argumentos, 1);
    return store.despachar(validarAccion(argumentos[0]));
  });
  atender(IPC_CHANNELS.setYouTube, 'operador', (argumentos) => {
    validarCantidad(argumentos, 1);
    configurarYouTube(validarYouTube(argumentos[0]));
  });
  atender(IPC_CHANNELS.setVolume, 'operador', (argumentos) => {
    validarCantidad(argumentos, 2);
    configurarVolumen(...validarVolumenes(argumentos[0], argumentos[1]));
  });
  atender(IPC_CHANNELS.importContent, 'operador', (argumentos) => {
    validarCantidad(argumentos, 1);
    return importarContenido(validarCategoria(argumentos[0]));
  });
  atender(IPC_CHANNELS.removeContent, 'operador', (argumentos) => {
    validarCantidad(argumentos, 1);
    return quitarContenido(validarUrlContenido(argumentos[0]));
  });
  atender(IPC_CHANNELS.openContentFolder, 'operador', (argumentos) => {
    validarCantidad(argumentos, 1);
    return abrirCarpetaContenido(validarCategoriaOpcional(argumentos[0]));
  });
  ipcMain.on(IPC_CHANNELS.log, (evento, ...argumentos: unknown[]) => {
    try {
      const vista = autorizar(evento, 'cualquiera');
      if (argumentos.length < 1 || argumentos.length > 2) throw new Error('Argumentos no válidos.');
      const mensaje = validarMensaje(argumentos[0]);
      logger
        .child(vista === 'operador' ? 'renderer:operator' : 'renderer:public')
        [validarNivel(argumentos[1])](mensaje);
    } catch {
      /* Se ignora el mensaje si no supera la validación. */
    }
  });
  let avisoYouTube = '';
  atender(IPC_CHANNELS.setYouTubeVolume, 'publica', async (argumentos, evento) => {
    validarCantidad(argumentos, 2);
    const [volumen, rampa] = validarVolumen(argumentos[0], argumentos[1]);
    const frames = evento.sender.mainFrame.framesInSubtree.filter((frame) =>
      ORIGENES_YOUTUBE.includes(frame.origin),
    );
    const resultados = await Promise.all(
      frames.map((frame) =>
        frame
          .executeJavaScript(scriptVolumen(volumen, rampa))
          .then(
            (r) =>
              r as {
                videos: number;
                sonando: number;
              },
          )
          .catch(() => ({ videos: 0, sonando: 0 })),
      ),
    );
    const videos = resultados.reduce((total, r) => total + r.videos, 0);
    const sonando = resultados.reduce((total, r) => total + r.sonando, 0);
    const aviso =
      frames.length > 1 || sonando > 1
        ? `YouTube duplicado: ${frames.length} iframes, ${videos} videos, ${sonando} sonando.`
        : '';
    if (aviso && aviso !== avisoYouTube) logger.warn(aviso);
    avisoYouTube = aviso;
    return videos;
  });
  store.suscribir((instantanea, anuncio) =>
    difundir(IPC_CHANNELS.stateChanged, instantanea, anuncio),
  );
  return {
    difundirEntregaAudio: (entrega: EntregaAudio) =>
      difundir(IPC_CHANNELS.audioReceiptChanged, entrega),
    difundirConfig: (config: Config) => difundir(IPC_CHANNELS.configChanged, config),
    difundirContenido: (inventario: Inventario) =>
      difundir(IPC_CHANNELS.contentChanged, inventario),
    difundirPantallas: (pantallas: Pantallas) => difundir(IPC_CHANNELS.screensChanged, pantallas),
  };
}
