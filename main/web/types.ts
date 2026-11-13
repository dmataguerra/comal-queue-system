import type { AudioDelivery, InitialState, ImportResult } from '../../shared/contract.js';
import type { Logger } from '../../shared/logging.js';
import type { Store } from '../store.js';

export interface ServerOptions {
  informarSalud: (type: 'audio' | 'youtube', state: 'correcto' | 'degradado') => void;
  configurarVolumen: (voice: number, media: number) => void;
  vistas: string;
  contenido: string;
  puerto?: number;
  store: Store;
  inicial: () => InitialState;
  diagnostico: () => unknown;
  configurarYouTube: (url: string | null) => void;
  importarContenido: (category: 'videos' | 'banner') => Promise<ImportResult>;
  quitarContenido: (url: string) => boolean;
  abrirCarpetaContenido: (category?: 'videos' | 'banner') => Promise<void>;
  confirmarAnuncio: (
    id: number,
    n: number,
    state: Exclude<AudioDelivery['estado'], 'pendiente'>,
  ) => void;
  logger: Logger;
}
