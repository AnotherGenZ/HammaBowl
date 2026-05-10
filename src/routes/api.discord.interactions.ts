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
  type APIModalSubmitInteraction,
} from 'discord-api-types/v10'
import { eq } from 'drizzle-orm'
import { checkInCurrentEventParticipant, checkInEventParticipantAndPublish } from '../lib/checkIn.server'
import { CHECK_IN_COMMAND_NAME, EVENT_COMMAND_NAME } from '../lib/discordCommands'
import { DISCORD_CHECK_IN_BUTTON_PREFIX } from '../lib/discordCheckIn.server'
import { db } from '../lib/db.server'
import { eventSignups, participants } from '../lib/schema'
import { env, envList, requireEnv } from '../lib/env'
import { getCurrentEvent } from '../lib/services'
import {
  EVENT_CONFIG_BUTTON_PREFIX,
  EVENT_NOTE_BUTTON_PREFIX,
  EVENT_NOTE_MODAL_PREFIX,
  EVENT_SIGNUP_BUTTON_PREFIX,
  EVENT_SPEC_SELECT_PREFIX,
  handleNativeEventComponent,
  handleNativeEventModalSubmit,
} from '../lib/eventDiscord.server'

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

  if (interaction.type === InteractionType.ModalSubmit) {
    return handleModalSubmitInteraction(interaction as APIModalSubmitInteraction)
  }

  if (interaction.type !== InteractionType.ApplicationCommand) {
    return ephemeralResponse('Unsupported interaction.')
  }

  const command = interaction as APIChatInputApplicationCommandInteraction
  if (!isConfiguredGuildInteraction(command.guild_id)) {
    return ephemeralResponse('This command is only available in the Hamma Bowl Discord server.')
  }

  const discordId = command.member?.user.id ?? command.user?.id
  if (!discordId) {
    return ephemeralResponse('Unable to identify your Discord user.')
  }

  if (command.data.name === EVENT_COMMAND_NAME) {
    return handleEventCommandInteraction(command, discordId)
  }

  if (command.data.name !== CHECK_IN_COMMAND_NAME) {
    return ephemeralResponse('Unknown command.')
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
  const discordId = interaction.member?.user.id ?? interaction.user?.id
  if (!discordId) {
    return ephemeralResponse('Unable to identify your Discord user.')
  }

  if (
    customId.startsWith(EVENT_SIGNUP_BUTTON_PREFIX) ||
    customId.startsWith(EVENT_SPEC_SELECT_PREFIX) ||
    customId.startsWith(EVENT_CONFIG_BUTTON_PREFIX) ||
    customId.startsWith(EVENT_NOTE_BUTTON_PREFIX)
  ) {
    return handleNativeEventComponent({
      customId,
      discordId,
      displayName: interaction.member?.nick ?? interaction.member?.user?.global_name ?? interaction.member?.user?.username ?? interaction.user?.global_name ?? interaction.user?.username,
      memberRoleIds: interaction.member?.roles ?? [],
      values: 'values' in interaction.data && Array.isArray(interaction.data.values)
        ? interaction.data.values.filter((value): value is string => typeof value === 'string')
        : undefined,
    })
  }

  if (!customId.startsWith(DISCORD_CHECK_IN_BUTTON_PREFIX)) {
    return ephemeralResponse('Unsupported button.')
  }

  const eventId = customId.slice(DISCORD_CHECK_IN_BUTTON_PREFIX.length)

  try {
    const { message } = await checkInEventParticipantAndPublish(eventId, discordId)
    return ephemeralResponse(message)
  } catch (error) {
    return ephemeralResponse(error instanceof Error ? error.message : 'Unable to check in.')
  }
}

async function handleModalSubmitInteraction(
  interaction: APIModalSubmitInteraction,
): Promise<APIInteractionResponse> {
  if (!isConfiguredGuildInteraction(interaction.guild_id)) {
    return ephemeralResponse('This modal is only available in the Hamma Bowl Discord server.')
  }

  const customId = interaction.data.custom_id
  const discordId = interaction.member?.user.id ?? interaction.user?.id
  if (!discordId) {
    return ephemeralResponse('Unable to identify your Discord user.')
  }
  if (!customId.startsWith(EVENT_NOTE_MODAL_PREFIX)) {
    return ephemeralResponse('Unsupported modal.')
  }

  return handleNativeEventModalSubmit({
    customId,
    discordId,
    displayName: interaction.member?.nick ?? interaction.member?.user?.global_name ?? interaction.member?.user?.username ?? interaction.user?.global_name ?? interaction.user?.username,
    memberRoleIds: interaction.member?.roles ?? [],
    note: extractModalTextValue(interaction, 'note'),
  })
}

function extractModalTextValue(interaction: APIModalSubmitInteraction, customId: string) {
  for (const row of interaction.data.components as Array<{ components?: Array<Record<string, unknown>> }>) {
    for (const component of row.components ?? []) {
      if ('custom_id' in component && component.custom_id === customId && 'value' in component) {
        return String(component.value ?? '')
      }
    }
  }
  return ''
}

async function handleEventCommandInteraction(
  command: APIChatInputApplicationCommandInteraction,
  discordId: string,
): Promise<APIInteractionResponse> {
  const event = await getCurrentEvent()
  if (!event || event.source !== 'native') return ephemeralResponse('No native event is active.')

  const subcommand = command.data.options?.[0]
  const subcommandName = subcommand?.name
  const roleIds = command.member?.roles ?? []
  const displayName = command.member?.nick ?? command.member?.user.global_name ?? command.member?.user.username ?? command.user?.global_name ?? command.user?.username

  if (subcommandName === 'signup') {
    return handleNativeEventComponent({
      customId: `${EVENT_SIGNUP_BUTTON_PREFIX}${event.id}:accepted`,
      discordId,
      displayName,
      memberRoleIds: roleIds,
    })
  }

  const isAdmin = isInteractionAdmin(discordId, roleIds)
  if (!isAdmin) return ephemeralResponse('Only admins can use this event command.')

  const { getNativeEventDetails, reopenNativeEvent, setNativeEventPhase } = await import('../lib/eventSignups.server')
  if (subcommandName === 'signed') {
    const details = await getNativeEventDetails(event.id)
    const signed = details.signups
      .filter((signup) => signup.status === 'accepted' || signup.status === 'late')
      .map((signup) => `${signup.name}${signup.specs.length ? ` (${signup.specs.join(', ')})` : ''}`)
    return ephemeralResponse(signed.length ? signed.join('\n').slice(0, 1900) : 'No signed users.')
  }

  if (subcommandName === 'unsigned') {
    const signedIds = new Set(db.select().from(eventSignups).where(eq(eventSignups.eventId, event.id)).all().map((signup) => signup.discordId))
    const unsigned = db.select().from(participants).all()
      .filter((participant) => !signedIds.has(participant.discordId))
      .map((participant) => participant.name)
      .sort((a, b) => a.localeCompare(b))
    return ephemeralResponse(unsigned.length ? unsigned.join('\n').slice(0, 1900) : 'No known unsigned users.')
  }

  if (subcommandName === 'message-signed') {
    const messageOption = subcommand && 'options' in subcommand && Array.isArray(subcommand.options)
      ? subcommand.options.find((option) => option.name === 'message')
      : undefined
    const message = messageOption && 'value' in messageOption ? String(messageOption.value ?? '') : ''
    const { sendNativeEventTargetedMessage } = await import('../lib/eventDiscord.server')
    const result = await sendNativeEventTargetedMessage(event.id, 'signed', message)
    return ephemeralResponse(result.message)
  }

  if (subcommandName === 'close') {
    await setNativeEventPhase(event.id, 'rating', discordId)
    const { updateNativeEventSignupMessageSoon } = await import('../lib/eventDiscord.server')
    updateNativeEventSignupMessageSoon(event.id)
    return ephemeralResponse('Event signups closed.')
  }

  if (subcommandName === 'open') {
    await reopenNativeEvent(event.id, discordId)
    const { updateNativeEventSignupMessageSoon } = await import('../lib/eventDiscord.server')
    updateNativeEventSignupMessageSoon(event.id)
    return ephemeralResponse('Event signups reopened.')
  }

  return ephemeralResponse('Unknown event subcommand.')
}

function isConfiguredGuildInteraction(guildId?: string | null) {
  const configuredGuildId = env('DISCORD_GUILD_ID')
  return !configuredGuildId || guildId === configuredGuildId
}

function isInteractionAdmin(discordId: string, roleIds: string[]) {
  if (envList('DISCORD_ADMIN_USER_IDS').includes(discordId)) return true
  const modRoleId = env('DISCORD_MOD_ROLE_ID')
  return Boolean(modRoleId && roleIds.includes(modRoleId))
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
