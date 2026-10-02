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
  registrar: (mensaje: string) => void;
}
const TurneroContext = createContext<Contexto | null>(null);

/** Las vistas nunca tocan el núcleo: reciben estado y despachan acciones por el adaptador (§2). */
export function TurneroProvider({ children }: { children: ReactNode }) {
  const api = getQueueTransport();
  const [inicial, setInicial] = useState<Inicial | null>(null),
    [error, setError] = useState('');
  const anuncios = useRef(new Set<(anuncio: Anuncio) => void>());
  const acuses = useRef(new Set<(entrega: EntregaAudio) => void>());
  // Funciones estables: los efectos que se suscriben no deben reiniciarse en cada render.
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
        return () => {
          anuncios.current.delete(fn);
        };
      },
      registrar: (mensaje: string) => api?.registrar(mensaje),
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
    // Primero se escucha y luego se pide la instantánea: la respuesta siempre es más nueva que lo que llegó antes.
    const quitar = [
      api.alCambiarEstado((instantanea, anuncio) => {
        setInicial(
          (previo) =>
            previo && {
              ...previo,
              instantanea,
              entregasAudio: previo.entregasAudio?.filter((e) =>
                [instantanea.actual, ...instantanea.llamados].includes(e.n),
              ),
            },
        );
        if (anuncio) anuncios.current.forEach((fn) => fn(anuncio));
      }),
      api.alCambiarConfig((config) => setInicial((previo) => previo && { ...previo, config })),
      api.alCambiarContenido((inventario) =>
        setInicial((previo) => previo && { ...previo, inventario }),
      ),
      api.alCambiarPantallas((pantallas) =>
        setInicial((previo) => previo && { ...previo, pantallas }),
      ),
      api.alCambiarEntregaAudio((entregaAudio) => {
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
      .then(setInicial)
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
