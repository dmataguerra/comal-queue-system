import { format } from '../../../core/turns';
import { Modal } from '../../common/components/Modal';
import type { PendingAction } from '../hooks/useTurnConfirmation';

interface ConfirmActionDialogProps {
  pending: PendingAction;
  dontAsk: boolean;
  setDontAsk: (value: boolean) => void;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionDialog({
  pending,
  dontAsk,
  setDontAsk,
  busy,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  return (
    <Modal title="¿Deseas confirmar la acción?" onClose={onCancel}>
      <p className="modal-copy">
        {pending.tipo === 'anunciar'
          ? `Se anunciará de nuevo el turno ${format(pending.numero)} en la TV, con aviso y voz.`
          : `Se quitará el turno ${format(pending.numero)} de la pantalla.`}
      </p>
      <label className="session-confirmation">
        <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
        <span>No volver a mostrar durante esta sesión</span>
      </label>
      <p className="field-hint">
        Aplica a Anunciar y Quitar. Al volver a abrir la aplicación se pedirá confirmación otra vez.
      </p>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={`button ${pending.tipo === 'quitar' ? 'danger' : 'primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {pending.tipo === 'anunciar' ? 'Confirmar anuncio' : 'Confirmar quitar'}
        </button>
      </div>
    </Modal>
  );
}
