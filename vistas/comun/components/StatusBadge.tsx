import type {ReactNode} from 'react';

export function StatusBadge({children, tone = 'neutral'}: {children: ReactNode; tone?: 'neutral' | 'ready' | 'blue'}) {
  return <span className={`status-badge ${tone}`}><i aria-hidden="true"/>{children}</span>;
}
