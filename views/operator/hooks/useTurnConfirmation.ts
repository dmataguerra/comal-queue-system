import { useRef, useState } from 'react';

export type TurnActionKind = 'anunciar' | 'quitar';
export interface PendingAction {
  numero: number;
  tipo: TurnActionKind;
}

interface Options {
  busy: boolean;
  current: number | null;
  called: number[];
  announceAgain: (n: number) => Promise<void>;
  removeTurn: (n: number) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}

/** Confirmation flow for per-row actions, with a session-long opt-out. */
export function useTurnConfirmation({
  busy,
  current,
  called,
  announceAgain,
  removeTurn,
  notify,
}: Options) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [dontAsk, setDontAsk] = useState(false);
  const skipConfirmation = useRef(false);

  function requestAction(turnNumber: number, kind: TurnActionKind) {
    if (busy || pending) return;
    if (skipConfirmation.current) {
      void (kind === 'anunciar' ? announceAgain(turnNumber) : removeTurn(turnNumber));
    } else {
      setDontAsk(false);
      setPending({ numero: turnNumber, tipo: kind });
    }
  }

  function confirmAction() {
    if (!pending || busy) return;
    const { numero: turnNumber, tipo: kind } = pending;
    setPending(null);
    if (turnNumber !== current && !called.includes(turnNumber)) {
      notify('Ese turno ya no está en pantalla. No se realizó la acción.', true);
      return;
    }
    if (dontAsk) skipConfirmation.current = true;
    void (kind === 'anunciar' ? announceAgain(turnNumber) : removeTurn(turnNumber));
  }

  const cancelAction = () => setPending(null);

  return { pending, dontAsk, setDontAsk, requestAction, confirmAction, cancelAction };
}
