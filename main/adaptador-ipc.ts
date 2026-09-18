import { ipcMain, type WebContents } from 'electron';
import type { Accion, Config, Inicial, Inventario, Pantallas } from './contrato.js';
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
  pantallas: 'turnero:pantallas',
} as const;

interface OpcionesIpc {
  store: Store;
  inicial: () => Inicial;
  esOperador: (remitente: WebContents) => boolean;
  destinos: () => WebContents[];
  registrar: Registrar;
}

function validarAccion(accion: unknown): Accion {
  const valor = accion as Partial<Record<string, unknown>> | null;
  if (valor?.tipo === 'DESHACER') return { tipo: 'DESHACER' };
  if (valor?.tipo === 'LLAMAR' && typeof valor.entrada === 'string' && valor.entrada.length <= 32) {
    return { tipo: 'LLAMAR', entrada: valor.entrada };
  }
  throw new Error('Acción no válida.');
}

/** Adaptador de la topología A: las dos ventanas hablan con el store por IPC, sin red. */
export function conectarIpc({ store, inicial, esOperador, destinos, registrar }: OpcionesIpc) {
  const difundir = (canal: string, ...datos: unknown[]) => {
    for (const destino of destinos()) if (!destino.isDestroyed()) destino.send(canal, ...datos);
  };

  ipcMain.handle(CANALES.obtener, () => inicial());
  ipcMain.handle(CANALES.despachar, (evento, accion: unknown) => {
    // RF-13 como garantía: la pantalla pública no puede cambiar el estado.
    if (!esOperador(evento.sender)) throw new Error('Solo la vista del operador puede llamar turnos.');
    return store.despachar(validarAccion(accion));
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
