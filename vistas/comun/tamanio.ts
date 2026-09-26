import { useSyncExternalStore } from 'react';

export const tamanios = [90, 100, 110] as const;
export type Tamanio = (typeof tamanios)[number];
const clave = 'comal.tamanio';
const oyentes = new Set<() => void>();
function leer(): Tamanio {
  try {
    const valor = Number(localStorage.getItem(clave));
    return valor === 90 || valor === 110 ? valor : 100;
  } catch {
    return 100;
  }
}
let actual = leer();
function aplicar(valor: Tamanio) {
  actual = valor;
  document.documentElement.style.setProperty('--ui-scale', String(valor / 100));
  document.documentElement.dataset.tamanio = String(valor);
  oyentes.forEach((fn) => fn());
}
aplicar(actual);
window.addEventListener('storage', (evento) => {
  if (evento.key === clave || evento.key === null) aplicar(leer());
});
const suscribir = (fn: () => void) => {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
};
export function useTamanio() {
  const tamanio = useSyncExternalStore(suscribir, () => actual);
  return {
    tamanio,
    cambiar: (valor: Tamanio) => {
      localStorage.setItem(clave, String(valor));
      aplicar(valor);
    },
  };
}
