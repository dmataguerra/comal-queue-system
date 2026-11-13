import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../common/components/Modal';
import { Icon } from '../../common/components/Icon';
import { getQueueTransport } from '../../common/transport';
import { searchTopics, tours, type TourId, type HelpTopic } from './content';
import './help.css';
import capturaTicket from '../../../docs/user-manual/source/screenshots/0.4.0/captura-ticket.png';
import capturaCorregir from '../../../docs/user-manual/source/screenshots/0.4.0/corregir-captura.png';
import capturaMultimedia from '../../../docs/user-manual/source/screenshots/0.4.0/multimedia.png';
const images: Record<string, string> = {
  llamar: capturaTicket,
  corregir: capturaCorregir,
  multimedia: capturaMultimedia,
};
export function HelpCenter({
  onClose,
  onStartTour,
  onDiagnostics,
  completados: completed,
  youtubeAdmitido: youtubeAllowed,
}: {
  onClose: () => void;
  onStartTour: (id: TourId) => void;
  onDiagnostics: () => void;
  completados: TourId[];
  youtubeAdmitido: boolean;
}) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [pdfStatus, setPdfStatus] = useState<'listo' | 'abriendo' | 'error'>('listo');
  const searchBox = useRef<HTMLInputElement>(null);
  const topicTitle = useRef<HTMLHeadingElement>(null);
  const results = searchTopics(query);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (topic) topicTitle.current?.focus();
      else searchBox.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [topic]);
  async function openPdf() {
    setPdfStatus('abriendo');
    try {
      const api = getQueueTransport();
      if (!api) throw new Error('Transporte no disponible');
      await api.abrirManual();
      setPdfStatus('listo');
    } catch {
      setPdfStatus('error');
    }
  }
  return (
    <Modal title="Centro de ayuda" className="help-center" testId="help-center" onClose={onClose}>
      {topic ? (
        <article className="help-article" data-testid="help-article" data-help-topic={topic.id}>
          <button type="button" className="help-back" onClick={() => setTopic(null)}>
            ← Volver a las tareas
          </button>
          <span className="help-topic-icon">
            <Icon name={topic.icon} />
          </span>
          <h3 ref={topicTitle} tabIndex={-1}>
            {topic.title}
          </h3>
          <p className="help-intro">{topic.summary}</p>
          {images[topic.id] && (
            <img
              className="help-article-image"
              src={images[topic.id]}
              alt={`Detalle de los controles para ${topic.title.toLocaleLowerCase('es')}`}
            />
          )}
          <ol className="help-steps">
            {topic.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="help-notes">
            {topic.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
          {topic.id === 'multimedia' && (
            <p className="help-environment">
              {youtubeAllowed
                ? 'Estás usando la aplicación de escritorio.'
                : 'Estás usando el navegador: elige contenido local.'}
            </p>
          )}
          {topic.tour && (
            <button
              type="button"
              className="button primary"
              onClick={() => onStartTour(topic.tour!)}
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
                ref={searchBox}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar: corregir, sonido, imágenes…"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className="help-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setQuery('')}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          <p className="help-result-count" aria-live="polite">
            {query
              ? `${results.length} ${results.length === 1 ? 'tarea encontrada' : 'tareas encontradas'}`
              : 'Elige una tarea'}
          </p>
          <div className="help-topic-grid" data-testid="help-results">
            {results.map((item) => (
              <button
                type="button"
                className="help-topic"
                key={item.id}
                data-help-topic={item.id}
                onClick={() => setTopic(item)}
              >
                <span className="help-topic-icon">
                  <Icon name={item.icon} />
                </span>
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
                <span className="help-topic-link">
                  Ver pasos <span aria-hidden="true">→</span>
                </span>
              </button>
            ))}
          </div>
          {!results.length && (
            <div className="help-no-results">
              <strong>No encontramos esa tarea.</strong>
              <p>Prueba con «ticket», «corregir», «audio» o «imágenes».</p>
              <button type="button" className="button secondary" onClick={() => setQuery('')}>
                Ver todas las tareas
              </button>
            </div>
          )}
          {!query && (
            <section className="help-tours" aria-labelledby="help-tours-title">
              <div>
                <h3 id="help-tours-title">Conoce los controles</h3>
                <p>Recorridos informativos: no llaman pedidos ni cambian datos.</p>
              </div>
              <div className="help-tour-grid">
                {(Object.keys(tours) as TourId[]).map((id) => (
                  <button
                    type="button"
                    className="help-tour-choice"
                    data-testid={`help-tour-start-${id}`}
                    key={id}
                    onClick={() => onStartTour(id)}
                  >
                    <span className="help-tour-choice-title">
                      <Icon name="play" />
                      <strong>{tours[id].titulo}</strong>
                    </span>
                    <span>{tours[id].resumen}</span>
                    <small
                      data-testid={`help-progress-${id}`}
                      className={completed.includes(id) ? 'is-complete' : ''}
                    >
                      {completed.includes(id)
                        ? 'Completado'
                        : `${tours[id].pasos.length} pasos · Pendiente`}
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
            disabled={pdfStatus === 'abriendo'}
            onClick={() => void openPdf()}
          >
            <Icon name="external" />
            {pdfStatus === 'abriendo' ? 'Preparando PDF…' : 'Manual PDF'}
          </button>
          <small>Abrir o descargar el manual de usuario.</small>
        </div>
        <button type="button" className="help-diagnostics-link" onClick={onDiagnostics}>
          Ver estado y detalles técnicos
        </button>
      </footer>
      {pdfStatus === 'error' && (
        <p className="help-pdf-error" role="alert">
          No se pudo abrir el manual. Vuelve a intentarlo; si continúa, solicita apoyo al
          responsable.
        </p>
      )}
    </Modal>
  );
}
