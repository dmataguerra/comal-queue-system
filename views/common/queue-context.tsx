import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Action,
  Announcement,
  ContentCategory,
  AudioDelivery,
  InitialState,
  DispatchResult,
  ImportResult,
  QueueApi,
} from '../../shared/contract';
import { MAX_ANNOUNCEMENTS } from '../../shared/announcement-policy';
import { getQueueTransport } from './transport';
interface ContextValue extends InitialState {
  youtubeAdmitido: boolean;
  configurarVolumen: QueueApi['configurarVolumen'];
  diagnostico: QueueApi['diagnostico'];
  informarSalud: QueueApi['informarSalud'];
  confirmarAnuncio: QueueApi['confirmarAnuncio'];
  configurarYouTube: QueueApi['configurarYouTube'];
  ajustarVolumenYouTube: QueueApi['ajustarVolumenYouTube'];
  despachar: (action: Action) => Promise<DispatchResult>;
  importarContenido: (category: ContentCategory) => Promise<ImportResult>;
  quitarContenido: (url: string) => Promise<boolean>;
  abrirCarpetaContenido: (category?: ContentCategory) => Promise<void>;
  suscribirAnuncio: (fn: (announcement: Announcement) => void) => () => void;
  suscribirEntregaAudio: (fn: (delivery: AudioDelivery) => void) => () => void;
  registrar: QueueApi['registrar'];
}
const QueueContext = createContext<ContextValue | null>(null);
export function QueueProvider({ children }: { children: ReactNode }) {
  const api = getQueueTransport();
  const [initial, setInitial] = useState<InitialState | null>(null),
    [error, setError] = useState('');
  const announcements = useRef(new Set<(announcement: Announcement) => void>());
  const acks = useRef(new Set<(delivery: AudioDelivery) => void>());
  // Announcements can arrive before the public view has subscribed (startup, daily reload,
  // crash recovery). They are held here and handed to the first subscriber, and each id is
  // delivered once even if it comes both as an event and from the initial snapshot.
  const pending = useRef<Announcement[]>([]);
  const delivered = useRef(new Set<number>());
  const emitAnnouncement = useRef((announcement: Announcement) => {
    if (delivered.current.has(announcement.id)) return;
    if (!announcements.current.size) {
      if (!pending.current.some((a) => a.id === announcement.id))
        pending.current = [...pending.current, announcement].slice(-MAX_ANNOUNCEMENTS);
      return;
    }
    delivered.current.add(announcement.id);
    announcements.current.forEach((fn) => fn(announcement));
  });
  const actions = useMemo(
    () => ({
      youtubeAdmitido: api?.youtubeAdmitido !== false,
      diagnostico: () => api!.diagnostico(),
      informarSalud: (kind: 'audio' | 'youtube', status: 'correcto' | 'degradado') =>
        api!.informarSalud(kind, status),
      confirmarAnuncio: (
        id: number,
        n: number,
        status: Exclude<AudioDelivery['estado'], 'pendiente'>,
      ) => api!.confirmarAnuncio(id, n, status),
      configurarYouTube: (url: string | null) => api!.configurarYouTube(url),
      configurarVolumen: (voice: number, media: number) => api!.configurarVolumen(voice, media),
      ajustarVolumenYouTube: (volume: number, ramp: number) =>
        api!.ajustarVolumenYouTube(volume, ramp),
      despachar: (action: Action) => api!.despachar(action),
      importarContenido: (category: ContentCategory) => api!.importarContenido(category),
      quitarContenido: (url: string) => api!.quitarContenido(url),
      abrirCarpetaContenido: (category?: ContentCategory) => api!.abrirCarpetaContenido(category),
      suscribirAnuncio: (fn: (announcement: Announcement) => void) => {
        announcements.current.add(fn);
        const held = pending.current;
        pending.current = [];
        held.forEach(emitAnnouncement.current);
        return () => {
          announcements.current.delete(fn);
        };
      },
      registrar: (message: string, level?: 'info' | 'warn' | 'error') =>
        api?.registrar(message, level),
      suscribirEntregaAudio: (fn: (delivery: AudioDelivery) => void) => {
        acks.current.add(fn);
        return () => {
          acks.current.delete(fn);
        };
      },
    }),
    [api],
  );
  useEffect(() => {
    if (!api) return;
    const remove = [
      api.alCambiarEstado((snapshot, announcement, revision) => {
        setInitial((previous) => {
          if (!previous) return previous;
          // Events and the initial snapshot travel on different channels; drop older ones.
          if (
            revision !== undefined &&
            previous.revision !== undefined &&
            revision <= previous.revision
          )
            return previous;
          return {
            ...previous,
            instantanea: snapshot,
            revision: revision ?? previous.revision,
            entregasAudio: previous.entregasAudio?.filter((e) =>
              [snapshot.actual, ...snapshot.llamados].includes(e.n),
            ),
          };
        });
        if (announcement) emitAnnouncement.current(announcement);
      }),
      api.alCambiarConfig((config) =>
        setInitial((previous) => previous && { ...previous, config }),
      ),
      api.alCambiarContenido((inventory) =>
        setInitial((previous) => previous && { ...previous, inventario: inventory }),
      ),
      api.alCambiarPantallas((screens) =>
        setInitial((previous) => previous && { ...previous, pantallas: screens }),
      ),
      api.alCambiarEntregaAudio((audioDelivery) => {
        if (audioDelivery.estado !== 'pendiente')
          pending.current = pending.current.filter((a) => a.id !== audioDelivery.id);
        // Main re-queues an announcement interrupted by a reload of this view.
        else if (audioDelivery.motivo)
          emitAnnouncement.current({ id: audioDelivery.id, n: audioDelivery.n });
        acks.current.forEach((fn) => fn(audioDelivery));
        setInitial(
          (previous) =>
            previous && {
              ...previous,
              entregaAudio: audioDelivery,
              entregasAudio: [
                ...(previous.entregasAudio ?? []).filter((e) => e.id !== audioDelivery.id),
                audioDelivery,
              ]
                .sort((a, b) => a.id - b.id)
                .slice(-100),
            },
        );
      }),
    ];
    api
      .obtener()
      .then((data) => {
        setInitial(data);
        // Announcements accepted while this view was not listening are still owed.
        for (const delivery of data.entregasAudio ?? [])
          if (delivery.estado === 'pendiente')
            emitAnnouncement.current({ id: delivery.id, n: delivery.n });
      })
      .catch((e: Error) => setError(e.message));
    return () => remove.forEach((fn) => fn());
  }, [api]);
  if (!api)
    return (
      <div className="turnero-aviso">
        Esta vista solo funciona dentro de la aplicación del turnero.
      </div>
    );
  if (error)
    return <div className="turnero-aviso">No se pudo cargar el estado del turnero: {error}</div>;
  if (!initial) return null;
  return (
    <QueueContext.Provider value={{ ...initial, ...actions }}>{children}</QueueContext.Provider>
  );
}
export function useQueue() {
  const context = useContext(QueueContext);
  if (!context) throw new Error('TurneroProvider es obligatorio');
  return context;
}
