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

  function requestAction(numero: number, tipo: TurnActionKind) {
    if (busy || pending) return;
    if (skipConfirmation.current) {
      void (tipo === 'anunciar' ? announceAgain(numero) : removeTurn(numero));
    } else {
      setDontAsk(false);
      setPending({ numero, tipo });
    }
  }

  function confirmAction() {
    if (!pending || busy) return;
    const { numero, tipo } = pending;
    setPending(null);
    if (numero !== current && !called.includes(numero)) {
      notify('Ese turno ya no está en pantalla. No se realizó la acción.', true);
      return;
    }
    if (dontAsk) skipConfirmation.current = true;
    void (tipo === 'anunciar' ? announceAgain(numero) : removeTurn(numero));
  }

  const cancelAction = () => setPending(null);

  return { pending, dontAsk, setDontAsk, requestAction, confirmAction, cancelAction };
}
