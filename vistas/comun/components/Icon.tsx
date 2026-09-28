import type { CSSProperties } from 'react';

const nombres = new Set([
  'zoomIn',
  'zoomOut',
  'coffee',
  'receipt',
  'counter',
  'headphones',
  'ticket',
  'play',
  'media',
  'settings',
  'calendar',
  'clock',
  'sun',
  'cloud',
  'chevron',
  'link',
  'music',
  'check',
  'checkCircle',
  'external',
  'volume',
  'mute',
  'pause',
  'stop',
  'close',
  'more',
  'monitor',
  'expand',
  'refresh',
  'info',
  'folder',
  'undo',
  'arrow',
  'warning',
  'trash',
  'image',
  'plus',
  'minus',
]);
const pixel = new Set([
  'zoomIn',
  'zoomOut',
  'coffee',
  'receipt',
  'play',
  'media',
  'calendar',
  'clock',
  'sun',
  'cloud',
  'chevron',
  'checkCircle',
  'volume',
  'close',
  'monitor',
  'info',
  'folder',
  'undo',
  'warning',
  'trash',
  'image',
  'plus',
  'minus',
]);

/** Comal pixel artwork; masks inherit control colors. Keep legacy icons without a pixel version. */
export function Icon({
  name,
  className = '',
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const archivo = nombres.has(name) ? name : 'info';
  const coleccion = pixel.has(archivo) ? 'pixel' : 'phosphor';
  return (
    <span
      aria-hidden="true"
      className={`icon ${className}`}
      style={{ maskImage: `url('/assets/icons/${coleccion}/${archivo}.svg')`, ...style }}
    />
  );
}
