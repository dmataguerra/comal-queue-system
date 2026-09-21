import { ipcMain, type WebContents } from 'electron';
import type { Accion, CategoriaContenido, Config, Inicial, Inventario, Pantallas, ResultadoImportacion } from './contrato.js';
import type { Registrar } from './log.js';
import type { Store } from './store.js';

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
} as const;

interface OpcionesIpc {
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
  if (valor?.tipo === 'QUITAR' && Number.isInteger(valor.n) && (valor.n as number) >= 0 && (valor.n as number) <= 99) {
    return { tipo: 'QUITAR', n: valor.n as number };
  }
  throw new Error('Acción no válida.');
}

/** Adaptador de la topología A: las dos ventanas hablan con el store por IPC, sin red. */
export function conectarIpc({ store, inicial, esOperador, destinos, importarContenido, quitarContenido, abrirCarpetaContenido, registrar }: OpcionesIpc) {
  const difundir = (canal: string, ...datos: unknown[]) => {
    for (const destino of destinos()) if (!destino.isDestroyed()) destino.send(canal, ...datos);
  };

  ipcMain.handle(CANALES.obtener, () => inicial());
  ipcMain.handle(CANALES.despachar, (evento, accion: unknown) => {
    // RF-13 como garantía: la pantalla pública no puede cambiar el estado.
    if (!esOperador(evento.sender)) throw new Error('Solo la vista del operador puede llamar turnos.');
    return store.despachar(validarAccion(accion));
  });
  const categoriaValida = (categoria: unknown): categoria is CategoriaContenido => categoria === 'videos' || categoria === 'banner';
  const exigirOperador = (remitente: WebContents) => {
    if (!esOperador(remitente)) throw new Error('Solo la vista del operador puede administrar multimedia.');
  };
  ipcMain.handle(CANALES.importarContenido, (evento, categoria: unknown) => {
    exigirOperador(evento.sender);
    if (!categoriaValida(categoria)) throw new Error('Categoría multimedia no válida.');
    return importarContenido(categoria);
  });
  ipcMain.handle(CANALES.quitarContenido, (evento, url: unknown) => {
    exigirOperador(evento.sender);
    if (typeof url !== 'string' || url.length > 1000) throw new Error('Archivo multimedia no válido.');
    return quitarContenido(url);
  });
  ipcMain.handle(CANALES.abrirCarpetaContenido, (evento, categoria: unknown) => {
    exigirOperador(evento.sender);
    if (categoria !== undefined && !categoriaValida(categoria)) throw new Error('Categoría multimedia no válida.');
    return abrirCarpetaContenido(categoria);
  });
  ipcMain.on(CANALES.registrar, (evento, mensaje: unknown) => {
    registrar(`[${esOperador(evento.sender) ? 'operador' : 'pública'}] ${String(mensaje).slice(0, 500)}`);
  });
  store.suscribir((instantanea, anuncio) => difundir(CANALES.estado, instantanea, anuncio));

  return {
    difundirConfig: (config: Config) => difundir(CANALES.config, config),
    difundirContenido: (inventario: Inventario) => difundir(CANALES.contenido, inventario),
    difundirPantallas: (pantallas: Pantallas) => difundir(CANALES.pantallas, pantallas),
  };
}
