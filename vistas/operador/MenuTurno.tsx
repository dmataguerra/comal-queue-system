import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatear } from '../../nucleo/turnos';
import { Icon } from '../comun/components/Icon';

interface Props {
  numero: number;
  abierto: boolean;
  ocupado: boolean;
  alternar: () => void;
  cerrar: () => void;
  anunciar: () => void;
  quitar: () => void;
}

/** Portal fuera de las tarjetas y del área con scroll: siempre abre debajo del botón. */
export function MenuTurno({ numero, abierto, ocupado, alternar, cerrar, anunciar, quitar }: Props) {
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState({ top: 0, left: 0, maxHeight: 200 });
  useLayoutEffect(() => {
    if (!abierto || !boton.current) return;
    const rect = boton.current.getBoundingClientRect();
    setPosicion({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
      maxHeight: Math.max(40, window.innerHeight - rect.bottom - 14),
    });
    menu.current?.querySelector('button')?.focus();
    const recolocar = () => cerrar();
    window.addEventListener('resize', recolocar);
    return () => window.removeEventListener('resize', recolocar);
  }, [abierto, cerrar]);

  return (
    <div className="turn-menu">
      <button
        ref={boton}
        className="icon-button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? `menu-turno-${numero}` : undefined}
        aria-label={`Acciones del turno ${formatear(numero)}`}
        onClick={(event) => {
          event.stopPropagation();
          alternar();
        }}
      >
        <Icon name="more" />
      </button>
      {abierto &&
        createPortal(
          <div
            ref={menu}
            id={`menu-turno-${numero}`}
            className="turn-menu-popup"
            role="menu"
            tabIndex={-1}
            style={posicion}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                cerrar();
                boton.current?.focus();
              }
              if (event.key === 'Tab') cerrar();
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const botones = [
                  ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    'button:not(:disabled)',
                  ),
                ];
                const indice = botones.indexOf(document.activeElement as HTMLButtonElement);
                botones[
                  (indice + (event.key === 'ArrowDown' ? 1 : botones.length - 1)) % botones.length
                ]?.focus();
              }
            }}
          >
            <button role="menuitem" disabled={ocupado} onClick={anunciar}>
              <Icon name="volume" />
              Anunciar de nuevo
            </button>
            <button role="menuitem" className="danger" disabled={ocupado} onClick={quitar}>
              <Icon name="trash" />
              Quitar de la pantalla
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
