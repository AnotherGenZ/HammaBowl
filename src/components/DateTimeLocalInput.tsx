import type { InputHTMLAttributes } from 'react'
import { timeZoneAbbreviation } from '../lib/format'
import { datetimeLocalFieldClass, datetimeLocalZoneClass } from '../lib/ui'

type DateTimeLocalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function DateTimeLocalInput({ value, className, ...props }: DateTimeLocalInputProps) {
  const stringValue = typeof value === 'string' ? value : ''
  const zone = timeZoneAbbreviation(stringValue || new Date())

  return (
    <div
      className={`${datetimeLocalFieldClass}${className ? ` ${className}` : ''}`}
      data-invalid={props['aria-invalid'] ? 'true' : undefined}
    >
      <input {...props} type="datetime-local" value={value} />
      <span className={datetimeLocalZoneClass} aria-label={`Local timezone: ${zone}`}>
        {zone}
      </span>
    </div>
  )
}
