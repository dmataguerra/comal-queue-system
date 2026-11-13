import { useCallback, useEffect, useRef, useState } from 'react';
import { errorCodeOf, errorMessageOf } from '../../../shared/errors';

/** Transient operator feedback message with auto-dismiss. */
export function useNotifications() {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((text: string, error = false) => {
    setMessage(text);
    setIsError(error);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), error ? 8000 : 4000);
  }, []);

  const notifyError = useCallback(
    (error: unknown) => {
      notify(
        errorCodeOf(error) === 'AUDIO_QUEUE_FULL'
          ? 'Audio en espera: intenta de nuevo en unos segundos. El turno no cambió.'
          : errorMessageOf(error),
        true,
      );
    },
    [notify],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, isError, notify, notifyError };
}
