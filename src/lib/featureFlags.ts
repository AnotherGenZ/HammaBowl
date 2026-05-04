import type { Role } from './types'

interface FeatureFlagUser {
  roles: Role[]
}

export function canViewHallOfLegends(user: FeatureFlagUser | null | undefined) {
  void user
  return true
}
