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

export function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function shortDateWithTimeZone(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).formatToParts(new Date(value))

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  const day = Number(part('day'))

  return `${part('month')} ${ordinal(day)}, ${part('hour')}:${part('minute')} ${part(
    'dayPeriod',
  )} ${part('timeZoneName')}`
}

function ordinal(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13
    ? 'th'
    : { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th'

  return `${value}${suffix}`
}
