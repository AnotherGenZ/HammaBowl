import { useSession } from '@tanstack/react-start/server'
import { env, sessionPassword } from './env'
import type { DiscordSessionData } from './discord'
import { mapDiscordRoles } from './discord'

const SESSION_NAME = 'hammabowl'

export async function getHammaSession() {
  return useSession<DiscordSessionData>({
    name: SESSION_NAME,
    password: sessionPassword(),
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env('NODE_ENV') === 'production',
      path: '/',
    },
  })
}

export async function getDiscordSessionUser() {
  const session = await getHammaSession()
  const data = session.data

  if (!data.discordId || !data.username) return null
  const { isParticipantInAnyEvent } = await import('./db.server')
  const { hasCompletePlayerCharacters } = await import('./db.server')
  const { syncSystemBadgeAssignmentsForUser } = await import('./db.server')
  const { updateParticipantDiscordRoleIds } = await import('./db.server')
  const roleIds = data.roleIds ?? []
  const roles = new Set(mapDiscordRoles(data.discordId, roleIds))

  if (isParticipantInAnyEvent(data.discordId)) {
    roles.add('participant')
  }

  updateParticipantDiscordRoleIds(data.discordId, roleIds)
  syncSystemBadgeAssignmentsForUser(data.discordId, Array.from(roles))

  return {
    id: data.discordId,
    name: data.displayName ?? data.username,
    avatarUrl: data.avatarUrl ?? undefined,
    profileComplete: hasCompletePlayerCharacters(data.discordId),
    roles: Array.from(roles),
  }
}

export async function requireAdminSession() {
  const user = await getDiscordSessionUser()
  if (!user?.roles.includes('admin')) {
    throw new Response('Admin access required', { status: 403 })
  }
  return user
}
