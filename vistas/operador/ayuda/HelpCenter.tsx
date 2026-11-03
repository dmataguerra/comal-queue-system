import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../comun/components/Modal';
import { Icon } from '../../comun/components/Icon';
import { getQueueTransport } from '../../comun/transport';
import { buscarTemas, recorridos, type RecorridoId, type TemaAyuda } from './contenido';
import './ayuda.css';
import capturaTicket from '../../../docs/user-manual/source/screenshots/0.4.0/captura-ticket.png';
import capturaCorregir from '../../../docs/user-manual/source/screenshots/0.4.0/corregir-captura.png';
import capturaMultimedia from '../../../docs/user-manual/source/screenshots/0.4.0/multimedia.png';

const imagenes: Record<string, string> = {
  llamar: capturaTicket,
  corregir: capturaCorregir,
  multimedia: capturaMultimedia,
};

export function HelpCenter({
  onClose,
  onStartTour,
  onDiagnostics,
  completados,
  youtubeAdmitido,
}: {
  onClose: () => void;
  onStartTour: (id: RecorridoId) => void;
  onDiagnostics: () => void;
  completados: RecorridoId[];
  youtubeAdmitido: boolean;
}) {
  const [consulta, setConsulta] = useState('');
  const [tema, setTema] = useState<TemaAyuda | null>(null);
  const [pdfEstado, setPdfEstado] = useState<'listo' | 'abriendo' | 'error'>('listo');
  const buscador = useRef<HTMLInputElement>(null);
  const tituloTema = useRef<HTMLHeadingElement>(null);
  const resultados = buscarTemas(consulta);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (tema) tituloTema.current?.focus();
      else buscador.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [tema]);
  async function abrirPdf() {
    setPdfEstado('abriendo');
    try {
      const api = getQueueTransport();
      if (!api) throw new Error('Transporte no disponible');
      await api.abrirManual();
      setPdfEstado('listo');
    } catch {
      setPdfEstado('error');
    }
  }
  return (
    <Modal title="Centro de ayuda" className="help-center" testId="help-center" onClose={onClose}>
      {tema ? (
        <article className="help-article" data-testid="help-article" data-help-topic={tema.id}>
          <button type="button" className="help-back" onClick={() => setTema(null)}>
            ← Volver a las tareas
          </button>
          <span className="help-topic-icon">
            <Icon name={tema.icono} />
          </span>
          <h3 ref={tituloTema} tabIndex={-1}>
            {tema.titulo}
          </h3>
          <p className="help-intro">{tema.resumen}</p>
          {imagenes[tema.id] && (
            <img
              className="help-article-image"
              src={imagenes[tema.id]}
              alt={`Detalle de los controles para ${tema.titulo.toLocaleLowerCase('es')}`}
            />
          )}
          <ol className="help-steps">
            {tema.pasos.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
          <div className="help-notes">
            {tema.notas.map((nota) => (
              <p key={nota}>{nota}</p>
            ))}
          </div>
          {tema.id === 'multimedia' && (
            <p className="help-environment">
              {youtubeAdmitido
                ? 'Estás usando la aplicación de escritorio.'
                : 'Estás usando el navegador: elige contenido local.'}
            </p>
          )}
          {tema.recorrido && (
            <button
              type="button"
              className="button primary"
              onClick={() => onStartTour(tema.recorrido!)}
            >
              Mostrarme dónde
            </button>
          )}
        </article>
      ) : (
        <>
          <div className="help-welcome">
            <span className="help-eyebrow">APRENDE A TU RITMO</span>
            <h3>Una tarea, pocos pasos.</h3>
            <p className="help-intro">Consulta una duda o conoce los controles con un recorrido.</p>
          </div>
          <div className="help-search-row">
            <label htmlFor="help-search">¿Qué necesitas hacer?</label>
            <div>
              <input
                id="help-search"
                data-testid="help-search"
                ref={buscador}
                type="search"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Buscar: corregir, sonido, imágenes…"
                autoComplete="off"
              />
              {consulta && (
                <button
                  type="button"
                  className="help-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setConsulta('')}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          <p className="help-result-count" aria-live="polite">
            {consulta
              ? `${resultados.length} ${resultados.length === 1 ? 'tarea encontrada' : 'tareas encontradas'}`
              : 'Elige una tarea'}
          </p>
          <div className="help-topic-grid" data-testid="help-results">
            {resultados.map((item) => (
              <button
                type="button"
                className="help-topic"
                key={item.id}
                data-help-topic={item.id}
                onClick={() => setTema(item)}
              >
                <span className="help-topic-icon">
                  <Icon name={item.icono} />
                </span>
                <strong>{item.titulo}</strong>
                <span>{item.resumen}</span>
                <span className="help-topic-link">
                  Ver pasos <span aria-hidden="true">→</span>
                </span>
              </button>
            ))}
          </div>
          {!resultados.length && (
            <div className="help-no-results">
              <strong>No encontramos esa tarea.</strong>
              <p>Prueba con «ticket», «corregir», «audio» o «imágenes».</p>
              <button type="button" className="button secondary" onClick={() => setConsulta('')}>
                Ver todas las tareas
              </button>
            </div>
          )}
          {!consulta && (
            <section className="help-tours" aria-labelledby="help-tours-title">
              <div>
                <h3 id="help-tours-title">Conoce los controles</h3>
                <p>Recorridos informativos: no llaman pedidos ni cambian datos.</p>
              </div>
              <div className="help-tour-grid">
                {(Object.keys(recorridos) as RecorridoId[]).map((id) => (
                  <button
                    type="button"
                    className="help-tour-choice"
                    data-testid={`help-tour-start-${id}`}
                    key={id}
                    onClick={() => onStartTour(id)}
                  >
                    <span className="help-tour-choice-title">
                      <Icon name="play" />
                      <strong>{recorridos[id].titulo}</strong>
                    </span>
                    <span>{recorridos[id].resumen}</span>
                    <small
                      data-testid={`help-progress-${id}`}
                      className={completados.includes(id) ? 'is-complete' : ''}
                    >
                      {completados.includes(id)
                        ? 'Completado'
                        : `${recorridos[id].pasos.length} pasos · Pendiente`}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <footer className="help-footer">
        <div>
          <button
            type="button"
            data-testid="help-pdf"
            className="button secondary"
            disabled={pdfEstado === 'abriendo'}
            onClick={() => void abrirPdf()}
          >
            <Icon name="external" />
            {pdfEstado === 'abriendo' ? 'Preparando PDF…' : 'Manual PDF'}
          </button>
          <small>Abrir o descargar el manual de usuario.</small>
        </div>
        <button type="button" className="help-diagnostics-link" onClick={onDiagnostics}>
          Ver estado y detalles técnicos
        </button>
      </footer>
      {pdfEstado === 'error' && (
        <p className="help-pdf-error" role="alert">
          No se pudo abrir el manual. Vuelve a intentarlo; si continúa, solicita apoyo al
          responsable.
        </p>
      )}
    </Modal>
  );
}
