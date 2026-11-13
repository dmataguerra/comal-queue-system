export type Action =
  | {
      tipo: 'LLAMAR';
      entrada: string;
    }
  | {
      tipo: 'DESHACER';
    }
  | {
      tipo: 'QUITAR';
      n: number;
    };
export interface Snapshot {
  actual: number | null;
  llamados: number[];
  puedeDeshacer: boolean;
  persistencia?: {
    estado: 'error';
    desde: string;
  };
  advertenciaRecuperacion?: string;
}
export interface Announcement {
  id: number;
  n: number;
  limiteInicio?: number;
}
export interface AudioDelivery {
  id: number;
  n: number;
  estado: 'pendiente' | 'reproduciendo' | 'reproducido' | 'fallo' | 'descartado';
  fecha: string;
  motivo?: string;
}
export interface DispatchResult {
  instantanea: Snapshot;
  efecto: 'ANUNCIAR' | 'CAPTURA_INVALIDA' | null;
  anuncio: Announcement | null;
}
export interface Config {
  youtubeUrl: string | null;
  repeticiones: 1 | 2;
  volumenVoz: number;
  volumenMusica: number;
  atenuacionMusica: number;
  segundosBanner: number;
  pantallaPublica: number | null;
  recargaDiaria: string;
  mensajes: string[];
}
export interface Inventory {
  revisionAudio?: string;
  videos: string[];
  banner: string[];
  voz: (string | null)[];
  aviso: string | null;
}
export type ContentCategory = 'videos' | 'banner';
export interface ImportResult {
  agregados: string[];
  omitidos: string[];
  cancelado: boolean;
  motivos?: Record<string, string>;
}
export interface Screens {
  publica: 'tv' | 'ventana' | 'ninguna';
}
export interface InitialState {
  instantanea: Snapshot;
  /** Revision of `instantanea`; state events with a lower or equal revision are stale. */
  revision?: number;
  config: Config;
  inventario: Inventory;
  pantallas: Screens;
  entregaAudio?: AudioDelivery | null;
  entregasAudio?: AudioDelivery[];
}
export interface Diagnostics {
  version: string;
  electron: string;
  node: string;
  plataforma: string;
  arquitectura: string;
  carpetaDatos: string;
  rutaConfig: string;
  rutaEstado: string;
  rutaLog: string;
  pantalla: Screens['publica'];
  operadorActivo: boolean;
  publicaActiva: boolean;
  persistencia: 'correcta' | 'error';
  ultimoGuardado: string | null;
  ultimoErrorPersistencia: string | null;
  ultimoErrorAplicacion: string | null;
  audio: 'correcto' | 'degradado' | 'desconocido';
  youtube: 'activo' | 'no disponible' | 'inactivo';
  videosValidos: number;
  bannersValidos: number;
  vocesValidas: number;
  ultimoAnuncio: {
    n: number;
    fecha: string;
  } | null;
  longitudCola: number;
  espacioLibre: number | null;
  espacioBajo: boolean;
  accionPendiente: boolean;
}
export interface QueueApi {
  youtubeAdmitido?: boolean;
  diagnostico(): Promise<Diagnostics>;
  informarSalud(type: 'audio' | 'youtube', state: 'correcto' | 'degradado'): void;
  confirmarAnuncio(
    id: number,
    n: number,
    state: Exclude<AudioDelivery['estado'], 'pendiente'>,
  ): void;
  configurarVolumen(voice: number, media: number): Promise<void>;
  configurarYouTube(url: string | null): Promise<void>;
  ajustarVolumenYouTube(volume: number, ramp: number): Promise<number>;
  obtener(): Promise<InitialState>;
  despachar(action: Action): Promise<DispatchResult>;
  importarContenido(category: ContentCategory): Promise<ImportResult>;
  quitarContenido(url: string): Promise<boolean>;
  abrirCarpetaContenido(category?: ContentCategory): Promise<void>;
  abrirManual(): Promise<void>;
  alCambiarEstado(
    fn: (snapshot: Snapshot, announcement: Announcement | null, revision?: number) => void,
  ): () => void;
  alCambiarConfig(fn: (config: Config) => void): () => void;
  alCambiarContenido(fn: (inventory: Inventory) => void): () => void;
  alCambiarPantallas(fn: (screens: Screens) => void): () => void;
  alCambiarEntregaAudio(fn: (delivery: AudioDelivery) => void): () => void;
  /** Sends a renderer log entry to the main-process log. Level defaults to `warn`. */
  registrar(message: string, level?: 'info' | 'warn' | 'error'): void;
}
