import type { OperatorPage } from '../hooks/useHelpAndTours';

export interface PageTitle {
  crumb: string;
  eyebrow: string;
  title: string;
  description: string;
}

export function pageTitleOf(page: OperatorPage): PageTitle {
  if (page === 'turnos')
    return { crumb: 'Turnos', eyebrow: '', title: 'Llamar turnos', description: '' };
  if (page === 'diagnostico')
    return {
      crumb: 'Diagnósticos',
      eyebrow: 'ESTADO OPERATIVO',
      title: 'Diagnósticos',
      description: 'Información para revisar y recuperar la operación.',
    };
  return { crumb: 'Multimedia', eyebrow: '', title: 'Multimedia', description: '' };
}
