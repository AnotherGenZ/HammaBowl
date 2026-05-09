import { useSession } from '@tanstack/react-start/server'
import { env, sessionPassword } from './env'
import type { DiscordSessionData } from './discord'
import { listDiscordGuildMembers, mapDiscordRoles } from './discord'

const SESSION_NAME = 'hammabowl'
const DEFAULT_DISCORD_ROLE_REFRESH_INTERVAL_MS = 15 * 60 * 1000

let discordGuildMemberRoleRefreshPromise: Promise<void> | null = null
let discordGuildMemberRoleRefreshFailedAt = 0

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
  await refreshDiscordGuildMemberRolesIfStale().catch((error) => {
    console.warn(
      `Unable to refresh Discord guild member roles: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  })
  const { isParticipantInAnyEvent } = await import('./db.server')
  const { hasCompletePlayerCharacters } = await import('./db.server')
  const { syncSystemBadgeAssignmentsForUser } = await import('./db.server')
  const { getParticipantGroupTag } = await import('./db.server')
  const { getParticipantGroupTagColor } = await import('./db.server')
  const { getParticipantDiscordRoleIds } = await import('./db.server')
  const roleIds = getParticipantDiscordRoleIds(data.discordId)
  const roles = new Set(mapDiscordRoles(data.discordId, roleIds))

  if (isParticipantInAnyEvent(data.discordId)) {
    roles.add('participant')
  }

  syncSystemBadgeAssignmentsForUser(data.discordId, Array.from(roles))

  return {
    id: data.discordId,
    name: data.displayName ?? data.username,
    groupTag: getParticipantGroupTag(data.discordId),
    groupTagColor: getParticipantGroupTagColor(data.discordId),
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

async function refreshDiscordGuildMemberRolesIfStale() {
  const intervalMs = discordRoleRefreshIntervalMs()
  const now = Date.now()

  if (discordGuildMemberRoleRefreshFailedAt && now - discordGuildMemberRoleRefreshFailedAt < intervalMs) {
    return
  }

  const { getLastDiscordGuildMemberRoleRefreshAt } = await import('./db.server')
  const lastRefreshAt = Date.parse(getLastDiscordGuildMemberRoleRefreshAt() ?? '')
  if (Number.isFinite(lastRefreshAt) && now - lastRefreshAt < intervalMs) {
    return
  }

  if (!discordGuildMemberRoleRefreshPromise) {
    discordGuildMemberRoleRefreshPromise = refreshDiscordGuildMemberRoles()
      .catch((error) => {
        discordGuildMemberRoleRefreshFailedAt = Date.now()
        throw error
      })
      .finally(() => {
        discordGuildMemberRoleRefreshPromise = null
      })
  }

  await discordGuildMemberRoleRefreshPromise
}

async function refreshDiscordGuildMemberRoles() {
  const { replaceKnownParticipantDiscordRoleIds } = await import('./db.server')
  const members = await listDiscordGuildMembers()
  replaceKnownParticipantDiscordRoleIds(members)
  discordGuildMemberRoleRefreshFailedAt = 0
}

function discordRoleRefreshIntervalMs() {
  const seconds = Number(env('DISCORD_ROLE_REFRESH_INTERVAL_SECONDS', '900'))
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_DISCORD_ROLE_REFRESH_INTERVAL_MS
  }
  return seconds * 1000
}
