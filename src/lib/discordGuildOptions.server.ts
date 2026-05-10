import '@tanstack/react-start/server-only'

import { env } from './env'
import {
  listDiscordBotGuildEmojis,
  listDiscordGuildChannels,
  listDiscordGuildRoles,
  type DiscordGuildChannelOption,
  type DiscordGuildEmojiOption,
  type DiscordGuildRoleOption,
} from './discord'
import { getAppSetting, setAppSetting } from './db.server'

const DISCORD_GUILD_OPTIONS_CACHE_KEY = 'discord_guild_options_cache'
const DEFAULT_DISCORD_GUILD_OPTIONS_CACHE_MS = 60 * 60 * 1000

export interface DiscordGuildOptions {
  channels: DiscordGuildChannelOption[]
  roles: DiscordGuildRoleOption[]
  emojis: DiscordGuildEmojiOption[]
  refreshedAt?: string
  stale?: boolean
}

interface CachedDiscordGuildOptions extends DiscordGuildOptions {
  refreshedAt: string
}

export async function getCachedDiscordGuildOptions(options: { force?: boolean } = {}): Promise<DiscordGuildOptions> {
  const cached = readCachedOptions()
  if (!options.force && cached && !isCacheStale(cached.refreshedAt)) {
    return cached
  }

  try {
    const [channels, roles, emojis] = await Promise.all([
      listDiscordGuildChannels(),
      listDiscordGuildRoles(),
      listDiscordBotGuildEmojis(),
    ])
    const refreshed: CachedDiscordGuildOptions = {
      channels,
      roles,
      emojis,
      refreshedAt: new Date().toISOString(),
    }
    setAppSetting(DISCORD_GUILD_OPTIONS_CACHE_KEY, JSON.stringify(refreshed))
    return refreshed
  } catch (error) {
    if (cached) return { ...cached, stale: true }
    throw error
  }
}

function readCachedOptions(): CachedDiscordGuildOptions | null {
  const value = getAppSetting(DISCORD_GUILD_OPTIONS_CACHE_KEY)
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<CachedDiscordGuildOptions>
    return {
      channels: Array.isArray(parsed.channels) ? parsed.channels.filter(isChannelOption) : [],
      roles: Array.isArray(parsed.roles) ? parsed.roles.filter(isRoleOption) : [],
      emojis: Array.isArray(parsed.emojis) ? parsed.emojis.filter(isEmojiOption) : [],
      refreshedAt: typeof parsed.refreshedAt === 'string' ? parsed.refreshedAt : '',
    }
  } catch {
    return null
  }
}

function isCacheStale(refreshedAt: string) {
  const refreshedAtMs = Date.parse(refreshedAt)
  return !Number.isFinite(refreshedAtMs) || Date.now() - refreshedAtMs >= cacheMs()
}

function cacheMs() {
  const seconds = Number(env('DISCORD_GUILD_OPTIONS_CACHE_SECONDS', '3600'))
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_DISCORD_GUILD_OPTIONS_CACHE_MS
  return seconds * 1000
}

function isChannelOption(value: unknown): value is DiscordGuildChannelOption {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return typeof record.id === 'string' && typeof record.name === 'string'
}

function isRoleOption(value: unknown): value is DiscordGuildRoleOption {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return typeof record.id === 'string' && typeof record.name === 'string'
}

function isEmojiOption(value: unknown): value is DiscordGuildEmojiOption {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.mention === 'string' &&
    typeof record.url === 'string'
  )
}
