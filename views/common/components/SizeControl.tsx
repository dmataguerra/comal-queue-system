import { useSize, sizes } from '../size';
import { Icon } from './Icon';
export function SizeControl({
  notificar: notify,
}: {
  notificar: (message: string, error?: boolean) => void;
}) {
  const { tamanio: size, cambiar: change } = useSize();
  const adjust = (next: (typeof sizes)[number]) => {
    try {
      change(next);
    } catch {
      notify('No se pudo guardar el tamaño. Intenta de nuevo.', true);
    }
  };
  return (
    <div className="zoom-tools" role="group" aria-label={`Tamaño de ambas pantallas: ${size}%`}>
      <button
        type="button"
        aria-label="Reducir tamaño"
        title={`Reducir tamaño · ${size}%`}
        disabled={size === sizes[0]}
        onClick={() => adjust(sizes[Math.max(0, sizes.indexOf(size) - 1)])}
      >
        <Icon name="zoomOut" />
      </button>
      <button
        type="button"
        aria-label="Aumentar tamaño"
        title={`Aumentar tamaño · ${size}%`}
        disabled={size === sizes[sizes.length - 1]}
        onClick={() => adjust(sizes[Math.min(sizes.length - 1, sizes.indexOf(size) + 1)])}
      >
        <Icon name="zoomIn" />
      </button>
    </div>
  );
}
