import { useEffect, useRef, useState } from 'react';
import { formatear, normalizar } from '../../nucleo/turnos';
import { ultimasEntregas } from '../../shared/politica-anuncios';
import { useTurnero } from '../comun/turnero';
import { useTema } from '../comun/tema';
import { useClock } from '../comun/hooks/useClock';
import { Brand } from '../comun/components/Brand';
import { Icon } from '../comun/components/Icon';
import { Modal } from '../comun/components/Modal';
import { MultimediaPanel } from './MultimediaPanel';
import { SizeControl } from '../comun/components/SizeControl';
import { VolumeControl } from '../comun/components/VolumeControl';
import { DiagnosticoPanel } from './DiagnosticoPanel';

/** Operación diaria: número + Enter, corrección explícita y F1 para ayuda. */
export function OperadorPage() {
  const { tema, cambiarTema } = useTema();
  const { instantanea, pantallas, entregasAudio = [], despachar, youtubeAdmitido } = useTurnero(),
    clock = useClock();
  const { actual, llamados, puedeDeshacer } = instantanea;
  const recientes = ultimasEntregas(entregasAudio);
  const anunciosPendientes = entregasAudio.filter(
    (e) => e.estado === 'pendiente' || e.estado === 'reproduciendo',
  ).length;
  const [pagina, setPagina] = useState<'turnos' | 'multimedia' | 'diagnostico'>('turnos'),
    [entrada, setEntrada] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [mensaje, setMensaje] = useState(''),
    [esError, setEsError] = useState(false),
    [ayuda, setAyuda] = useState(false),
    [pendiente, setPendiente] = useState<{ numero: number; tipo: 'anunciar' | 'quitar' } | null>(
      null,
    ),
    [noPreguntar, setNoPreguntar] = useState(false);
  const omitirConfirmacion = useRef(false);
  const input = useRef<HTMLInputElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previa = normalizar(entrada);
  function notificar(texto: string, error = false) {
    setMensaje(texto);
    setEsError(error);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMensaje(''), 8000);
  }
  async function llamar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    try {
      const resultado = await despachar({ tipo: 'LLAMAR', entrada });
      if (resultado.efecto === 'CAPTURA_INVALIDA')
        notificar(
          entrada.trim()
            ? 'Captura inválida: escribe solo números, de 1 a 6 dígitos. La TV no cambió.'
            : 'Escribe el número del ticket antes de presionar Enter.',
          true,
        );
      else if (resultado.anuncio) {
        notificar(
          resultado.anuncio.n === actual
            ? `Turno ${formatear(resultado.anuncio.n)} en cola de audio de nuevo.`
            : `Turno ${formatear(resultado.anuncio.n)} en cola de audio.`,
        );
        setEntrada('');
      }
    } catch (error) {
      notificar((error as Error).message, true);
    } finally {
      setOcupado(false);
      input.current?.focus();
    }
  }
  async function deshacerUltimo() {
    if (ocupado || !puedeDeshacer) return;
    setOcupado(true);
    try {
      const { instantanea: nueva } = await despachar({ tipo: 'DESHACER' });
      notificar(
        nueva.actual === null
          ? 'Llamado deshecho. La TV quedó sin turno actual.'
          : `Llamado deshecho. En la TV: turno ${formatear(nueva.actual)}.`,
      );
    } catch (error) {
      notificar((error as Error).message, true);
    } finally {
      setOcupado(false);
      input.current?.focus();
    }
  }
  async function accionDeFila(hacer: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await hacer();
    } catch (error) {
      notificar((error as Error).message, true);
    } finally {
      setOcupado(false);
      input.current?.focus();
    }
  }
  const anunciarDeNuevo = (n: number) =>
    accionDeFila(async () => {
      await despachar({ tipo: 'LLAMAR', entrada: String(n) });
      notificar(`Turno ${formatear(n)} en cola de audio de nuevo.`);
    });
  const quitarTurno = (n: number) =>
    accionDeFila(async () => {
      await despachar({ tipo: 'QUITAR', n });
      notificar(`Turno ${formatear(n)} quitado de la TV.`);
    });
  function solicitarAccion(numero: number, tipo: 'anunciar' | 'quitar') {
    if (ocupado || pendiente) return;
    if (omitirConfirmacion.current) {
      void (tipo === 'anunciar' ? anunciarDeNuevo(numero) : quitarTurno(numero));
    } else {
      setNoPreguntar(false);
      setPendiente({ numero, tipo });
    }
  }
  function confirmarAccion() {
    if (!pendiente || ocupado) return;
    const { numero, tipo } = pendiente;
    setPendiente(null);
    if (numero !== actual && !llamados.includes(numero)) {
      notificar('Ese turno ya no está en pantalla. No se realizó la acción.', true);
      return;
    }
    if (noPreguntar) omitirConfirmacion.current = true;
    void (tipo === 'anunciar' ? anunciarDeNuevo(numero) : quitarTurno(numero));
  }
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'F1') {
        e.preventDefault();
        setAyuda(true);
      }
    }
    const enfocar = () => {
      if (!document.querySelector('dialog[open]')) input.current?.focus();
    };
    enfocar();
    window.addEventListener('keydown', tecla);
    window.addEventListener('focus', enfocar);
    return () => {
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('focus', enfocar);
    };
  }, []);
  useEffect(() => {
    document.title = 'Troyanos · Operador';
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  // La TV es una sola lista: el actual arriba y detrás los llamados, del más reciente al más viejo.
  const filas = [
    ...(actual === null ? [] : [{ n: actual, destacada: true, nota: '' }]),
    ...llamados.map((n, i) => ({
      n,
      destacada: false,
      nota: i === 0 ? 'Llamado anterior' : `Hace ${i + 1} llamados`,
    })),
  ];
  const pista = !entrada.trim()
    ? 'Se usan los dos últimos dígitos del ticket.'
    : previa === null
      ? 'Solo números, de 1 a 6 dígitos.'
      : previa === actual
        ? 'Ya está en la TV: solo se repite el anuncio.'
        : llamados.includes(previa)
          ? 'Está en llamados: vuelve a ser el turno actual.'
          : 'Turno nuevo.';
  const titulo =
    pagina === 'turnos'
      ? { miga: 'Turnos', etiqueta: '', titulo: 'Llamar turnos', descripcion: '' }
      : pagina === 'diagnostico'
        ? {
            miga: 'Diagnósticos',
            etiqueta: 'ESTADO OPERATIVO',
            titulo: 'Diagnósticos',
            descripcion: 'Información para revisar y recuperar la operación.',
          }
        : {
            miga: 'Multimedia',
            etiqueta: '',
            titulo: 'Multimedia',
            descripcion: '',
          };
  return (
    <div className="admin-shell">
      <a href="#admin-main" className="skip-link">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <Brand />
        <span className="nav-label">ESPACIO DE TRABAJO</span>
        <nav aria-label="Navegación principal">
          <button
            aria-label="Turnos"
            title="Turnos"
            className={pagina === 'turnos' ? 'active' : ''}
            aria-current={pagina === 'turnos' ? 'page' : undefined}
            onClick={() => {
              setPagina('turnos');
              setTimeout(() => input.current?.focus());
            }}
          >
            <Icon name="receipt" />
            <span>Turnos</span>
            {pagina === 'turnos' && <i className="nav-active-dot" />}
          </button>
          <button
            aria-label="Multimedia"
            title="Multimedia"
            className={pagina === 'multimedia' ? 'active' : ''}
            aria-current={pagina === 'multimedia' ? 'page' : undefined}
            onClick={() => {
              setPagina('multimedia');
              window.scrollTo({ top: 0 });
            }}
          >
            <Icon name="media" />
            <span>Multimedia</span>
            {pagina === 'multimedia' && <i className="nav-active-dot" />}
          </button>
          <button aria-label="Ayuda" title="Ayuda" onClick={() => setAyuda(true)}>
            <Icon name="info" />
            <span>Ayuda</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-faculty">
            <img src="/assets/uaq-informatica-logo.png" alt="Facultad de Informática · UAQ" />
          </div>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="breadcrumb">
            Turnero
            <Icon name="chevron" />
            <span>{titulo.miga}</span>
          </div>
          <div className="theme-controls">
            <SizeControl notificar={notificar} />
            <VolumeControl notificar={notificar} />
            <button
              type="button"
              className="theme-switch"
              role="switch"
              aria-checked={tema === 'morado'}
              aria-label="Tema morado en operador y cliente"
              title="Cambiar el tema de ambas pantallas"
              onClick={() => {
                try {
                  cambiarTema();
                } catch {
                  notificar('No se pudo guardar el tema. Intenta de nuevo.', true);
                }
              }}
            >
              <span className="theme-switch-track" aria-hidden="true">
                <span className="theme-switch-thumb" />
              </span>
              <span>{tema === 'morado' ? 'Morado' : 'Azul'}</span>
            </button>
            <button className="button secondary help-button" onClick={() => setAyuda(true)}>
              <Icon name="info" />
              Ayuda<kbd>F1</kbd>
            </button>
          </div>
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              {titulo.etiqueta && <span className="eyebrow">{titulo.etiqueta}</span>}
              <h1>{titulo.titulo}</h1>
              {titulo.descripcion && <p>{titulo.descripcion}</p>}
            </div>
            <div className="workspace-clock">
              <strong>{clock.time}</strong>
              <span>{clock.date}</span>
            </div>
          </div>
          {!youtubeAdmitido && (
            <div className="connection-banner" role="alert">
              <Icon name="warning" />
              <span>
                YouTube no está admitido en navegador. Usa la aplicación de escritorio o contenido
                local. La pantalla del navegador usa contenido local.
              </span>
            </div>
          )}
          {pantallas.publica === 'ninguna' && (
            <div className="connection-banner" role="alert">
              <Icon name="warning" />
              <span>
                No se detecta la TV. La pantalla pública no se muestra para que el campo de captura
                nunca aparezca en ella. Revisa que la TV esté encendida y conectada: en cuanto se
                detecte, la pantalla pública vuelve sola.
              </span>
            </div>
          )}
          {anunciosPendientes >= 5 && (
            <div className="connection-banner" role="alert">
              <Icon name="warning" />
              <span>
                Hay {anunciosPendientes} de 6 anuncios en curso o en espera. Con seis, las nuevas
                llamadas se rechazan sin cambiar el turno. Espera antes de volver a llamar.
              </span>
            </div>
          )}
          {actual !== null && llamados.length === 5 && (
            <div className="connection-banner" role="status">
              <Icon name="info" />
              <span>
                La pantalla muestra seis turnos recientes. Una llamada de otro número retira de la
                pantalla el más antiguo ({formatear(llamados[4])}). Los turnos vencen cinco minutos
                después de su última llamada; vuelve a llamar si aún necesitan aviso.
              </span>
            </div>
          )}
          {recientes.some(
            (e) => e.estado === 'descartado' && [actual, ...llamados].includes(e.n),
          ) && (
            <div className="connection-banner" role="alert">
              <Icon name="warning" />
              <span>
                Hay anuncios descartados por espera o porque el turno dejó de estar vigente. Revisa
                las filas y vuelve a llamar si hace falta.
              </span>
            </div>
          )}
          {recientes.some((e) => e.estado === 'fallo' && [actual, ...llamados].includes(e.n)) && (
            <div className="connection-banner" role="alert">
              <Icon name="warning" />
              <span>
                Falló el audio de un turno. Revisa las filas marcadas y vuelve a anunciarlo.
              </span>
            </div>
          )}
          {instantanea.persistencia?.estado === 'error' && (
            <div className="connection-banner" role="alert">
              <Icon name="warning" />
              <span>
                No se pueden guardar los turnos. La última acción no se aplicó ni se anunció. Revisa
                el espacio y los permisos de la carpeta de datos y vuelve a intentarlo.
              </span>
            </div>
          )}
          {instantanea.advertenciaRecuperacion && (
            <div className="connection-banner" role="alert">
              <Icon name="warning" />
              <span>{instantanea.advertenciaRecuperacion}</span>
            </div>
          )}
          {pagina === 'turnos' ? (
            <>
              <div className="turns-layout">
                <div className="entry-column">
                  <section className="panel new-turn-panel">
                    <div className="section-heading with-icon">
                      <span className="section-icon">
                        <Icon name="receipt" />
                      </span>
                      <div>
                        <h2>Llamar turno</h2>
                        <p>
                          Teclea el ticket y presiona Enter. Para repetir, teclea el mismo número.
                        </p>
                      </div>
                    </div>
                    <form onSubmit={(evento) => void llamar(evento)}>
                      <label htmlFor="turn-number">
                        Número del ticket <span className="input-format">1 a 6 dígitos</span>
                      </label>
                      <div className="call-entry">
                        <input
                          className="turn-number-input"
                          id="turn-number"
                          ref={input}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="213298"
                          autoComplete="off"
                          value={entrada}
                          onChange={(e) => setEntrada(e.target.value)}
                          aria-invalid={Boolean(entrada.trim()) && previa === null}
                          aria-describedby="call-hint ticket-feedback"
                        />
                      </div>
                      <p id="call-hint" className="field-hint">
                        {pista}
                      </p>
                      <button className="button primary register-button" disabled={ocupado}>
                        <Icon name="volume" />
                        Anunciar en la TV<kbd>Enter</kbd>
                      </button>
                    </form>
                    <div
                      id="ticket-feedback"
                      className={`form-feedback ${mensaje ? (esError ? 'error' : 'success') : 'neutral'}`}
                      role="status"
                      aria-live="polite"
                    >
                      <Icon name={mensaje ? (esError ? 'warning' : 'checkCircle') : 'info'} />
                      <span>{mensaje || 'Cada llamado suena en la TV con aviso y voz.'}</span>
                    </div>
                  </section>
                  <section className="panel repeat-panel">
                    <div className="section-heading with-icon">
                      <span className="section-icon quiet">
                        <Icon name="undo" />
                      </span>
                      <div>
                        <h2>Corregir captura</h2>
                        <p>Quita el último llamado de la TV, sin volver a anunciar.</p>
                      </div>
                    </div>
                    <div className="undo-row">
                      <button
                        className="button secondary"
                        onClick={() => void deshacerUltimo()}
                        disabled={ocupado || !puedeDeshacer}
                      >
                        <Icon name="undo" />
                        Corregir última captura
                      </button>
                      <span>
                        {puedeDeshacer
                          ? 'Revierte únicamente la última captura.'
                          : 'No hay una captura pendiente de corrección.'}
                      </span>
                    </div>
                  </section>
                </div>
                <section className="panel ready-panel" aria-labelledby="screen-heading">
                  <div className="ready-heading">
                    <div>
                      <h2 id="screen-heading">
                        <span className="section-icon">
                          <Icon name="monitor" />
                        </span>
                        En pantalla{' '}
                        <span className="count-badge">
                          {actual === null ? 0 : llamados.length + 1}
                        </span>
                      </h2>
                    </div>
                  </div>
                  <div className="cashier-ready-list">
                    {filas.map(({ n, destacada, nota }) => (
                      <div className={`cashier-turn ${destacada ? 'most-recent' : ''}`} key={n}>
                        <div className="cashier-ticket">
                          <strong>{formatear(n)}</strong>
                          {destacada && <span>Turno actual</span>}
                        </div>
                        <div className="cashier-counter">
                          {recientes
                            .filter((e) => e.n === n)
                            .map((e) => (
                              <span
                                key={e.id}
                                className={`turn-audio turn-audio-${e.estado}`}
                                role="status"
                                title={e.motivo}
                                data-anuncio-id={e.id}
                              >
                                <Icon
                                  name={
                                    e.estado === 'fallo'
                                      ? 'warning'
                                      : e.estado === 'reproducido'
                                        ? 'checkCircle'
                                        : e.estado === 'pendiente'
                                          ? 'clock'
                                          : 'volume'
                                  }
                                />
                                {
                                  {
                                    pendiente: 'En espera',
                                    reproduciendo: 'Anunciando',
                                    reproducido: 'Anunciado',
                                    fallo: 'Falló el audio',
                                    descartado: 'No anunciado',
                                  }[e.estado]
                                }
                              </span>
                            ))}
                          {destacada ? (
                            <span className="row-ready">
                              <i />
                              Destacado en la TV
                            </span>
                          ) : (
                            <span className="counter-dash">{nota}</span>
                          )}
                        </div>
                        <div
                          className="turn-actions"
                          role="group"
                          aria-label={`Acciones del turno ${formatear(n)}`}
                        >
                          <button
                            type="button"
                            className="turn-action"
                            disabled={ocupado}
                            aria-label={`Anunciar de nuevo el turno ${formatear(n)}`}
                            title="Anunciar de nuevo"
                            onClick={() => solicitarAccion(n, 'anunciar')}
                          >
                            <Icon name="volume" />
                          </button>
                          <button
                            type="button"
                            className="turn-action danger"
                            disabled={ocupado}
                            aria-label={`Quitar de la pantalla el turno ${formatear(n)}`}
                            title="Quitar de la pantalla"
                            onClick={() => solicitarAccion(n, 'quitar')}
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {actual === null && (
                      <div className="empty-state">
                        <h3>Sin llamados en esta jornada</h3>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : pagina === 'multimedia' ? (
            <MultimediaPanel notificar={notificar} />
          ) : (
            <DiagnosticoPanel />
          )}
          <footer className="workspace-footer">
            <span>
              Facultad de Informática <i /> UAQ
            </span>
            <span>Crear · crecer · consolidar</span>
          </footer>
        </main>
      </div>
      {mensaje && pagina === 'multimedia' && (
        <div className={`toast ${esError ? 'error' : ''}`} role="status">
          <Icon name={esError ? 'warning' : 'checkCircle'} />
          {mensaje}
        </div>
      )}
      {pendiente && (
        <Modal title="¿Deseas confirmar la acción?" onClose={() => setPendiente(null)}>
          <p className="modal-copy">
            {pendiente.tipo === 'anunciar'
              ? `Se anunciará de nuevo el turno ${formatear(pendiente.numero)} en la TV, con aviso y voz.`
              : `Se quitará el turno ${formatear(pendiente.numero)} de la pantalla.`}
          </p>
          <label className="session-confirmation">
            <input
              type="checkbox"
              checked={noPreguntar}
              onChange={(e) => setNoPreguntar(e.target.checked)}
            />
            <span>No volver a mostrar durante esta sesión</span>
          </label>
          <p className="field-hint">
            Aplica a Anunciar y Quitar. Al volver a abrir la aplicación se pedirá confirmación otra
            vez.
          </p>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={() => setPendiente(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={`button ${pendiente.tipo === 'quitar' ? 'danger' : 'primary'}`}
              onClick={confirmarAccion}
              disabled={ocupado}
            >
              {pendiente.tipo === 'anunciar' ? 'Confirmar anuncio' : 'Confirmar quitar'}
            </button>
          </div>
        </Modal>
      )}
      {ayuda && (
        <Modal
          title="Cómo usar el turnero"
          onClose={() => {
            setAyuda(false);
            input.current?.focus();
          }}
        >
          <dl className="help-list">
            <dt>
              <kbd>Enter</kbd> Llamar
            </dt>
            <dd>
              Teclea el número del ticket y presiona Enter. Solo cuentan los dos últimos dígitos:{' '}
              <strong>213298</strong> se anuncia como <strong>98</strong>. Se aceptan de 1 a 6
              dígitos, incluidos los tickets que terminan en 00.
            </dd>
            <dt>
              <Icon name="volume" /> Repetir
            </dt>
            <dd>
              Teclea el mismo número. Si ya es el turno actual, solo se repite el anuncio; si está
              en llamados, vuelve a ser el actual sin duplicarse.
            </dd>
            <dt>
              <Icon name="undo" /> Corregir captura
            </dt>
            <dd>
              El botón <strong>Corregir última captura</strong> revierte el último llamado una sola
              vez. Ctrl+Z solo edita el texto que estés escribiendo. Los audios ya encolados
              terminan en orden.
            </dd>
            <dt>
              <Icon name="volume" /> Acciones de un turno
            </dt>
            <dd>
              Cada turno de <strong>En pantalla</strong> tiene dos botones:{' '}
              <strong>Anunciar</strong> añade su voz a la cola, y <strong>Quitar</strong> lo borra y
              descarta la corrección pendiente. Se pide confirmación; puedes omitirla para ambas
              acciones durante esta sesión. Quitar un turno descarta los anuncios que aún esperan;
              el audio que ya empezó termina antes del siguiente.
            </dd>
            <dt>
              <Icon name="monitor" /> La TV no muestra nada
            </dt>
            <dd>
              Revisa que esté encendida y conectada y que Windows esté configurado para extender las
              pantallas. La pantalla pública aparece sola cuando se detecta la TV.
            </dd>
            <dt>
              <Icon name="clock" /> Vaciado automático
            </dt>
            <dd>Cada turno desaparece de la pantalla 5 minutos después de su último anuncio.</dd>
            <dt>
              <Icon name="calendar" /> Cada día
            </dt>
            <dd>
              Al cambiar de jornada se limpia la lista. Tras reiniciar se recuperan los turnos
              guardados de la jornada que todavía no vencieron; los anuncios antiguos no se
              reproducen automáticamente.
            </dd>
            <dt>
              <Icon name="volume" /> Volumen y estado del audio
            </dt>
            <dd>
              En la barra superior puedes ajustar por separado voz y multimedia y pulsar Aplicar. La
              voz cambia en el siguiente anuncio; superar el 100% puede distorsionarla. La
              multimedia baja durante el anuncio. Cada fila indica En espera, Anunciando, Anunciado
              o Falló el audio. Anunciado confirma la reproducción por la aplicación: comprueba
              también las bocinas y la salida HDMI. Si falla, revisa Diagnósticos y repite el turno.
              Los llamados se reproducen en orden.
            </dd>
            <dt>
              <Icon name="media" /> Videos, imágenes y YouTube
            </dt>
            <dd>
              En Multimedia puedes agregar videos MP4 o WebM e imágenes JPG, PNG o WebP y quitar
              archivos con confirmación. YouTube tiene prioridad; si no está disponible se usa
              contenido local. Sin YouTube se reproducen videos y, si no hay videos reproducibles,
              imágenes. YouTube necesita internet; los turnos y archivos locales funcionan sin él.
            </dd>
            <dt>
              <Icon name="zoomIn" /> Tamaño y tema
            </dt>
            <dd>
              Las lupas de la barra superior ajustan el tamaño entre 90%, 100% y 110%. El
              interruptor Azul/Morado cambia el tema. Ambos ajustes se aplican a las dos pantallas.
            </dd>
            <dt>
              <Icon name="warning" /> Problemas al guardar
            </dt>
            <dd>
              Si aparece un error de guardado, la acción no se aplica ni se anuncia. Revisa el
              espacio disponible y los permisos de la carpeta indicada en Diagnósticos; después
              vuelve a intentarlo. Cierra la aplicación antes de respaldar o restaurar sus datos.
              Puedes abrir esta ayuda con F1 y cerrarla con Escape.
            </dd>
            <dt>Diagnósticos</dt>
            <dd>
              Si hay un problema con el audio, la TV o los archivos,{' '}
              <button
                className="help-diagnostics-link"
                onClick={() => {
                  setAyuda(false);
                  setPagina('diagnostico');
                }}
              >
                Ver estado y detalles técnicos
              </button>
              .
            </dd>
          </dl>
        </Modal>
      )}
    </div>
  );
}
