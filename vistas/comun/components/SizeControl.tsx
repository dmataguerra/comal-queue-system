import { useTamanio, tamanios } from '../tamanio';
import { Icon } from './Icon';
export function SizeControl({
  notificar,
}: {
  notificar: (mensaje: string, error?: boolean) => void;
}) {
  const { tamanio, cambiar } = useTamanio();
  const ajustar = (nuevo: (typeof tamanios)[number]) => {
    try {
      cambiar(nuevo);
    } catch {
      notificar('No se pudo guardar el tamaño. Intenta de nuevo.', true);
    }
  };
  return (
    <div className="zoom-tools" role="group" aria-label={`Tamaño de ambas pantallas: ${tamanio}%`}>
      <button
        type="button"
        aria-label="Reducir tamaño"
        title={`Reducir tamaño · ${tamanio}%`}
        disabled={tamanio === tamanios[0]}
        onClick={() => ajustar(tamanios[Math.max(0, tamanios.indexOf(tamanio) - 1)])}
      >
        <Icon name="zoomOut" />
      </button>
      <button
        type="button"
        aria-label="Aumentar tamaño"
        title={`Aumentar tamaño · ${tamanio}%`}
        disabled={tamanio === tamanios[tamanios.length - 1]}
        onClick={() =>
          ajustar(tamanios[Math.min(tamanios.length - 1, tamanios.indexOf(tamanio) + 1)])
        }
      >
        <Icon name="zoomIn" />
      </button>
    </div>
  );
}
