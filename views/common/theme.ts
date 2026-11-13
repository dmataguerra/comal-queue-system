import { useSyncExternalStore } from 'react';
type Theme = 'azul' | 'morado';
const key = 'comal.tema';
const listeners = new Set<() => void>();
const normalize = (value: string | null): Theme => (value === 'morado' ? 'morado' : 'azul');
function read(): Theme {
  try {
    return normalize(localStorage.getItem(key));
  } catch {
    return 'azul';
  }
}
let theme = read();
function apply(next: Theme) {
  theme = next;
  document.documentElement.dataset.tema = theme;
  listeners.forEach((notify) => notify());
}
apply(theme);
window.addEventListener('storage', (event) => {
  if (event.key === key || event.key === null) apply(read());
});
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}
export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => theme);
  return {
    theme: current,
    toggleTheme: () => {
      const next = theme === 'azul' ? 'morado' : 'azul';
      localStorage.setItem(key, next);
      apply(next);
    },
  };
}
