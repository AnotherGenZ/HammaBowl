import {
  ApplicationCommandType,
  type RESTPostAPIApplicationGuildCommandsJSONBody,
} from 'discord-api-types/v10'

export const CHECK_IN_COMMAND_NAME = 'checkin'

export const DISCORD_SLASH_COMMANDS: RESTPostAPIApplicationGuildCommandsJSONBody[] = [
  {
    name: CHECK_IN_COMMAND_NAME,
    description: 'Check in for the current Hamma Bowl event.',
    type: ApplicationCommandType.ChatInput,
  },
]
