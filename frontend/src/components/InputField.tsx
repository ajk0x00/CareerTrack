import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  icon: string
  labelAction?: ReactNode
  rightAccessory?: ReactNode
}

export default function InputField({
  id,
  label,
  icon,
  labelAction,
  rightAccessory,
  className = '',
  ...inputProps
}: InputFieldProps) {
  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className="input-container">
        <span className="material-symbols-outlined input-icon">{icon}</span>
        <input
          id={id}
          className={`auth-input ${rightAccessory ? 'has-toggle' : ''} ${className}`.trim()}
          {...inputProps}
        />
        {rightAccessory}
      </div>
    </div>
  )
}
