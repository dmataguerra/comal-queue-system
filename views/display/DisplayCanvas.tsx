import { useLayoutEffect, useRef, type ReactNode } from 'react';
export function DisplayCanvas({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = viewport.current!;
    const resize = () => {
      const scale = Math.min(element.clientWidth / 1920, element.clientHeight / 1080);
      element.style.setProperty('--display-scale', String(scale));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <div className="public-viewport" ref={viewport}>
      {children}
    </div>
  );
}
