import { Icon } from '../../common/components/Icon';

export function NoticesBanner({ notices }: { notices: string[] }) {
  if (notices.length === 0) return null;
  return (
    <details className="operator-notices">
      <summary>
        <Icon name="warning" />
        {notices[0].split('. ')[0]}
        {notices.length > 1 && <span> · {notices.length - 1} más</span>}
      </summary>
      <div className="operator-notices-list">
        {notices.map((notice) => (
          <p key={notice}>{notice}</p>
        ))}
      </div>
    </details>
  );
}
