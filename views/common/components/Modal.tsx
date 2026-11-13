import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Modal({
  title,
  onClose,
  children,
  className = '',
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      data-testid={testId}
      aria-labelledby={titleId}
      onCancel={onClose}
      onPointerDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button onClick={onClose} className="icon-button" aria-label="Cerrar">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
