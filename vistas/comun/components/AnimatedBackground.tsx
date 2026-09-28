import { useId, useSyncExternalStore } from 'react';

const motionQuery = '(prefers-reduced-motion: reduce)';
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const reducedMotion = () => window.matchMedia(motionQuery).matches;

// Puntos tomados de assets/reference/public-background.png (1672 × 941).
// Se normalizan una sola vez al lienzo de DisplayCanvas, sin sangrado ni zoom.
const outlines = [
  [
    'light',
    'M1030 -40 C1100 23 1147 92 1245 101 C1313 106 1366 91 1407 101 C1474 115 1519 151 1556 202 C1589 250 1620 281 1672 302 L1712 320 L1712 -40 Z',
  ],
  [
    'blue',
    'M1090 -40 C1156 15 1186 64 1270 76 C1350 84 1388 63 1446 77 C1520 88 1552 123 1583 170 C1610 212 1635 231 1672 250 L1712 270 L1712 -40 Z',
  ],
  [
    'navy',
    'M1220 -40 C1266 0 1302 41 1374 51 C1434 57 1484 34 1541 48 C1603 63 1633 95 1660 136 C1665 145 1670 151 1672 154 L1712 185 L1712 -40 Z',
  ],
  [
    'light',
    'M-40 579 C75 580 144 625 210 696 C260 750 278 779 347 812 C416 847 473 824 556 835 C660 846 735 881 806 941 L830 981 L-40 981 Z',
  ],
  [
    'blue',
    'M-40 631 C65 630 127 668 188 733 C238 788 260 818 326 839 C389 859 434 838 502 848 C583 857 645 888 702 941 L730 981 L-40 981 Z',
  ],
  [
    'navy',
    'M-40 712 C46 708 89 735 136 786 C177 833 203 869 264 876 C319 883 365 863 426 869 C490 872 548 898 594 941 L630 981 L-40 981 Z',
  ],
  [
    'corner',
    'M1411 941 C1401 914 1411 887 1422 874 C1453 835 1500 838 1536 827 C1565 818 1572 799 1585 773 C1600 739 1634 724 1672 725 L1712 725 L1712 981 Z',
  ],
] as const;

function geometry(source: string, amount = 0, phase = 0) {
  let coordinate = 0;
  return source.replace(/([MC LZ])|(-?\d+(?:\.\d+)?)/g, (token, command: string | undefined) => {
    if (command) return command;
    const index = coordinate++;
    const value = Number(token);
    const axis = index % 2;
    const limit = axis === 0 ? 1672 : 941;
    // Los puntos fuera del lienzo quedan anclados. Las curvas interiores se desplazan hasta 42 px.
    const offset = value > 0 && value < limit ? amount * Math.sin(index * 0.7 + phase) : 0;
    return (value * (axis === 0 ? 1920 / 1672 : 1080 / 941) + offset).toFixed(2);
  });
}
const waves = outlines.map(([color, outline], index) => {
  const base = geometry(outline);
  const amplitude = index === 6 ? 24 : 34 + (index % 3) * 4;
  return {
    color,
    base,
    values: [
      base,
      geometry(outline, amplitude, index * 0.25),
      base,
      geometry(outline, -amplitude, index * 0.25),
      base,
    ].join(';'),
    duration: 12 + index * 0.8,
  };
});

/** SMIL interpola las curvas en el navegador; React sólo atiende cambios de accesibilidad. */
export function AnimatedBackground() {
  const id = useId();
  const reduce = useSyncExternalStore(subscribe, reducedMotion, () => true);
  return (
    <svg
      className="public-animated-background"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {['light', 'blue', 'navy', 'corner'].map((color) => (
          <linearGradient key={color} id={`${id}-${color}`} x1="0" y1="0" x2="1" y2="1">
            <stop className={`background-${color}-start`} />
            <stop offset="1" className={`background-${color}-end`} />
          </linearGradient>
        ))}
      </defs>
      {waves.map((wave, index) => (
        <path key={index} d={wave.base} fill={`url(#${id}-${wave.color})`}>
          {!reduce && (
            <animate
              attributeName="d"
              values={wave.values}
              dur={`${wave.duration}s`}
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.25;0.5;0.75;1"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
            />
          )}
        </path>
      ))}
    </svg>
  );
}
