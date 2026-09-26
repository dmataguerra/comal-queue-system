import { useSyncExternalStore } from 'react';

type Tema = 'azul' | 'morado';
const clave = 'comal.tema';
const oyentes = new Set<() => void>();
const normalizar = (valor: string | null): Tema => (valor === 'morado' ? 'morado' : 'azul');
function leer(): Tema {
  try {
    return normalizar(localStorage.getItem(clave));
  } catch {
    return 'azul';
  }
}
let tema = leer();
function aplicar(nuevo: Tema) {
  tema = nuevo;
  document.documentElement.dataset.tema = tema;
  oyentes.forEach((avisar) => avisar());
}
// Ambas vistas comparten origen y sesión en Electron. Se aplica antes del primer render.
aplicar(tema);
window.addEventListener('storage', (evento) => {
  if (evento.key === clave || evento.key === null) aplicar(leer());
});
function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}
export function useTema() {
  const actual = useSyncExternalStore(suscribir, () => tema);
  return {
    tema: actual,
    cambiarTema: () => {
      const nuevo = tema === 'azul' ? 'morado' : 'azul';
      // No indicar un cambio global si la preferencia no pudo guardarse.
      localStorage.setItem(clave, nuevo);
      aplicar(nuevo);
    },
  };
}
