import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { TourId } from '../help/content';
import { saveCompleted, readProgress } from '../help/progress';
import type { PendingAction } from './useTurnConfirmation';

export type OperatorPage = 'turnos' | 'multimedia' | 'diagnostico';

interface Options {
  page: OperatorPage;
  setPage: (page: OperatorPage) => void;
  pending: PendingAction | null;
  inputRef: RefObject<HTMLInputElement | null>;
  helpActiveRef: RefObject<boolean>;
  focusCapture: () => void;
}

/** Help center, guided tours, focus restoration and the F1 shortcut. */
export function useHelpAndTours({
  page,
  setPage,
  pending,
  inputRef,
  helpActiveRef,
  focusCapture,
}: Options) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [tour, setTour] = useState<TourId | null>(null);
  const [completed, setCompleted] = useState(readProgress);
  const focusBeforeHelp = useRef<HTMLElement | null>(null);
  const beforeTour = useRef({ pagina: page, x: 0, y: 0 });

  const openHelp = useCallback(() => {
    if (pending || tour) return;
    if (!helpActiveRef.current)
      focusBeforeHelp.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    helpActiveRef.current = true;
    setCompleted((current) => [...new Set([...current, ...readProgress()])]);
    setHelpOpen(true);
  }, [pending, tour, helpActiveRef]);

  function restoreFocus() {
    requestAnimationFrame(() => {
      if (helpActiveRef.current || document.querySelector('dialog[open]')) return;
      const previous = focusBeforeHelp.current;
      const candidates = [
        previous,
        previous?.id ? document.getElementById(previous.id) : null,
        inputRef.current,
        document.querySelector<HTMLElement>('.help-button'),
        document.getElementById('admin-main'),
      ];
      for (const candidate of candidates) {
        if (
          !candidate?.isConnected ||
          candidate === document.body ||
          candidate === document.documentElement ||
          candidate.closest('[inert], [hidden]')
        )
          continue;
        candidate.focus();
        if (document.activeElement === candidate) return;
      }
    });
  }

  function closeHelp() {
    helpActiveRef.current = false;
    setHelpOpen(false);
    restoreFocus();
  }

  function startTour(id: TourId) {
    beforeTour.current = { pagina: page, x: window.scrollX, y: window.scrollY };
    helpActiveRef.current = true;
    setHelpOpen(false);
    setTour(id);
  }

  function exitTour(finished: boolean, returnToHelp = true) {
    if (finished && tour) setCompleted((current) => saveCompleted(tour, current));
    setTour(null);
    setPage(beforeTour.current.pagina);
    setHelpOpen(returnToHelp);
    helpActiveRef.current = returnToHelp;
    requestAnimationFrame(() => {
      window.scrollTo(beforeTour.current.x, beforeTour.current.y);
      if (!returnToHelp) restoreFocus();
    });
  }

  function openDiagnostics() {
    helpActiveRef.current = false;
    setHelpOpen(false);
    setPage('diagnostico');
    requestAnimationFrame(() => document.getElementById('admin-main')?.focus());
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F1') {
        e.preventDefault();
        openHelp();
      }
    }
    focusCapture();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('focus', focusCapture);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('focus', focusCapture);
    };
  }, [openHelp, focusCapture]);

  return {
    helpOpen,
    tour,
    completed,
    beforeTour,
    openHelp,
    closeHelp,
    startTour,
    exitTour,
    openDiagnostics,
  };
}
