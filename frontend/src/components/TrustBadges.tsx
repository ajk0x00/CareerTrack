export default function TrustBadges() {
  return (
    <div className="trust-badges-bar">
      <div className="trust-badge-item">
        <span className="material-symbols-outlined" style={{ color: 'var(--tertiary)' }}>
          lock
        </span>
        <span>256-bit SSL</span>
      </div>
      <div className="trust-badge-item">
        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
          verified_user
        </span>
        <span>SOC 2 Type II</span>
      </div>
      <div className="trust-badge-item">
        <span className="material-symbols-outlined" style={{ color: 'var(--tertiary)' }}>
          speed
        </span>
        <span>99.9% Uptime</span>
      </div>
    </div>
  )
}
