export function money(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`
  }

  return `$${value.toLocaleString()}`
}

export function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`
  }

  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`
  }

  return `$${value.toLocaleString()}`
}

export function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export const HAMMA_BOWL_DEFAULT_TIME_ZONE = 'America/New_York'

export interface DateTimeFormatOptions {
  timeZone?: string
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || HAMMA_BOWL_DEFAULT_TIME_ZONE
}

export function shortDate(value: string, options: DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: options.timeZone ?? HAMMA_BOWL_DEFAULT_TIME_ZONE,
  }).format(new Date(value))
}

export function shortDateWithTimeZone(value: string | number | Date, options: DateTimeFormatOptions = {}) {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: options.timeZone ?? HAMMA_BOWL_DEFAULT_TIME_ZONE,
  }).formatToParts(new Date(value))

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  const day = Number(part('day'))

  return `${part('month')} ${ordinal(day)}, ${part('hour')}:${part('minute')} ${part(
    'dayPeriod',
  )} ${part('timeZoneName')}`
}

export function timeZoneAbbreviation(value: string | number | Date = new Date(), timeZone = browserTimeZone()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return timeZone
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? timeZone
}

export function toDatetimeLocalValue(value: string | number | Date) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function localDatetimeToIso(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function nowDatetimeLocalValue() {
  return toDatetimeLocalValue(new Date())
}

function ordinal(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13
    ? 'th'
    : { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th'

  return `${value}${suffix}`
}
