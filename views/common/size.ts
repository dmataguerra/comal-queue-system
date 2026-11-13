import { useSyncExternalStore } from 'react';
export const sizes = [70, 80, 90, 100, 110, 120, 130] as const;
export type Size = (typeof sizes)[number];
const key = 'comal.tamanio';
const listeners = new Set<() => void>();
function read(): Size {
  try {
    const value = Number(localStorage.getItem(key));
    return sizes.includes(value as Size) ? (value as Size) : 100;
  } catch {
    return 100;
  }
}
let current = read();
function apply(value: Size) {
  current = value;
  document.documentElement.style.setProperty('--ui-scale', String(value / 100));
  document.documentElement.dataset.tamanio = String(value);
  listeners.forEach((fn) => fn());
}
apply(current);
window.addEventListener('storage', (event) => {
  if (event.key === key || event.key === null) apply(read());
});
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function useSize() {
  const size = useSyncExternalStore(subscribe, () => current);
  return {
    tamanio: size,
    cambiar: (value: Size) => {
      localStorage.setItem(key, String(value));
      apply(value);
    },
  };
}
