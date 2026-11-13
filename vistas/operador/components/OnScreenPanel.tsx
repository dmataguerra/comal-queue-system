import { formatear } from '../../../nucleo/turnos';
import type { EntregaAudio } from '../../../shared/contract';
import { Icon } from '../../comun/components/Icon';
import type { TurnActionKind } from '../hooks/useTurnConfirmation';

interface OnScreenPanelProps {
  current: number | null;
  called: number[];
  recentDeliveries: EntregaAudio[];
  busy: boolean;
  onRequestAction: (n: number, kind: TurnActionKind) => void;
}

const AUDIO_LABELS: Record<EntregaAudio['estado'], string> = {
  pendiente: 'En espera',
  reproduciendo: 'Anunciando',
  reproducido: 'Anunciado',
  fallo: 'Falló el audio',
  descartado: 'No anunciado',
};

function audioIconName(estado: EntregaAudio['estado']) {
  if (estado === 'fallo') return 'warning';
  if (estado === 'reproducido') return 'checkCircle';
  if (estado === 'pendiente') return 'clock';
  return 'volume';
}

interface TurnRowProps {
  n: number;
  highlighted: boolean;
  note: string;
  deliveries: EntregaAudio[];
  busy: boolean;
  onRequestAction: (n: number, kind: TurnActionKind) => void;
}

function TurnRow({ n, highlighted, note, deliveries, busy, onRequestAction }: TurnRowProps) {
  return (
    <div className={`cashier-turn ${highlighted ? 'most-recent' : ''}`}>
      <div className="cashier-ticket">
        <strong>{formatear(n)}</strong>
        {highlighted && <span>Turno actual</span>}
      </div>
      <div className="cashier-counter">
        {deliveries.map((e) => (
          <span
            key={e.id}
            className={`turn-audio turn-audio-${e.estado}`}
            role="status"
            title={e.motivo}
            data-anuncio-id={e.id}
          >
            <Icon name={audioIconName(e.estado)} />
            {AUDIO_LABELS[e.estado]}
          </span>
        ))}
        {highlighted ? (
          <span className="row-ready">
            <i />
            Destacado en la TV
          </span>
        ) : (
          <span className="counter-dash">{note}</span>
        )}
      </div>
      <div className="turn-actions" role="group" aria-label={`Acciones del turno ${formatear(n)}`}>
        <button
          type="button"
          className="turn-action"
          disabled={busy}
          aria-label={`Anunciar de nuevo el turno ${formatear(n)}`}
          title="Anunciar de nuevo"
          onClick={() => onRequestAction(n, 'anunciar')}
        >
          <Icon name="volume" />
        </button>
        <button
          type="button"
          className="turn-action danger"
          disabled={busy}
          aria-label={`Quitar de la pantalla el turno ${formatear(n)}`}
          title="Quitar de la pantalla"
          onClick={() => onRequestAction(n, 'quitar')}
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

export function OnScreenPanel({
  current,
  called,
  recentDeliveries,
  busy,
  onRequestAction,
}: OnScreenPanelProps) {
  const rows = [
    ...(current === null ? [] : [{ n: current, highlighted: true, note: '' }]),
    ...called.map((n, i) => ({
      n,
      highlighted: false,
      note: i === 0 ? 'Llamado anterior' : `Hace ${i + 1} llamados`,
    })),
  ];
  return (
    <section className="panel ready-panel" data-help="en-pantalla" aria-labelledby="screen-heading">
      <div className="ready-heading">
        <div>
          <h2 id="screen-heading">
            <span className="section-icon">
              <Icon name="monitor" />
            </span>
            En pantalla{' '}
            <span className="count-badge">{current === null ? 0 : called.length + 1}</span>
          </h2>
        </div>
      </div>
      <div className="cashier-ready-list">
        {rows.map(({ n, highlighted, note }) => (
          <TurnRow
            key={n}
            n={n}
            highlighted={highlighted}
            note={note}
            deliveries={recentDeliveries.filter((e) => e.n === n)}
            busy={busy}
            onRequestAction={onRequestAction}
          />
        ))}
        {current === null && (
          <div className="empty-state">
            <h3>Sin llamados en esta jornada</h3>
          </div>
        )}
      </div>
    </section>
  );
}
