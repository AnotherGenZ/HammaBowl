import { REST } from '@discordjs/rest'
import { ApplicationCommandType, Routes } from 'discord-api-types/v10'

const command = {
  name: 'checkin',
  description: 'Check in for the current Hamma Bowl event.',
  type: ApplicationCommandType.ChatInput,
}

const clientId = requireEnv('DISCORD_CLIENT_ID')
const guildId = requireEnv('DISCORD_GUILD_ID')
const token = requireEnv('DISCORD_BOT_TOKEN')

await new REST().setToken(token).post(Routes.applicationGuildCommands(clientId, guildId), {
  body: command,
})

console.log(`Registered /${command.name} in Discord guild ${guildId}.`)

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
