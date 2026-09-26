import type { CSSProperties } from 'react';

const nombres = new Set([
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
/** Local Phosphor Duotone SVG images, MIT. Masks preserve theme colors and duotone opacity. */
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
  return (
    <span
      aria-hidden="true"
      className={`icon ${className}`}
      style={{ maskImage: `url('/assets/icons/phosphor/${archivo}.svg')`, ...style }}
    />
  );
}
