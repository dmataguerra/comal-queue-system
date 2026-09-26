// Types shared by the queue application, renderer transport, and Electron adapter.
// Persisted JSON names and IPC payload shapes are compatibility contracts.

export type Accion =
  { tipo: 'LLAMAR'; entrada: string } | { tipo: 'DESHACER' } | { tipo: 'QUITAR'; n: number };

/** The renderer never receives the undo history itself. */
export interface Instantanea {
  actual: number | null;
  llamados: number[];
  puedeDeshacer: boolean;
  persistencia?: { estado: 'error'; desde: string };
  advertenciaRecuperacion?: string;
}

export interface Anuncio {
  id: number;
  n: number;
}

export interface ResultadoDespacho {
  instantanea: Instantanea;
  efecto: 'ANUNCIAR' | 'CAPTURA_INVALIDA' | null;
  anuncio: Anuncio | null;
}

/** config.json format; field names are retained for installed releases. */
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

export interface Inventario {
  videos: string[];
  banner: string[];
  voz: (string | null)[];
  aviso: string | null;
}

export type CategoriaContenido = 'videos' | 'banner';

export interface ResultadoImportacion {
  agregados: string[];
  omitidos: string[];
  cancelado: boolean;
  motivos?: Record<string, string>;
}

export interface Pantallas {
  publica: 'tv' | 'ventana' | 'ninguna';
}

export interface Inicial {
  instantanea: Instantanea;
  config: Config;
  inventario: Inventario;
  pantallas: Pantallas;
}

export interface Diagnostico {
  version: string;
  electron: string;
  node: string;
  plataforma: string;
  arquitectura: string;
  carpetaDatos: string;
  rutaConfig: string;
  rutaEstado: string;
  rutaLog: string;
  pantalla: Pantallas['publica'];
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
  ultimoAnuncio: { n: number; fecha: string } | null;
  longitudCola: number;
  espacioLibre: number | null;
  espacioBajo: boolean;
  accionPendiente: boolean;
}

export interface TurneroApi {
  diagnostico(): Promise<Diagnostico>;
  informarSalud(tipo: 'audio' | 'youtube', estado: 'correcto' | 'degradado'): void;
  configurarYouTube(url: string | null): Promise<void>;
  ajustarVolumenYouTube(volumen: number, rampa: number): Promise<number>;
  obtener(): Promise<Inicial>;
  despachar(accion: Accion): Promise<ResultadoDespacho>;
  importarContenido(categoria: CategoriaContenido): Promise<ResultadoImportacion>;
  quitarContenido(url: string): Promise<boolean>;
  abrirCarpetaContenido(categoria?: CategoriaContenido): Promise<void>;
  alCambiarEstado(fn: (instantanea: Instantanea, anuncio: Anuncio | null) => void): () => void;
  alCambiarConfig(fn: (config: Config) => void): () => void;
  alCambiarContenido(fn: (inventario: Inventario) => void): () => void;
  alCambiarPantallas(fn: (pantallas: Pantallas) => void): () => void;
  registrar(mensaje: string): void;
}
