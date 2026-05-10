import type { InputHTMLAttributes } from 'react'
import { timeZoneAbbreviation } from '../lib/format'

type DateTimeLocalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function DateTimeLocalInput({ value, className, ...props }: DateTimeLocalInputProps) {
  const stringValue = typeof value === 'string' ? value : ''
  const zone = timeZoneAbbreviation(stringValue || new Date())

  return (
    <div
      className={`datetime-local-field${className ? ` ${className}` : ''}`}
      data-invalid={props['aria-invalid'] ? 'true' : undefined}
    >
      <input {...props} type="datetime-local" value={value} />
      <span className="datetime-local-zone" aria-label={`Local timezone: ${zone}`}>
        {zone}
      </span>
    </div>
  )
}
