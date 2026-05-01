import { useSession } from '@tanstack/react-start/server'
import { env, sessionPassword } from './env'
import type { DiscordSessionData } from './discord'

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

  if (!data.discordId || !data.username || !data.roles) return null
  const { isParticipantInAnyEvent } = await import('./db.server')
  const roles = new Set(data.roles)

  if (isParticipantInAnyEvent(data.discordId)) {
    roles.add('participant')
  }

  return {
    id: data.discordId,
    name: data.displayName ?? data.username,
    roles: Array.from(roles),
  }
}

export async function requireAdminSession() {
  const user = await getDiscordSessionUser()
  if (!user?.roles.includes('admin')) {
    throw new Response('Admin Discord role required', { status: 403 })
  }
  return user
}
