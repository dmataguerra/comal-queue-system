import type { AudioDelivery, InitialState, ImportResult } from '../../shared/contract.js';
import type { Logger } from '../../shared/logging.js';
import type { Store } from '../store.js';

export interface ServerOptions {
  reportHealth: (type: 'audio' | 'youtube', state: 'correcto' | 'degradado') => void;
  setVolume: (voice: number, media: number) => void;
  viewsDir: string;
  contentDir: string;
  port?: number;
  store: Store;
  initialState: () => InitialState;
  diagnostics: () => unknown;
  setYouTube: (url: string | null) => void;
  importContent: (category: 'videos' | 'banner') => Promise<ImportResult>;
  removeContent: (url: string) => boolean;
  openContentFolder: (category?: 'videos' | 'banner') => Promise<void>;
  confirmAnnouncement: (
    id: number,
    n: number,
    state: Exclude<AudioDelivery['estado'], 'pendiente'>,
  ) => void;
  logger: Logger;
}
