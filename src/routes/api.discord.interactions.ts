import { createFileRoute } from '@tanstack/react-router'
import { verifyKey } from 'discord-interactions'
import {
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  type APIChatInputApplicationCommandInteraction,
  type APIInteraction,
  type APIInteractionResponse,
  type APIMessageComponentInteraction,
} from 'discord-api-types/v10'
import { checkInCurrentEventParticipant, checkInEventParticipantAndPublish } from '../lib/checkIn.server'
import { DISCORD_CHECK_IN_BUTTON_PREFIX } from '../lib/discordCheckIn.server'
import { env, requireEnv } from '../lib/env'

const CHECK_IN_COMMAND_NAME = 'checkin'

export const Route = createFileRoute('/api/discord/interactions')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text()

        if (!(await verifyDiscordInteractionRequest(request, body))) {
          return new Response('Invalid Discord interaction signature', { status: 401 })
        }

        const interaction = JSON.parse(body) as APIInteraction
        return Response.json(await handleDiscordInteraction(interaction))
      },
    },
  },
  component: () => null,
})

async function handleDiscordInteraction(interaction: APIInteraction): Promise<APIInteractionResponse> {
  if (interaction.type === InteractionType.Ping) {
    return { type: InteractionResponseType.Pong }
  }

  if (interaction.type === InteractionType.MessageComponent) {
    return handleMessageComponentInteraction(interaction as APIMessageComponentInteraction)
  }

  if (interaction.type !== InteractionType.ApplicationCommand) {
    return ephemeralResponse('Unsupported interaction.')
  }

  const command = interaction as APIChatInputApplicationCommandInteraction
  if (!isConfiguredGuildInteraction(command.guild_id)) {
    return ephemeralResponse('This command is only available in the Hamma Bowl Discord server.')
  }

  if (command.data.name !== CHECK_IN_COMMAND_NAME) {
    return ephemeralResponse('Unknown command.')
  }

  const discordId = command.member?.user.id ?? command.user?.id
  if (!discordId) {
    return ephemeralResponse('Unable to identify your Discord user for check-in.')
  }

  try {
    const { message } = await checkInCurrentEventParticipant(discordId)
    return ephemeralResponse(message)
  } catch (error) {
    return ephemeralResponse(error instanceof Error ? error.message : 'Unable to check in.')
  }
}

async function handleMessageComponentInteraction(
  interaction: APIMessageComponentInteraction,
): Promise<APIInteractionResponse> {
  if (!isConfiguredGuildInteraction(interaction.guild_id)) {
    return ephemeralResponse('This button is only available in the Hamma Bowl Discord server.')
  }

  const customId = 'custom_id' in interaction.data ? interaction.data.custom_id : ''
  if (!customId.startsWith(DISCORD_CHECK_IN_BUTTON_PREFIX)) {
    return ephemeralResponse('Unsupported button.')
  }

  const eventId = customId.slice(DISCORD_CHECK_IN_BUTTON_PREFIX.length)
  const discordId = interaction.member?.user.id ?? interaction.user?.id
  if (!discordId) {
    return ephemeralResponse('Unable to identify your Discord user for check-in.')
  }

  try {
    const { message } = await checkInEventParticipantAndPublish(eventId, discordId)
    return ephemeralResponse(message)
  } catch (error) {
    return ephemeralResponse(error instanceof Error ? error.message : 'Unable to check in.')
  }
}

function isConfiguredGuildInteraction(guildId?: string | null) {
  const configuredGuildId = env('DISCORD_GUILD_ID')
  return !configuredGuildId || guildId === configuredGuildId
}

function ephemeralResponse(content: string): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content,
      flags: MessageFlags.Ephemeral,
    },
  }
}

async function verifyDiscordInteractionRequest(request: Request, body: string) {
  const signature = request.headers.get('x-signature-ed25519')
  const timestamp = request.headers.get('x-signature-timestamp')
  if (!signature || !timestamp) return false

  return verifyKey(body, signature, timestamp, requireEnv('DISCORD_INTERACTIONS_PUBLIC_KEY'))
}
