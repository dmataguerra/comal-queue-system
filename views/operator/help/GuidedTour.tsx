import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tours, type OperatorPageId, type TourId } from './content';
import { Icon } from '../../common/components/Icon';
import './help.css';
interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
// El recorrido muestra los controles y bloquea las acciones de operación mientras está abierto.
export function GuidedTour({
  id,
  onNavigate,
  onExit,
}: {
  id: TourId;
  onNavigate: (page: OperatorPageId) => void;
  onExit: (completed: boolean, returnToHelp?: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const panel = useRef<HTMLDivElement>(null);
  const tour = tours[id];
  const step = tour.pasos[index];
  const exit = useRef(onExit);
  exit.current = onExit;
  useEffect(() => {
    setRect(null);
    onNavigate(step.page);
    let active = true;
    let frame = 0;
    let attempts = 0;
    let target: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      if (!active || !target) return;
      const r = target.getBoundingClientRect();
      const left = Math.max(8, r.left - 5),
        top = Math.max(8, r.top - 5);
      const right = Math.min(innerWidth - 8, r.right + 5),
        bottom = Math.min(innerHeight - 8, r.bottom + 5);
      const next =
        right > left && bottom > top
          ? { left, top, width: right - left, height: bottom - top }
          : null;
      setRect((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const find = () => {
      if (!active) return;
      target = document.querySelector<HTMLElement>(step.target);
      if (!target) {
        if (++attempts < 80) frame = requestAnimationFrame(find);
        return;
      }
      const narrow = innerWidth <= 560;
      target.scrollIntoView({
        block: narrow ? 'start' : 'center',
        inline: 'nearest',
        behavior: 'instant',
      });
      if (narrow) {
        const bar = document.querySelector<HTMLElement>('.admin-topbar');
        const barHeight =
          bar && ['sticky', 'fixed'].includes(getComputedStyle(bar).position)
            ? Math.min(bar.getBoundingClientRect().height, innerHeight / 3)
            : 0;
        window.scrollBy({ top: -(barHeight + 12), behavior: 'instant' });
      }
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(target);
      const workspace = document.querySelector('.admin-main');
      if (workspace) observer.observe(workspace);
    };
    frame = requestAnimationFrame(find);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, onNavigate]);
  useLayoutEffect(() => {
    const card = panel.current;
    if (!card) return;
    const measure = () => {
      const width = card.offsetWidth,
        height = card.offsetHeight;
      const margin = 16;
      const clampX = (x: number) => Math.max(margin, Math.min(innerWidth - width - margin, x));
      const clampY = (y: number) => Math.max(margin, Math.min(innerHeight - height - margin, y));
      let left = (innerWidth - width) / 2,
        top = (innerHeight - height) / 2;
      if (rect) {
        const candidates = [
          { left: rect.left + (rect.width - width) / 2, top: rect.top + rect.height + 14 },
          { left: rect.left + (rect.width - width) / 2, top: rect.top - height - 14 },
          { left: rect.left + rect.width + 14, top: rect.top },
          { left: rect.left - width - 14, top: rect.top },
        ];
        const candidate = candidates.find(
          (p) =>
            p.left >= margin &&
            p.top >= margin &&
            p.left + width <= innerWidth - margin &&
            p.top + height <= innerHeight - margin,
        );
        if (candidate) {
          left = candidate.left;
          top = candidate.top;
        } else {
          const positions = [
            ...candidates,
            { left: margin, top: margin },
            { left: innerWidth - width - margin, top: margin },
            { left: margin, top: innerHeight - height - margin },
            { left: innerWidth - width - margin, top: innerHeight - height - margin },
          ].map((p) => ({ left: clampX(p.left), top: clampY(p.top) }));
          const intersection = (p: { left: number; top: number }) =>
            Math.max(
              0,
              Math.min(p.left + width, rect.left + rect.width) - Math.max(p.left, rect.left),
            ) *
            Math.max(
              0,
              Math.min(p.top + height, rect.top + rect.height) - Math.max(p.top, rect.top),
            );
          const bestCandidate = positions.reduce((best, p) =>
            intersection(p) < intersection(best) ? p : best,
          );
          left = bestCandidate.left;
          top = bestCandidate.top;
        }
      }
      const next = { left: clampX(left), top: clampY(top) };
      setPosition((prev) => (prev.left === next.left && prev.top === next.top ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [rect, index]);
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('[data-testid="help-tour-next"]')?.focus();
  }, [index]);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        exit.current(false, false);
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Tab') {
        const buttons = [
          ...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
        ];
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (
          current === -1 ||
          (e.shiftKey && current === 0) ||
          (!e.shiftKey && current === buttons.length - 1)
        ) {
          e.preventDefault();
          (e.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
        }
      } else if (!panel.current?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const handleFocus = (e: FocusEvent) => {
      if (!panel.current?.contains(e.target as Node))
        panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    };
    const blockBackground = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('focusin', handleFocus, true);
    window.addEventListener('click', blockBackground, true);
    window.addEventListener('pointerdown', blockBackground, true);
    window.addEventListener('submit', blockBackground, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('focusin', handleFocus, true);
      window.removeEventListener('click', blockBackground, true);
      window.removeEventListener('pointerdown', blockBackground, true);
      window.removeEventListener('submit', blockBackground, true);
    };
  }, []);
  return (
    <div
      className={`help-tour-overlay ${rect ? '' : 'help-tour-unlocated'}`}
      data-testid="help-tour"
      data-tour-id={id}
      data-step-index={index}
      data-step-count={tour.pasos.length}
      data-tour-target={step.target}
    >
      {rect && (
        <div
          className="help-tour-highlight"
          data-testid="help-tour-highlight"
          style={rect}
          aria-hidden="true"
        />
      )}
      <div
        ref={panel}
        className="help-tour-card"
        data-testid="help-tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-tour-title"
        aria-describedby="help-tour-copy"
        style={position}
      >
        <div className="help-tour-header">
          <span>
            {tour.titulo} · {index + 1} de {tour.pasos.length}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Salir del recorrido"
            data-testid="help-tour-close"
            onClick={() => onExit(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <progress max={tour.pasos.length} value={index + 1} aria-label="Avance del recorrido" />
        <div aria-live="polite" aria-atomic="true">
          <h2 id="help-tour-title">{step.title}</h2>
          <p id="help-tour-copy">{step.text}</p>
        </div>
        {!rect && (
          <p className="help-tour-fallback">
            El control no está visible. Puedes seguir leyendo o salir del recorrido.
          </p>
        )}
        <p className="help-tour-safe">
          <Icon name="info" />
          Este recorrido no llama pedidos ni modifica tus archivos.
        </p>
        <div className="help-tour-actions">
          <button
            type="button"
            className="button secondary"
            data-testid="help-tour-prev"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className="button primary"
            data-testid="help-tour-next"
            onClick={() =>
              index === tour.pasos.length - 1 ? onExit(true) : setIndex((i) => i + 1)
            }
          >
            {index === tour.pasos.length - 1 ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
