export type DiscordTimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 's' | 'S' | 'R'

export function discordTimestamp(value: string, style: DiscordTimestampStyle) {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return value
  return `<t:${Math.floor(time / 1000)}:${style}>`
}
