import { Icon } from '../../common/components/Icon';

interface UndoPanelProps {
  busy: boolean;
  canUndo: boolean;
  onUndo: () => Promise<void>;
}

export function UndoPanel({ busy, canUndo, onUndo }: UndoPanelProps) {
  return (
    <section className="panel repeat-panel" data-help="corregir">
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
          onClick={() => void onUndo()}
          disabled={busy || !canUndo}
        >
          <Icon name="undo" />
          Corregir última captura
        </button>
        <span>
          {canUndo
            ? 'Revierte únicamente la última captura.'
            : 'No hay una captura pendiente de corrección.'}
        </span>
      </div>
    </section>
  );
}
