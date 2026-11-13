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
  Accion,
  Anuncio,
  CategoriaContenido,
  EntregaAudio,
  Inicial,
  ResultadoDespacho,
  ResultadoImportacion,
  TurneroApi,
} from '../../shared/contract';
import { MAX_ANUNCIOS } from '../../shared/politica-anuncios';
import { getQueueTransport } from './transport';
interface Contexto extends Inicial {
  youtubeAdmitido: boolean;
  configurarVolumen: TurneroApi['configurarVolumen'];
  diagnostico: TurneroApi['diagnostico'];
  informarSalud: TurneroApi['informarSalud'];
  confirmarAnuncio: TurneroApi['confirmarAnuncio'];
  configurarYouTube: TurneroApi['configurarYouTube'];
  ajustarVolumenYouTube: TurneroApi['ajustarVolumenYouTube'];
  despachar: (accion: Accion) => Promise<ResultadoDespacho>;
  importarContenido: (categoria: CategoriaContenido) => Promise<ResultadoImportacion>;
  quitarContenido: (url: string) => Promise<boolean>;
  abrirCarpetaContenido: (categoria?: CategoriaContenido) => Promise<void>;
  suscribirAnuncio: (fn: (anuncio: Anuncio) => void) => () => void;
  suscribirEntregaAudio: (fn: (entrega: EntregaAudio) => void) => () => void;
  registrar: TurneroApi['registrar'];
}
const TurneroContext = createContext<Contexto | null>(null);
export function TurneroProvider({ children }: { children: ReactNode }) {
  const api = getQueueTransport();
  const [inicial, setInicial] = useState<Inicial | null>(null),
    [error, setError] = useState('');
  const anuncios = useRef(new Set<(anuncio: Anuncio) => void>());
  const acuses = useRef(new Set<(entrega: EntregaAudio) => void>());
  // Announcements can arrive before the public view has subscribed (startup, daily reload,
  // crash recovery). They are held here and handed to the first subscriber, and each id is
  // delivered once even if it comes both as an event and from the initial snapshot.
  const enEspera = useRef<Anuncio[]>([]);
  const entregados = useRef(new Set<number>());
  const emitirAnuncio = useRef((anuncio: Anuncio) => {
    if (entregados.current.has(anuncio.id)) return;
    if (!anuncios.current.size) {
      if (!enEspera.current.some((a) => a.id === anuncio.id))
        enEspera.current = [...enEspera.current, anuncio].slice(-MAX_ANUNCIOS);
      return;
    }
    entregados.current.add(anuncio.id);
    anuncios.current.forEach((fn) => fn(anuncio));
  });
  const acciones = useMemo(
    () => ({
      youtubeAdmitido: api?.youtubeAdmitido !== false,
      diagnostico: () => api!.diagnostico(),
      informarSalud: (tipo: 'audio' | 'youtube', estado: 'correcto' | 'degradado') =>
        api!.informarSalud(tipo, estado),
      confirmarAnuncio: (
        id: number,
        n: number,
        estado: Exclude<EntregaAudio['estado'], 'pendiente'>,
      ) => api!.confirmarAnuncio(id, n, estado),
      configurarYouTube: (url: string | null) => api!.configurarYouTube(url),
      configurarVolumen: (voz: number, multimedia: number) =>
        api!.configurarVolumen(voz, multimedia),
      ajustarVolumenYouTube: (volumen: number, rampa: number) =>
        api!.ajustarVolumenYouTube(volumen, rampa),
      despachar: (accion: Accion) => api!.despachar(accion),
      importarContenido: (categoria: CategoriaContenido) => api!.importarContenido(categoria),
      quitarContenido: (url: string) => api!.quitarContenido(url),
      abrirCarpetaContenido: (categoria?: CategoriaContenido) =>
        api!.abrirCarpetaContenido(categoria),
      suscribirAnuncio: (fn: (anuncio: Anuncio) => void) => {
        anuncios.current.add(fn);
        const retenidos = enEspera.current;
        enEspera.current = [];
        retenidos.forEach(emitirAnuncio.current);
        return () => {
          anuncios.current.delete(fn);
        };
      },
      registrar: (mensaje: string, nivel?: 'info' | 'warn' | 'error') =>
        api?.registrar(mensaje, nivel),
      suscribirEntregaAudio: (fn: (entrega: EntregaAudio) => void) => {
        acuses.current.add(fn);
        return () => {
          acuses.current.delete(fn);
        };
      },
    }),
    [api],
  );
  useEffect(() => {
    if (!api) return;
    const quitar = [
      api.alCambiarEstado((instantanea, anuncio, revision) => {
        setInicial((previo) => {
          if (!previo) return previo;
          // Events and the initial snapshot travel on different channels; drop older ones.
          if (
            revision !== undefined &&
            previo.revision !== undefined &&
            revision <= previo.revision
          )
            return previo;
          return {
            ...previo,
            instantanea,
            revision: revision ?? previo.revision,
            entregasAudio: previo.entregasAudio?.filter((e) =>
              [instantanea.actual, ...instantanea.llamados].includes(e.n),
            ),
          };
        });
        if (anuncio) emitirAnuncio.current(anuncio);
      }),
      api.alCambiarConfig((config) => setInicial((previo) => previo && { ...previo, config })),
      api.alCambiarContenido((inventario) =>
        setInicial((previo) => previo && { ...previo, inventario }),
      ),
      api.alCambiarPantallas((pantallas) =>
        setInicial((previo) => previo && { ...previo, pantallas }),
      ),
      api.alCambiarEntregaAudio((entregaAudio) => {
        if (entregaAudio.estado !== 'pendiente')
          enEspera.current = enEspera.current.filter((a) => a.id !== entregaAudio.id);
        // Main re-queues an announcement interrupted by a reload of this view.
        else if (entregaAudio.motivo)
          emitirAnuncio.current({ id: entregaAudio.id, n: entregaAudio.n });
        acuses.current.forEach((fn) => fn(entregaAudio));
        setInicial(
          (previo) =>
            previo && {
              ...previo,
              entregaAudio,
              entregasAudio: [
                ...(previo.entregasAudio ?? []).filter((e) => e.id !== entregaAudio.id),
                entregaAudio,
              ]
                .sort((a, b) => a.id - b.id)
                .slice(-100),
            },
        );
      }),
    ];
    api
      .obtener()
      .then((datos) => {
        setInicial(datos);
        // Announcements accepted while this view was not listening are still owed.
        for (const entrega of datos.entregasAudio ?? [])
          if (entrega.estado === 'pendiente')
            emitirAnuncio.current({ id: entrega.id, n: entrega.n });
      })
      .catch((e: Error) => setError(e.message));
    return () => quitar.forEach((fn) => fn());
  }, [api]);
  if (!api)
    return (
      <div className="turnero-aviso">
        Esta vista solo funciona dentro de la aplicación del turnero.
      </div>
    );
  if (error)
    return <div className="turnero-aviso">No se pudo cargar el estado del turnero: {error}</div>;
  if (!inicial) return null;
  return (
    <TurneroContext.Provider value={{ ...inicial, ...acciones }}>
      {children}
    </TurneroContext.Provider>
  );
}
export function useTurnero() {
  const contexto = useContext(TurneroContext);
  if (!contexto) throw new Error('TurneroProvider es obligatorio');
  return contexto;
}
