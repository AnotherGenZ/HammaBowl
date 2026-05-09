import {
  CDN,
  DiscordAPIError,
  REST,
} from '@discordjs/rest'
import {
  OAuth2Routes,
  OAuth2Scopes,
  Routes,
  type APIGuildMember,
  type APIMessage,
  type APIUser,
  type RESTPatchAPIChannelMessageJSONBody,
  type RESTPostAPIChannelMessageJSONBody,
  type RESTPostOAuth2AccessTokenResult,
} from 'discord-api-types/v10'
import { env, envList, requireEnv } from './env'
import type { Role } from './types'

const discordCdn = new CDN()

export interface DiscordGuildMember {
  discordId: string
  roleIds: string[]
}

export interface DiscordSessionData {
  oauthState?: string
  discordId: string
  username: string
  displayName: string
  avatar?: string | null
  avatarUrl?: string | null
}

export function discordAuthorizeUrl(state: string, requestUrl: string) {
  const url = new URL(OAuth2Routes.authorizationURL)

  url.searchParams.set('client_id', requireEnv('DISCORD_CLIENT_ID'))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', discordRedirectUri(requestUrl))
  url.searchParams.set('scope', OAuth2Scopes.Identify)
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

  return new REST().post(discordApiRoute(OAuth2Routes.tokenURL), {
    auth: false,
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    passThroughBody: true,
  }) as Promise<RESTPostOAuth2AccessTokenResult>
}

export async function getDiscordIdentity(accessToken: string) {
  const guildId = requireEnv('DISCORD_GUILD_ID')
  const user = await discordUserRest(accessToken).get(Routes.user()) as APIUser
  const member = await discordBotRest().get(Routes.guildMember(guildId, user.id)) as APIGuildMember

  const roleIds = member.roles ?? []
  const roles = mapDiscordRoles(user.id, roleIds)

  return {
    discordId: user.id,
    username: user.username,
    displayName: member.nick ?? user.global_name ?? user.username,
    avatar: user.avatar,
    avatarUrl: member.avatar
      ? discordCdn.guildMemberAvatar(guildId, user.id, member.avatar, { size: 256 })
      : discordAvatarUrl(user),
    roleIds,
    roles,
  }
}

export async function listDiscordGuildMembers() {
  const guildId = requireEnv('DISCORD_GUILD_ID')
  const members: DiscordGuildMember[] = []
  let after = '0'

  for (;;) {
    const params = new URLSearchParams({ limit: '1000', after })
    const page = await discordBotRest().get(Routes.guildMembers(guildId), { query: params }) as APIGuildMember[]

    for (const member of page) {
      if (!member.user?.id) continue
      members.push({
        discordId: member.user.id,
        roleIds: member.roles ?? [],
      })
    }

    if (page.length < 1000) return members
    const lastMemberId = page.at(-1)?.user?.id
    if (!lastMemberId || lastMemberId === after) return members
    after = lastMemberId
  }
}

export async function postDiscordChannelMessage(
  channelId: string,
  body: RESTPostAPIChannelMessageJSONBody,
) {
  return discordBotRest().post(Routes.channelMessages(channelId), { body }) as Promise<APIMessage>
}

export async function editDiscordChannelMessage(
  channelId: string,
  messageId: string,
  body: RESTPatchAPIChannelMessageJSONBody,
) {
  return discordBotRest().patch(Routes.channelMessage(channelId, messageId), { body }) as Promise<APIMessage>
}

export function mapDiscordRoles(discordId: string, roleIds: string[]): Role[] {
  const roles = new Set<Role>(['viewer'])

  if (envList('DISCORD_ADMIN_USER_IDS').includes(discordId)) {
    roles.add('admin')
  }

  const modRoleId = env('DISCORD_MOD_ROLE_ID')
  if (modRoleId && roleIds.includes(modRoleId)) {
    roles.add('mod')
  }

  return Array.from(roles)
}

export function isDiscordGuildMemberNotFound(error: unknown) {
  return (
    error instanceof DiscordAPIError &&
    error.status === 404 &&
    /\/guilds\/\d+\/members\/\d+$/.test(error.url)
  )
}

function discordRedirectUri(requestUrl: string) {
  return new URL('/api/auth/discord/callback', new URL(requestUrl).origin).toString()
}

function discordUserRest(accessToken: string) {
  return new REST({ authPrefix: 'Bearer' }).setToken(accessToken)
}

function discordBotRest() {
  return new REST().setToken(requireEnv('DISCORD_BOT_TOKEN'))
}

function discordApiRoute(url: string) {
  return new URL(url).pathname.replace(/^\/api\/v\d+/, '') as `/${string}`
}

function discordAvatarUrl(user: APIUser) {
  return user.avatar ? discordCdn.avatar(user.id, user.avatar, { size: 256 }) : null
}
