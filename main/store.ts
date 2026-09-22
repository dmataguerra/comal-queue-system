import { ESTADO_INICIAL, deshacer, llamar, quitar, type Estado } from '../nucleo/turnos.js';
import type { Accion, Anuncio, Instantanea, ResultadoDespacho } from './contrato.js';
import type { Registrar } from './log.js';
import { fechaLocal, guardarEstado, leerEstado } from './persistencia.js';

export type Suscriptor = (instantanea: Instantanea, anuncio: Anuncio | null) => void;

export interface Store {
  obtener(): Instantanea;
  despachar(accion: Accion): ResultadoDespacho;
  suscribir(fn: Suscriptor): () => void;
  reiniciarSiCambioDia(): boolean;
}

interface OpcionesStore {
  ruta: string;
  hoy?: () => string;
  registrar?: Registrar;
}

/** Envuelve al núcleo: única dueña del estado, lo persiste y avisa a los adaptadores. */
export function crearStore({
  ruta,
  hoy = () => fechaLocal(),
  registrar = () => {},
}: OpcionesStore): Store {
  let fecha = hoy();
  let estado: Estado = leerEstado(ruta, fecha, registrar);
  let siguienteAnuncio = 1;
  const suscriptores = new Set<Suscriptor>();

  const obtener = (): Instantanea => ({
    actual: estado.actual,
    llamados: estado.llamados,
    puedeDeshacer: estado.deshacer !== null,
  });

  function persistir() {
    try {
      guardarEstado(ruta, estado, fecha);
    } catch (error) {
      // Un fallo de disco no debe impedir que el número salga en la TV.
      registrar(`No se pudo guardar estado.json: ${(error as Error).message}`);
    }
  }

  function notificar(anuncio: Anuncio | null) {
    const instantanea = obtener();
    for (const fn of suscriptores) {
      try {
        fn(instantanea, anuncio);
      } catch (error) {
        registrar(`Error al notificar el estado: ${(error as Error).message}`);
      }
    }
  }

  function reiniciarSiCambioDia(): boolean {
    const nueva = hoy();
    if (nueva === fecha) return false;
    fecha = nueva;
    if (estado.actual === null && !estado.deshacer) return false;
    estado = ESTADO_INICIAL;
    persistir();
    notificar(null);
    return true;
  }

  function despachar(accion: Accion): ResultadoDespacho {
    reiniciarSiCambioDia();
    const { estado: siguiente, efecto } =
      accion.tipo === 'LLAMAR'
        ? llamar(estado, accion.entrada)
        : accion.tipo === 'QUITAR'
          ? quitar(estado, accion.n)
          : deshacer(estado);
    if (efecto?.tipo === 'CAPTURA_INVALIDA') {
      return { instantanea: obtener(), efecto: 'CAPTURA_INVALIDA', anuncio: null };
    }
    const anuncio = efecto?.tipo === 'ANUNCIAR' ? { id: siguienteAnuncio++, n: efecto.n } : null;
    const cambio = siguiente !== estado;
    estado = siguiente;
    if (cambio) persistir();
    if (cambio || anuncio) notificar(anuncio);
    return { instantanea: obtener(), efecto: anuncio ? 'ANUNCIAR' : null, anuncio };
  }

  return {
    obtener,
    despachar,
    suscribir(fn) {
      suscriptores.add(fn);
      return () => {
        suscriptores.delete(fn);
      };
    },
    reiniciarSiCambioDia,
  };
}
