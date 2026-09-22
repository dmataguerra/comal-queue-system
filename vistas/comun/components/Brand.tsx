export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-logo-plate">
        <img
          className="brand-logo"
          src="/assets/troyanos-logo.png"
          alt="Troyanos · Facultad de Informática UAQ"
        />
      </span>
    </div>
  );
}
