import '@tanstack/react-start/server-only'

import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import { DISCORD_SLASH_COMMANDS } from './discordCommands'
import { env, requireEnv } from './env'

const REQUIRED_REGISTRATION_ENV = [
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'DISCORD_BOT_TOKEN',
] as const

const registrationPromiseKey = '__hammabowlDiscordSlashCommandRegistration'

type RegistrationGlobal = typeof globalThis & {
  [registrationPromiseKey]?: Promise<DiscordSlashCommandRegistrationResult>
}

export interface DiscordSlashCommandRegistrationResult {
  guildId: string
  commandNames: string[]
}

export function missingDiscordSlashCommandRegistrationEnv() {
  return REQUIRED_REGISTRATION_ENV.filter((name) => !env(name))
}

export async function registerDiscordSlashCommands(): Promise<DiscordSlashCommandRegistrationResult> {
  const clientId = requireEnv('DISCORD_CLIENT_ID')
  const guildId = requireEnv('DISCORD_GUILD_ID')
  const token = requireEnv('DISCORD_BOT_TOKEN')
  const rest = new REST().setToken(token)
  const route = Routes.applicationGuildCommands(clientId, guildId)

  for (const command of DISCORD_SLASH_COMMANDS) {
    await rest.post(route, { body: command })
  }

  return {
    guildId,
    commandNames: DISCORD_SLASH_COMMANDS.map((command) => command.name),
  }
}

export function registerDiscordSlashCommandsOnce() {
  const registrationGlobal = globalThis as RegistrationGlobal
  registrationGlobal[registrationPromiseKey] ??= registerDiscordSlashCommands()
  return registrationGlobal[registrationPromiseKey]
}
