import type { CSSProperties } from 'react';
const names = new Set([
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
export function Icon({
  name,
  className = '',
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const file = names.has(name) ? name : 'info';
  const collection = pixel.has(file) ? 'pixel' : 'phosphor';
  return (
    <span
      aria-hidden="true"
      className={`icon ${className}`}
      style={{ maskImage: `url('/assets/icons/${collection}/${file}.svg')`, ...style }}
    />
  );
}
