interface AlertBannerProps {
  type: 'error' | 'success'
  message: string
}

export default function AlertBanner({ type, message }: AlertBannerProps) {
  const icon = type === 'error' ? 'error' : 'check_circle'
  const role = type === 'error' ? 'alert' : 'status'

  return (
    <div className={`auth-banner ${type}`} role={role}>
      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
        {icon}
      </span>
      <span>{message}</span>
    </div>
  )
}
