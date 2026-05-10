import { REST } from '@discordjs/rest'
import { ApplicationCommandOptionType, ApplicationCommandType, Routes } from 'discord-api-types/v10'

const commands = [
  {
    name: 'checkin',
    description: 'Check in for the current Hamma Bowl event.',
    type: ApplicationCommandType.ChatInput,
  },
  {
    name: 'event',
    description: 'Create and manage native Hamma Bowl events.',
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        name: 'signup',
        description: 'Sign up for the current event.',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'signed',
        description: 'List signed users for the current event.',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'unsigned',
        description: 'List unsigned known users for the current event.',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'message-signed',
        description: 'Message signed users in the event channel.',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'message',
            description: 'Message to send.',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: 'close',
        description: 'Close native event signups.',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'open',
        description: 'Reopen native event signups.',
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
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
