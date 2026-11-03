import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { recorridos, type PaginaOperador, type RecorridoId } from './contenido';
import { Icon } from '../../comun/components/Icon';
import './ayuda.css';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function GuidedTour({
  id,
  onNavigate,
  onExit,
}: {
  id: RecorridoId;
  onNavigate: (pagina: PaginaOperador) => void;
  onExit: (completed: boolean, returnToHelp?: boolean) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [posicion, setPosicion] = useState({ left: 16, top: 16 });
  const panel = useRef<HTMLDivElement>(null);
  const recorrido = recorridos[id];
  const paso = recorrido.pasos[indice];
  const salida = useRef(onExit);
  salida.current = onExit;
  useEffect(() => {
    setRect(null);
    onNavigate(paso.pagina);
    let activo = true;
    let frame = 0;
    let intentos = 0;
    let objetivo: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    const medir = () => {
      if (!activo || !objetivo) return;
      const r = objetivo.getBoundingClientRect();
      const left = Math.max(8, r.left - 5),
        top = Math.max(8, r.top - 5);
      const right = Math.min(innerWidth - 8, r.right + 5),
        bottom = Math.min(innerHeight - 8, r.bottom + 5);
      const nuevo =
        right > left && bottom > top
          ? { left, top, width: right - left, height: bottom - top }
          : null;
      setRect((prev) => (JSON.stringify(prev) === JSON.stringify(nuevo) ? prev : nuevo));
    };
    const buscar = () => {
      if (!activo) return;
      objetivo = document.querySelector<HTMLElement>(paso.objetivo);
      if (!objetivo) {
        if (++intentos < 80) frame = requestAnimationFrame(buscar);
        return;
      }
      const estrecho = innerWidth <= 560;
      objetivo.scrollIntoView({
        block: estrecho ? 'start' : 'center',
        inline: 'nearest',
        behavior: 'instant',
      });
      if (estrecho) {
        const barra = document.querySelector<HTMLElement>('.admin-topbar');
        const alturaBarra =
          barra && ['sticky', 'fixed'].includes(getComputedStyle(barra).position)
            ? Math.min(barra.getBoundingClientRect().height, innerHeight / 3)
            : 0;
        window.scrollBy({ top: -(alturaBarra + 12), behavior: 'instant' });
      }
      medir();
      observer = new ResizeObserver(medir);
      observer.observe(objetivo);
      const workspace = document.querySelector('.admin-main');
      if (workspace) observer.observe(workspace);
    };
    frame = requestAnimationFrame(buscar);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      activo = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [paso, onNavigate]);
  useLayoutEffect(() => {
    const card = panel.current;
    if (!card) return;
    const medir = () => {
      const width = card.offsetWidth,
        height = card.offsetHeight;
      const margen = 16;
      const clampX = (x: number) => Math.max(margen, Math.min(innerWidth - width - margen, x));
      const clampY = (y: number) => Math.max(margen, Math.min(innerHeight - height - margen, y));
      let left = (innerWidth - width) / 2,
        top = (innerHeight - height) / 2;
      if (rect) {
        const candidatos = [
          { left: rect.left + (rect.width - width) / 2, top: rect.top + rect.height + 14 },
          { left: rect.left + (rect.width - width) / 2, top: rect.top - height - 14 },
          { left: rect.left + rect.width + 14, top: rect.top },
          { left: rect.left - width - 14, top: rect.top },
        ];
        const candidato = candidatos.find(
          (p) =>
            p.left >= margen &&
            p.top >= margen &&
            p.left + width <= innerWidth - margen &&
            p.top + height <= innerHeight - margen,
        );
        if (candidato) {
          left = candidato.left;
          top = candidato.top;
        } else {
          // A large target may leave no free rectangle. Keep as much of it visible as possible.
          const posiciones = [
            ...candidatos,
            { left: margen, top: margen },
            { left: innerWidth - width - margen, top: margen },
            { left: margen, top: innerHeight - height - margen },
            { left: innerWidth - width - margen, top: innerHeight - height - margen },
          ].map((p) => ({ left: clampX(p.left), top: clampY(p.top) }));
          const interseccion = (p: { left: number; top: number }) =>
            Math.max(
              0,
              Math.min(p.left + width, rect.left + rect.width) - Math.max(p.left, rect.left),
            ) *
            Math.max(
              0,
              Math.min(p.top + height, rect.top + rect.height) - Math.max(p.top, rect.top),
            );
          const mejor = posiciones.reduce((best, p) =>
            interseccion(p) < interseccion(best) ? p : best,
          );
          left = mejor.left;
          top = mejor.top;
        }
      }
      const nuevo = { left: clampX(left), top: clampY(top) };
      setPosicion((prev) => (prev.left === nuevo.left && prev.top === nuevo.top ? prev : nuevo));
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(card);
    window.addEventListener('resize', medir);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [rect, indice]);
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('[data-testid="help-tour-next"]')?.focus();
  }, [indice]);
  useEffect(() => {
    const controlar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        salida.current(false, false);
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Tab') {
        const botones = [
          ...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
        ];
        const actual = botones.indexOf(document.activeElement as HTMLButtonElement);
        if (
          actual === -1 ||
          (e.shiftKey && actual === 0) ||
          (!e.shiftKey && actual === botones.length - 1)
        ) {
          e.preventDefault();
          (e.shiftKey ? botones.at(-1) : botones[0])?.focus();
        }
      } else if (!panel.current?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const enfocar = (e: FocusEvent) => {
      if (!panel.current?.contains(e.target as Node))
        panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    };
    const bloquearFondo = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', controlar, true);
    window.addEventListener('focusin', enfocar, true);
    window.addEventListener('click', bloquearFondo, true);
    window.addEventListener('pointerdown', bloquearFondo, true);
    window.addEventListener('submit', bloquearFondo, true);
    return () => {
      window.removeEventListener('keydown', controlar, true);
      window.removeEventListener('focusin', enfocar, true);
      window.removeEventListener('click', bloquearFondo, true);
      window.removeEventListener('pointerdown', bloquearFondo, true);
      window.removeEventListener('submit', bloquearFondo, true);
    };
  }, []);
  return (
    <div
      className={`help-tour-overlay ${rect ? '' : 'help-tour-unlocated'}`}
      data-testid="help-tour"
      data-tour-id={id}
      data-step-index={indice}
      data-step-count={recorrido.pasos.length}
      data-tour-target={paso.objetivo}
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
        style={posicion}
      >
        <div className="help-tour-header">
          <span>
            {recorrido.titulo} · {indice + 1} de {recorrido.pasos.length}
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
        <progress
          max={recorrido.pasos.length}
          value={indice + 1}
          aria-label="Avance del recorrido"
        />
        <div aria-live="polite" aria-atomic="true">
          <h2 id="help-tour-title">{paso.titulo}</h2>
          <p id="help-tour-copy">{paso.texto}</p>
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
            disabled={indice === 0}
            onClick={() => setIndice((i) => i - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className="button primary"
            data-testid="help-tour-next"
            onClick={() =>
              indice === recorrido.pasos.length - 1 ? onExit(true) : setIndice((i) => i + 1)
            }
          >
            {indice === recorrido.pasos.length - 1 ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
