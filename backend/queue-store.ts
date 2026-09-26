import {
  ESTADO_INICIAL,
  VIGENCIA_MS,
  deshacer,
  enPantalla,
  llamar,
  quitar,
  vencer,
  type Estado,
} from '../nucleo/turnos.js';
import type { Accion, Anuncio, Instantanea, ResultadoDespacho } from '../shared/contract.js';

export type Suscriptor = (instantanea: Instantanea, anuncio: Anuncio | null) => void;

export interface Store {
  obtener(): Instantanea;
  despachar(accion: Accion): ResultadoDespacho;
  suscribir(fn: Suscriptor): () => void;
  reiniciarSiCambioDia(): boolean;
  saludPersistencia(): {
    estado: 'correcta' | 'error';
    primerFallo: string | null;
    restauradaEn: string | null;
    ultimoGuardado: string | null;
    ultimoError: string | null;
    ultimoAnuncio: { n: number; fecha: string } | null;
  };
  cerrar(): void;
}

interface QueueStorePorts {
  load: (today: string) => {
    estado: Estado;
    desde: Map<number, number>;
    advertencia?: string;
  };
  save: (state: Estado, date: string, since: ReadonlyMap<number, number>) => void;
  ensureCapacity: () => void;
  today: () => string;
  registrar?: (message: string) => void;
  ahora?: () => number;
  vigenciaMs?: number;
}

/** Sole owner of queue state; file operations are supplied by the composition root. */
export function createQueueStore({
  load,
  save,
  ensureCapacity,
  today,
  ahora = () => Date.now(),
  vigenciaMs = VIGENCIA_MS,
  registrar = () => {},
}: QueueStorePorts): Store {
  let fecha = today();
  // `desde`: hora del último anuncio de cada número en pantalla. `desdePrevio` es la de antes del
  // último llamado y acompaña a `estado.deshacer`: se toma, se conserva y se descarta con él.
  let { estado, desde, advertencia: advertenciaRecuperacion } = load(fecha);
  let desdePrevio: Map<number, number> | null = null;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let siguienteAnuncio = 1;
  let primerFallo: string | null = null;
  let restauradaEn: string | null = null;
  let ultimoGuardado: string | null = null;
  let ultimoError: string | null = null;
  let ultimoAnuncio: { n: number; fecha: string } | null = null;
  const suscriptores = new Set<Suscriptor>();

  const obtener = (): Instantanea => ({
    actual: estado.actual,
    llamados: estado.llamados,
    puedeDeshacer: estado.deshacer !== null,
    ...(primerFallo ? { persistencia: { estado: 'error' as const, desde: primerFallo } } : {}),
    ...(advertenciaRecuperacion ? { advertenciaRecuperacion } : {}),
  });

  function persistir() {
    try {
      ensureCapacity();
      save(estado, fecha, desde);
      ultimoGuardado = new Date(ahora()).toISOString();
      if (primerFallo) {
        restauradaEn = new Date(ahora()).toISOString();
        registrar(`Persistencia de estado.json restaurada en ${restauradaEn}.`);
        primerFallo = null;
      }
    } catch (error) {
      ultimoError = String((error as Error).message).slice(0, 200);
      // Un fallo de disco no debe impedir que el número salga en la TV.
      if (!primerFallo) {
        primerFallo = new Date(ahora()).toISOString();
        registrar(
          `No se pudo guardar estado.json; cambios de turnos podrían perderse al reiniciar: ${(error as Error).message}`,
        );
      }
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

  /** Saca los números que ya cumplieron su vigencia; deja en `desde` solo lo que sigue en pantalla. */
  function aplicarVencidos(): boolean {
    const limite = ahora() - vigenciaMs;
    // Un número sin hora registrada empieza a contar ahora.
    desde = new Map(enPantalla(estado).map((n) => [n, desde.get(n) ?? ahora()]));
    const vencidos = [...desde].filter(([, t]) => t <= limite).map(([n]) => n);
    if (!vencidos.length) return false;
    estado = vencer(estado, vencidos).estado;
    for (const n of vencidos) desde.delete(n);
    if (!estado.deshacer) desdePrevio = null;
    return true;
  }

  /** Un solo temporizador, para el número que vence primero. */
  function programar() {
    clearTimeout(temporizador);
    if (!desde.size) return;
    const espera = Math.max(0, Math.min(...desde.values()) + vigenciaMs - ahora());
    temporizador = setTimeout(() => {
      if (aplicarVencidos()) {
        persistir();
        notificar(null);
      }
      programar();
    }, espera);
    // No retiene el proceso: un store con turnos no debe impedir que Node termine en las pruebas.
    temporizador.unref?.();
  }

  function reiniciarSiCambioDia(): boolean {
    const nueva = today();
    if (nueva === fecha) return false;
    fecha = nueva;
    advertenciaRecuperacion = undefined;
    if (estado.actual === null && !estado.deshacer) return false;
    estado = ESTADO_INICIAL;
    desde = new Map();
    desdePrevio = null;
    programar();
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
    if (anuncio) ultimoAnuncio = { n: anuncio.n, fecha: new Date(ahora()).toISOString() };
    const cambio = siguiente !== estado;
    const anterior = desde;
    if (accion.tipo === 'DESHACER' && cambio && desdePrevio) desde = desdePrevio;
    // Cada anuncio, también el repetido (RN-05), reinicia el tiempo en pantalla de ese número.
    if (anuncio) desde = new Map(desde).set(anuncio.n, ahora());
    if (!siguiente.deshacer) desdePrevio = null;
    else if (siguiente.deshacer !== estado.deshacer) desdePrevio = anterior;
    estado = siguiente;
    // Deshacer puede traer de vuelta un número que ya había vencido: se retira en el mismo paso.
    const vencio = aplicarVencidos();
    if (cambio || anuncio || vencio) {
      persistir();
      notificar(anuncio);
    }
    programar();
    return { instantanea: obtener(), efecto: anuncio ? 'ANUNCIAR' : null, anuncio };
  }

  // Al arrancar se descuenta el tiempo que la app estuvo cerrada.
  if (aplicarVencidos()) persistir();
  programar();

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
    saludPersistencia: () => ({
      estado: primerFallo ? 'error' : 'correcta',
      primerFallo,
      restauradaEn,
      ultimoGuardado,
      ultimoError,
      ultimoAnuncio,
    }),
    cerrar() {
      clearTimeout(temporizador);
      suscriptores.clear();
    },
  };
}
