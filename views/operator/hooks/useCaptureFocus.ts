import { useCallback, useRef } from 'react';

/** Ticket input ref plus a focus helper that yields to help overlays and open dialogs. */
export function useCaptureFocus() {
  const inputRef = useRef<HTMLInputElement>(null);
  const helpActiveRef = useRef(false);
  const focusCapture = useCallback(() => {
    if (!helpActiveRef.current && !document.querySelector('dialog[open]'))
      inputRef.current?.focus();
  }, []);
  return { inputRef, helpActiveRef, focusCapture };
}
