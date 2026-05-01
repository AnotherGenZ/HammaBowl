import type { Role } from './types'

interface FeatureFlagUser {
  roles: Role[]
}

export function canViewHallOfLegends(user: FeatureFlagUser | null | undefined) {
  return Boolean(user?.roles.includes('admin'))
}
