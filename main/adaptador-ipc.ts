import { ipcMain, type WebContents } from 'electron';
import type {
  Accion,
  CategoriaContenido,
  Config,
  Inicial,
  Inventario,
  Pantallas,
  ResultadoImportacion,
} from './contrato.js';
import type { Registrar } from './log.js';
import type { Store } from './store.js';
import { esYouTube } from '../nucleo/youtube.js';

// Los mismos nombres están escritos en preload.cts: el preload aislado no puede importar módulos.
export const CANALES = {
  obtener: 'turnero:obtener',
  despachar: 'turnero:despachar',
  registrar: 'turnero:registrar',
  estado: 'turnero:estado',
  config: 'turnero:config',
  contenido: 'turnero:contenido',
  importarContenido: 'turnero:contenido:importar',
  quitarContenido: 'turnero:contenido:quitar',
  abrirCarpetaContenido: 'turnero:contenido:abrir',
  pantallas: 'turnero:pantallas',
  volumenYouTube: 'turnero:youtube:volumen',
} as const;

const ORIGENES_YOUTUBE = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'];

/**
 * RF-11 · el IFrame API habla por postMessage y YouTube no acepta el origen turnero://, así que
 * setVolume se pierde. Desde main se entra al iframe y se mueve el volumen del <video> con la misma
 * rampa que los videos locales. No toca muted ni paused: la pausa o el mute del usuario se respetan.
 */
const scriptVolumen = (volumen: number, rampa: number) => `(() => {
  const destino = ${volumen}, ms = ${rampa};
  const id = (window.__turneroRampa = (window.__turneroRampa || 0) + 1);
  const videos = [...document.querySelectorAll('video')];
  for (const video of videos) {
    const desde = video.volume, inicio = performance.now();
    const paso = (ahora) => {
      if (window.__turneroRampa !== id) return;
      const t = ms ? Math.min(1, (ahora - inicio) / ms) : 1;
      video.volume = desde + (destino - desde) * t;
      if (t < 1) requestAnimationFrame(paso);
    };
    paso(inicio);
  }
  return {
    videos: videos.length,
    sonando: videos.filter((v) => !v.paused && !v.muted && v.volume > 0).length,
  };
})()`;

interface OpcionesIpc {
  configurarYouTube: (url: string | null) => void;
  store: Store;
  inicial: () => Inicial;
  esOperador: (remitente: WebContents) => boolean;
  destinos: () => WebContents[];
  importarContenido: (categoria: CategoriaContenido) => Promise<ResultadoImportacion>;
  quitarContenido: (url: string) => boolean;
  abrirCarpetaContenido: (categoria?: CategoriaContenido) => Promise<void>;
  registrar: Registrar;
}

function validarAccion(accion: unknown): Accion {
  const valor = accion as Partial<Record<string, unknown>> | null;
  if (valor?.tipo === 'DESHACER') return { tipo: 'DESHACER' };
  if (valor?.tipo === 'LLAMAR' && typeof valor.entrada === 'string' && valor.entrada.length <= 32) {
    return { tipo: 'LLAMAR', entrada: valor.entrada };
  }
  // QUITAR llega desde una fila ya en pantalla, así que el número siempre es de dos dígitos.
  if (
    valor?.tipo === 'QUITAR' &&
    Number.isInteger(valor.n) &&
    (valor.n as number) >= 0 &&
    (valor.n as number) <= 99
  ) {
    return { tipo: 'QUITAR', n: valor.n as number };
  }
  throw new Error('Acción no válida.');
}

/** Adaptador de la topología A: las dos ventanas hablan con el store por IPC, sin red. */
export function conectarIpc({
  store,
  inicial,
  esOperador,
  destinos,
  importarContenido,
  quitarContenido,
  abrirCarpetaContenido,
  configurarYouTube,
  registrar,
}: OpcionesIpc) {
  const difundir = (canal: string, ...datos: unknown[]) => {
    for (const destino of destinos()) if (!destino.isDestroyed()) destino.send(canal, ...datos);
  };

  ipcMain.handle(CANALES.obtener, () => inicial());
  ipcMain.handle(CANALES.despachar, (evento, accion: unknown) => {
    // RF-13 como garantía: la pantalla pública no puede cambiar el estado.
    if (!esOperador(evento.sender))
      throw new Error('Solo la vista del operador puede llamar turnos.');
    return store.despachar(validarAccion(accion));
  });
  const categoriaValida = (categoria: unknown): categoria is CategoriaContenido =>
    categoria === 'videos' || categoria === 'banner';
  const exigirOperador = (remitente: WebContents) => {
    if (!esOperador(remitente))
      throw new Error('Solo la vista del operador puede administrar multimedia.');
  };
  ipcMain.handle('turnero:youtube', (evento, url: unknown) => {
    exigirOperador(evento.sender);
    if (evento.senderFrame !== evento.sender.mainFrame) throw new Error('Vista no autorizada.');
    if (url !== null && !esYouTube(url)) throw new Error('Enlace de YouTube no válido.');
    configurarYouTube(url);
  });
  ipcMain.handle(CANALES.importarContenido, (evento, categoria: unknown) => {
    exigirOperador(evento.sender);
    if (!categoriaValida(categoria)) throw new Error('Categoría multimedia no válida.');
    return importarContenido(categoria);
  });
  ipcMain.handle(CANALES.quitarContenido, (evento, url: unknown) => {
    exigirOperador(evento.sender);
    if (typeof url !== 'string' || url.length > 1000)
      throw new Error('Archivo multimedia no válido.');
    return quitarContenido(url);
  });
  ipcMain.handle(CANALES.abrirCarpetaContenido, (evento, categoria: unknown) => {
    exigirOperador(evento.sender);
    if (categoria !== undefined && !categoriaValida(categoria))
      throw new Error('Categoría multimedia no válida.');
    return abrirCarpetaContenido(categoria);
  });
  ipcMain.on(CANALES.registrar, (evento, mensaje: unknown) => {
    registrar(
      `[${esOperador(evento.sender) ? 'operador' : 'pública'}] ${String(mensaje).slice(0, 500)}`,
    );
  });
  let avisoYouTube = '';
  ipcMain.handle(CANALES.volumenYouTube, async (evento, volumen: unknown, rampa: unknown) => {
    if (esOperador(evento.sender)) throw new Error('Solo la vista pública ajusta YouTube.');
    if (typeof volumen !== 'number' || !(volumen >= 0 && volumen <= 1))
      throw new Error('Volumen no válido.');
    if (typeof rampa !== 'number' || !(rampa >= 0 && rampa <= 2000))
      throw new Error('Rampa no válida.');
    const frames = evento.sender.mainFrame.framesInSubtree.filter((frame) =>
      ORIGENES_YOUTUBE.includes(frame.origin),
    );
    const resultados = await Promise.all(
      frames.map((frame) =>
        frame
          .executeJavaScript(scriptVolumen(volumen, rampa))
          .then((r) => r as { videos: number; sonando: number })
          .catch(() => ({ videos: 0, sonando: 0 })),
      ),
    );
    const videos = resultados.reduce((total, r) => total + r.videos, 0);
    const sonando = resultados.reduce((total, r) => total + r.sonando, 0);
    // Más de un reproductor explica audio que sigue sonando tras pausar el visible.
    const aviso =
      frames.length > 1 || sonando > 1
        ? `YouTube duplicado: ${frames.length} iframes, ${videos} videos, ${sonando} sonando.`
        : '';
    if (aviso && aviso !== avisoYouTube) registrar(aviso);
    avisoYouTube = aviso;
    return videos;
  });
  store.suscribir((instantanea, anuncio) => difundir(CANALES.estado, instantanea, anuncio));

  return {
    difundirConfig: (config: Config) => difundir(CANALES.config, config),
    difundirContenido: (inventario: Inventario) => difundir(CANALES.contenido, inventario),
    difundirPantallas: (pantallas: Pantallas) => difundir(CANALES.pantallas, pantallas),
  };
}
