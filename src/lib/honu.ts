export const HONU_JAEGER_WORLD_ID = 19
export const HONU_DEFAULT_ZONE_ID = 0

export const HONU_ALERT_ZONE_OPTIONS = [
  { id: 0, label: 'Global' },
  { id: 2, label: 'Indar' },
  { id: 4, label: 'Hossin' },
  { id: 6, label: 'Amerish' },
  { id: 8, label: 'Esamir' },
  { id: 10, label: 'Nexus' },
  { id: 14, label: 'Koltyr' },
  { id: 344, label: 'Oshur' },
]

export function normalizeHonuZoneId(value: unknown, fallback = HONU_DEFAULT_ZONE_ID) {
  const zoneId = Number(value)
  if (!Number.isInteger(zoneId) || zoneId < 0) return fallback
  return zoneId
}

