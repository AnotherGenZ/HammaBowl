import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type RESTPostAPIApplicationGuildCommandsJSONBody,
} from 'discord-api-types/v10'

export const CHECK_IN_COMMAND_NAME = 'checkin'
export const EVENT_COMMAND_NAME = 'event'

export const DISCORD_SLASH_COMMANDS: RESTPostAPIApplicationGuildCommandsJSONBody[] = [
  {
    name: CHECK_IN_COMMAND_NAME,
    description: 'Check in for the current Hamma Bowl event.',
    type: ApplicationCommandType.ChatInput,
  },
  {
    name: EVENT_COMMAND_NAME,
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
