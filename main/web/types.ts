import type { EntregaAudio, Inicial, ResultadoImportacion } from '../../shared/contract.js';
import type { Logger } from '../../shared/logging.js';
import type { Store } from '../store.js';

export interface OpcionesServidor {
  informarSalud: (tipo: 'audio' | 'youtube', estado: 'correcto' | 'degradado') => void;
  configurarVolumen: (voz: number, multimedia: number) => void;
  vistas: string;
  contenido: string;
  puerto?: number;
  store: Store;
  inicial: () => Inicial;
  diagnostico: () => unknown;
  configurarYouTube: (url: string | null) => void;
  importarContenido: (categoria: 'videos' | 'banner') => Promise<ResultadoImportacion>;
  quitarContenido: (url: string) => boolean;
  abrirCarpetaContenido: (categoria?: 'videos' | 'banner') => Promise<void>;
  confirmarAnuncio: (
    id: number,
    n: number,
    estado: Exclude<EntregaAudio['estado'], 'pendiente'>,
  ) => void;
  logger: Logger;
}
