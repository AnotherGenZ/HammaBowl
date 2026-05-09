import '@tanstack/react-start/server-only'

import { DiscordAPIError } from '@discordjs/rest'
import {
  ButtonStyle,
  ComponentType,
  type APIEmbed,
  type RESTPostAPIChannelMessageJSONBody,
} from 'discord-api-types/v10'
import { editDiscordChannelMessage, postDiscordChannelMessage } from './discord'
import { discordTimestamp } from './discordFormatting'
import { env } from './env'
import { getCheckInWindow } from './rules'
import { setEventDiscordCheckInMessage } from './db.server'
import type { HammaEvent } from './types'

export const DISCORD_CHECK_IN_BUTTON_PREFIX = 'hammabowl:checkin:'

interface DiscordCheckInPromptResult {
  posted: boolean
  channelId?: string
  messageId?: string
  pingedPlayerCount?: number
  reason?: string
}

export async function postDiscordCheckInPrompt(event: HammaEvent): Promise<DiscordCheckInPromptResult> {
  if (!env('DISCORD_BOT_TOKEN')) {
    return { posted: false, reason: 'Discord bot token is not configured.' }
  }

  const channelId = event.raidHelperChannelId
  if (!channelId) {
    return { posted: false, reason: 'Raid Helper event did not include a Discord channel id.' }
  }

  const messageBody = buildCheckInPromptMessage(event)
  const existingChannelId = event.discordCheckInMessageChannelId ?? channelId
  const existingMessageId = event.discordCheckInMessageId

  if (existingMessageId) {
    try {
      const message = await editDiscordChannelMessage(existingChannelId, existingMessageId, messageBody)
      return {
        posted: true,
        channelId: existingChannelId,
        messageId: message.id,
        pingedPlayerCount: 0,
      }
    } catch (error) {
      if (!isDiscordMessageNotFound(error)) throw error
    }
  }

  const message = await postCheckInMessage(channelId, event, messageBody)

  await setEventDiscordCheckInMessage(event.id, channelId, message.id)

  return {
    posted: true,
    channelId,
    messageId: message.id,
    pingedPlayerCount: 0,
  }
}

function buildCheckInPromptMessage(
  event: HammaEvent,
): RESTPostAPIChannelMessageJSONBody {
  return {
    embeds: [buildCheckInEmbed(event)],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Success,
            custom_id: `${DISCORD_CHECK_IN_BUTTON_PREFIX}${event.id}`,
            label: 'Check in',
          },
        ],
      },
    ],
  }
}

async function postCheckInMessage(
  channelId: string,
  event: HammaEvent,
  messageBody: RESTPostAPIChannelMessageJSONBody,
) {
  const body: RESTPostAPIChannelMessageJSONBody = {
    ...messageBody,
    allowed_mentions: { parse: [], replied_user: false },
  }

  if (!event.raidHelperEventId) {
    return postDiscordChannelMessage(channelId, body)
  }

  try {
    return await postDiscordChannelMessage(channelId, {
      ...body,
      message_reference: {
        channel_id: channelId,
        message_id: event.raidHelperEventId,
        fail_if_not_exists: false,
      },
    })
  } catch (error) {
    if (!isDiscordMessageReferenceFailure(error)) throw error

    console.warn('Discord rejected check-in reply reference; posting check-in without a reply.', {
      eventId: event.id,
      raidHelperEventId: event.raidHelperEventId,
      channelId,
      status: error instanceof DiscordAPIError ? error.status : undefined,
    })
    return postDiscordChannelMessage(channelId, body)
  }
}

function buildCheckInEmbed(event: HammaEvent): APIEmbed {
  const checkInWindow = getCheckInWindow(event)
  const startsAt = discordTimestamp(event.startsAt, 'F')
  const opensAt = checkInWindow.opensAt ? discordTimestamp(checkInWindow.opensAt, 'R') : '15 minutes before draft'
  const closesAt = checkInWindow.closesAt ? discordTimestamp(checkInWindow.closesAt, 't') : 'event start'

  return {
    title: `${event.name} check-in`,
    description: `Press the button when you are ready for draft. Check-in is available in ${opensAt} until ${closesAt}.`,
    color: 0x47bf8f,
    fields: [
      { name: 'Event Start', value: startsAt, inline: false },
      {
        name: 'Ratings',
        value: '[Complete your player ratings](https://hambowl.angz.dev/ratings)',
        inline: false,
      },
    ],
    footer: {
      text: 'Reminder: complete your player ratings before draft.',
    },
  }
}

function isDiscordMessageNotFound(error: unknown) {
  return error instanceof DiscordAPIError && error.status === 404
}

function isDiscordMessageReferenceFailure(error: unknown) {
  return error instanceof DiscordAPIError && [400, 403, 404].includes(error.status)
}
