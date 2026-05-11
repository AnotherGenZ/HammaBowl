import {
  CDN,
  DiscordAPIError,
  REST,
} from '@discordjs/rest'
import {
  ChannelType,
  OAuth2Routes,
  OAuth2Scopes,
  Routes,
  type APIGuildChannel,
  type APIEmoji,
  type APIGuildMember,
  type APIGuildScheduledEvent,
  type APIMessage,
  type APIRole,
  type APIUser,
  type RESTPatchAPIChannelMessageJSONBody,
  type RESTPostAPIChannelThreadsJSONBody,
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

export interface DiscordGuildChannelOption {
  id: string
  name: string
  type: number
  parentId?: string
  position?: number
}

export interface DiscordGuildRoleOption {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

export interface DiscordGuildEmojiOption {
  id: string
  name: string
  animated: boolean
  available: boolean
  guildId: string
  guildName?: string
  mention: string
  url: string
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

export async function listDiscordGuildChannels(): Promise<DiscordGuildChannelOption[]> {
  const guildId = requireEnv('DISCORD_GUILD_ID')
  const channels = await discordBotRest().get(Routes.guildChannels(guildId)) as APIGuildChannel[]
  const postableTypes = new Set<number>([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
  ])

  return channels
    .filter((channel) => postableTypes.has(channel.type))
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parent_id ?? undefined,
      position: numericPosition(channel),
    }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))
}

function numericPosition(value: unknown) {
  const record = value && typeof value === 'object' ? value as { position?: unknown } : {}
  return typeof record.position === 'number' ? record.position : undefined
}

export async function listDiscordGuildRoles(): Promise<DiscordGuildRoleOption[]> {
  const guildId = requireEnv('DISCORD_GUILD_ID')
  const roles = await discordBotRest().get(Routes.guildRoles(guildId)) as APIRole[]

  return roles
    .filter((role) => role.name !== '@everyone')
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      managed: role.managed,
    }))
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name))
}

export async function listDiscordBotGuildEmojis(): Promise<DiscordGuildEmojiOption[]> {
  const guilds = await listDiscordBotGuilds()
  const byId = new Map<string, DiscordGuildEmojiOption>()

  await Promise.all(guilds.map(async (guild) => {
    const emojis = await discordBotRest()
      .get(Routes.guildEmojis(guild.id))
      .catch((error) => {
        console.warn(`Discord emoji list failed for guild ${guild.id}`, error)
        return []
      }) as APIEmoji[]
    for (const emoji of emojis) {
      if (!emoji.id || !emoji.name) continue
      byId.set(emoji.id, {
        id: emoji.id,
        name: emoji.name,
        animated: Boolean(emoji.animated),
        available: emoji.available !== false,
        guildId: guild.id,
        guildName: guild.name,
        mention: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
        url: discordCdn.emoji(emoji.id, { extension: emoji.animated ? 'gif' : 'png' }),
      })
    }
  }))

  return Array.from(byId.values())
    .filter((emoji) => emoji.available)
    .sort((a, b) => (a.guildName ?? '').localeCompare(b.guildName ?? '') || a.name.localeCompare(b.name))
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

export async function deleteDiscordChannelMessage(channelId: string, messageId: string) {
  await discordBotRest().delete(Routes.channelMessage(channelId, messageId))
}

export async function deleteDiscordChannel(channelId: string) {
  await discordBotRest().delete(Routes.channel(channelId))
}

export async function createDiscordMessageThread(
  channelId: string,
  messageId: string,
  body: RESTPostAPIChannelThreadsJSONBody,
) {
  return discordBotRest().post(Routes.threads(channelId, messageId), { body }) as Promise<{ id: string }>
}

export async function createDiscordScheduledEvent(body: Record<string, unknown>) {
  return discordBotRest().post(
    Routes.guildScheduledEvents(requireEnv('DISCORD_GUILD_ID')),
    { body },
  ) as Promise<APIGuildScheduledEvent>
}

export async function editDiscordScheduledEvent(scheduledEventId: string, body: Record<string, unknown>) {
  return discordBotRest().patch(
    Routes.guildScheduledEvent(requireEnv('DISCORD_GUILD_ID'), scheduledEventId),
    { body },
  ) as Promise<APIGuildScheduledEvent>
}

export async function deleteDiscordScheduledEvent(scheduledEventId: string) {
  await discordBotRest().delete(Routes.guildScheduledEvent(requireEnv('DISCORD_GUILD_ID'), scheduledEventId))
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

async function listDiscordBotGuilds() {
  try {
    const guilds = await discordBotRest().get(Routes.userGuilds()) as Array<{ id?: unknown; name?: unknown }>
    const parsed = guilds
      .map((guild) => ({
        id: typeof guild.id === 'string' ? guild.id : '',
        name: typeof guild.name === 'string' ? guild.name : undefined,
      }))
      .filter((guild) => guild.id)
    if (parsed.length) return parsed
  } catch (error) {
    console.warn('Discord bot guild list failed', error)
  }

  return [{ id: requireEnv('DISCORD_GUILD_ID'), name: undefined }]
}

function discordApiRoute(url: string) {
  return new URL(url).pathname.replace(/^\/api\/v\d+/, '') as `/${string}`
}

function discordAvatarUrl(user: APIUser) {
  return user.avatar ? discordCdn.avatar(user.id, user.avatar, { size: 256 }) : null
}
