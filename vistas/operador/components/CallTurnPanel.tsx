import type { FormEvent, RefObject } from 'react';
import { Icon } from '../../comun/components/Icon';

interface CallTurnPanelProps {
  entry: string;
  setEntry: (value: string) => void;
  parsedEntry: number | null;
  hint: string;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (e: FormEvent) => Promise<void>;
  message: string;
  isError: boolean;
}

export function CallTurnPanel({
  entry,
  setEntry,
  parsedEntry,
  hint,
  busy,
  inputRef,
  onSubmit,
  message,
  isError,
}: CallTurnPanelProps) {
  return (
    <section className="panel new-turn-panel">
      <div className="section-heading with-icon">
        <span className="section-icon">
          <Icon name="receipt" />
        </span>
        <div>
          <h2>Llamar turno</h2>
          <p>Teclea el ticket y presiona Enter. Para repetir, teclea el mismo número.</p>
        </div>
      </div>
      <form onSubmit={(evento) => void onSubmit(evento)}>
        <label htmlFor="turn-number">
          Número del ticket <span className="input-format">1 a 6 dígitos</span>
        </label>
        <div className="call-entry">
          <input
            className="turn-number-input"
            id="turn-number"
            data-help="ticket"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            placeholder="213298"
            autoComplete="off"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            aria-invalid={Boolean(entry.trim()) && parsedEntry === null}
            aria-describedby="call-hint ticket-feedback"
          />
        </div>
        <p id="call-hint" className="field-hint">
          {hint}
        </p>
        <button className="button primary register-button" data-help="anunciar" disabled={busy}>
          <Icon name="volume" />
          Anunciar en la TV<kbd>Enter</kbd>
        </button>
      </form>
      <div
        id="ticket-feedback"
        className={`form-feedback ${message ? (isError ? 'error' : 'success') : 'neutral'}`}
        role="status"
        aria-live="polite"
      >
        <Icon name={message ? (isError ? 'warning' : 'checkCircle') : 'info'} />
        <span>{message || 'Cada llamado suena en la TV con aviso y voz.'}</span>
      </div>
    </section>
  );
}
