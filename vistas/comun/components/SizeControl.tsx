import { useTamanio, tamanios } from '../tamanio';
import { Icon } from './Icon';
export function SizeControl({
  notificar,
}: {
  notificar: (mensaje: string, error?: boolean) => void;
}) {
  const { tamanio, cambiar } = useTamanio();
  const indice = tamanios.indexOf(tamanio);
  const ajustar = (nuevo: (typeof tamanios)[number]) => {
    try {
      cambiar(nuevo);
    } catch {
      notificar('No se pudo guardar el tamaño. Intenta de nuevo.', true);
    }
  };
  return (
    <div className="size-control" role="group" aria-label="Tamaño de ambas pantallas">
      <span className="size-label">Tamaño</span>
      <button
        type="button"
        aria-label="Reducir tamaño"
        title="Reducir tamaño"
        disabled={indice === 0}
        onClick={() => ajustar(tamanios[indice - 1])}
      >
        <Icon name="minus" />
      </button>
      <button
        type="button"
        className="size-reset"
        aria-label={`Tamaño ${tamanio} %. Restablecer a 100 %`}
        title="Restablecer a 100 %"
        onClick={() => ajustar(100)}
      >
        <span aria-live="polite">{tamanio}%</span>
      </button>
      <button
        type="button"
        aria-label="Aumentar tamaño"
        title="Aumentar tamaño"
        disabled={indice === tamanios.length - 1}
        onClick={() => ajustar(tamanios[indice + 1])}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
