import { useClock } from '../../common/hooks/useClock';
import type { PageTitle } from '../turns/pageTitle';

export function PageHeading({ heading }: { heading: PageTitle }) {
  const clock = useClock();
  return (
    <div className="page-heading">
      <div>
        {heading.eyebrow && <span className="eyebrow">{heading.eyebrow}</span>}
        <h1>{heading.title}</h1>
        {heading.description && <p>{heading.description}</p>}
      </div>
      <div className="workspace-clock">
        <strong>{clock.time}</strong>
        <span>{clock.date}</span>
      </div>
    </div>
  );
}
