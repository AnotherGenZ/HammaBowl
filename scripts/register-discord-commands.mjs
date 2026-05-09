import { REST } from '@discordjs/rest'
import { ApplicationCommandType, Routes } from 'discord-api-types/v10'

const commands = [
  {
    name: 'checkin',
    description: 'Check in for the current Hamma Bowl event.',
    type: ApplicationCommandType.ChatInput,
  },
]

const clientId = requireEnv('DISCORD_CLIENT_ID')
const guildId = requireEnv('DISCORD_GUILD_ID')
const token = requireEnv('DISCORD_BOT_TOKEN')
const rest = new REST().setToken(token)
const route = Routes.applicationGuildCommands(clientId, guildId)

for (const command of commands) {
  await rest.post(route, { body: command })
}

console.log(`Registered Discord slash commands in guild ${guildId}: ${commands.map((command) => `/${command.name}`).join(', ')}.`)

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
