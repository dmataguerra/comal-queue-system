import { useState, type FormEvent } from 'react';
import { formatear, normalizar } from '../../../nucleo/turnos';
import type { Accion, ResultadoDespacho } from '../../../shared/contract';

interface Options {
  entry: string;
  clearEntry: () => void;
  current: number | null;
  canUndo: boolean;
  dispatch: (action: Accion) => Promise<ResultadoDespacho>;
  notify: (text: string, error?: boolean) => void;
  notifyError: (error: unknown) => void;
  focusCapture: () => void;
}

/** Operator actions that mutate the queue through the dispatcher. */
export function useQueueActions({
  entry,
  clearEntry,
  current,
  canUndo,
  dispatch,
  notify,
  notifyError,
  focusCapture,
}: Options) {
  const [busy, setBusy] = useState(false);

  const invalidEntryMessage = () =>
    entry.trim() ? 'Captura inválida: usa de 1 a 6 dígitos.' : 'Escribe el número del ticket.';

  async function call(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (normalizar(entry) === null) {
      notify(invalidEntryMessage(), true);
      focusCapture();
      return;
    }
    setBusy(true);
    try {
      const result = await dispatch({ tipo: 'LLAMAR', entrada: entry });
      if (result.efecto === 'CAPTURA_INVALIDA') notify(invalidEntryMessage(), true);
      else if (result.anuncio) {
        notify(
          result.anuncio.n === current
            ? `Turno ${formatear(result.anuncio.n)} en cola de audio de nuevo.`
            : `Turno ${formatear(result.anuncio.n)} en cola de audio.`,
        );
        clearEntry();
      }
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
      focusCapture();
    }
  }

  async function undoLast() {
    if (busy || !canUndo) return;
    setBusy(true);
    try {
      const { instantanea: next } = await dispatch({ tipo: 'DESHACER' });
      notify(
        next.actual === null
          ? 'Llamado deshecho. La TV quedó sin turno actual.'
          : `Llamado deshecho. En la TV: turno ${formatear(next.actual)}.`,
      );
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
      focusCapture();
    }
  }

  async function runRowAction(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
      focusCapture();
    }
  }

  const announceAgain = (n: number) =>
    runRowAction(async () => {
      await dispatch({ tipo: 'LLAMAR', entrada: String(n) });
      notify(`Turno ${formatear(n)} en cola de audio de nuevo.`);
    });

  const removeTurn = (n: number) =>
    runRowAction(async () => {
      await dispatch({ tipo: 'QUITAR', n });
      notify(`Turno ${formatear(n)} quitado de la TV.`);
    });

  return { busy, call, undoLast, announceAgain, removeTurn };
}
