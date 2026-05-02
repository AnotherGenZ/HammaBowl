import { env, requireEnv } from './env'
import type { Role } from './types'

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10'
interface DiscordTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

interface DiscordUserResponse {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
}

interface DiscordGuildMemberResponse {
  nick?: string | null
  avatar?: string | null
  roles: string[]
  user?: DiscordUserResponse
}

export interface DiscordSessionData {
  oauthState?: string
  discordId: string
  username: string
  displayName: string
  avatar?: string | null
  accessToken: string
  refreshToken?: string
  roleIds: string[]
  roles: Role[]
  avatarUrl?: string | null
}

export function discordAuthorizeUrl(state: string, requestUrl: string) {
  const url = new URL('https://discord.com/oauth2/authorize')

  url.searchParams.set('client_id', requireEnv('DISCORD_CLIENT_ID'))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', discordRedirectUri(requestUrl))
  url.searchParams.set('scope', 'identify guilds.members.read')
  url.searchParams.set('state', state)

  return url.toString()
}

export async function exchangeDiscordCode(code: string, requestUrl: string) {
  const body = new URLSearchParams({
    client_id: requireEnv('DISCORD_CLIENT_ID'),
    client_secret: requireEnv('DISCORD_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    redirect_uri: discordRedirectUri(requestUrl),
  })

  const response = await fetch(`${DISCORD_API_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Discord token exchange failed: ${response.status}`)
  }

  return response.json() as Promise<DiscordTokenResponse>
}

export async function getDiscordIdentity(accessToken: string) {
  const guildId = requireEnv('DISCORD_GUILD_ID')
  const [user, member] = await Promise.all([
    discordFetch<DiscordUserResponse>('/users/@me', accessToken),
    discordFetch<DiscordGuildMemberResponse>(
      `/users/@me/guilds/${guildId}/member`,
      accessToken,
    ),
  ])

  const roleIds = member.roles ?? []
  const roles = mapDiscordRoleIds(roleIds)

  return {
    discordId: user.id,
    username: user.username,
    displayName: member.nick ?? user.global_name ?? user.username,
    avatar: user.avatar,
    avatarUrl: member.avatar
      ? discordGuildAvatarUrl(guildId, user.id, member.avatar)
      : discordAvatarUrl(user.id, user.avatar),
    roleIds,
    roles,
  }
}

export function mapDiscordRoleIds(roleIds: string[]): Role[] {
  const roles = new Set<Role>(['viewer'])

  if (roleIds.includes(env('DISCORD_ADMIN_ROLE_ID'))) {
    roles.add('admin')
  }

  return Array.from(roles)
}

function discordRedirectUri(requestUrl: string) {
  return new URL('/api/auth/discord/callback', new URL(requestUrl).origin).toString()
}

async function discordFetch<T>(path: string, accessToken: string) {
  const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Discord API request failed: ${path} ${response.status}`)
  }

  return response.json() as Promise<T>
}

function discordAvatarUrl(discordId: string, avatarHash?: string | null) {
  if (!avatarHash) return null
  const extension = avatarHash.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${extension}?size=256`
}

function discordGuildAvatarUrl(guildId: string, discordId: string, avatarHash: string) {
  const extension = avatarHash.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/guilds/${guildId}/users/${discordId}/avatars/${avatarHash}.${extension}?size=256`
}
