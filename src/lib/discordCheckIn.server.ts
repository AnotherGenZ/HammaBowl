import '@tanstack/react-start/server-only'

import { DiscordAPIError } from '@discordjs/rest'
import {
  ButtonStyle,
  ComponentType,
  type APIEmbed,
  type RESTPostAPIChannelMessageJSONBody,
} from 'discord-api-types/v10'
import { editDiscordChannelMessage, postDiscordChannelMessage } from './discord'
import { env } from './env'
import { createRaidHelperClient, raidHelperCheckInPingDiscordIds, raidHelperMaybeSignupCount } from './raidHelper'
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

  const signups = await createRaidHelperClient().getSignups(event.raidHelperEventId)
  const pingDiscordIds = raidHelperCheckInPingDiscordIds(signups)
  const maybeSignupCount = raidHelperMaybeSignupCount(signups)
  const messageBody = buildCheckInPromptMessage(event, maybeSignupCount)
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

  const [firstPingChunk, ...remainingPingChunks] = mentionChunks(pingDiscordIds)
  const message = await postDiscordChannelMessage(channelId, {
    ...messageBody,
    ...(event.raidHelperEventId
      ? {
          message_reference: {
            channel_id: channelId,
            message_id: event.raidHelperEventId,
            fail_if_not_exists: false,
          },
        }
      : {}),
    ...(firstPingChunk
      ? {
          content: firstPingChunk.content,
          allowed_mentions: { users: firstPingChunk.userIds, replied_user: false },
        }
      : { allowed_mentions: { replied_user: false } }),
  })

  await setEventDiscordCheckInMessage(event.id, channelId, message.id)

  for (const chunk of remainingPingChunks) {
    await postDiscordChannelMessage(channelId, {
      content: chunk.content,
      allowed_mentions: { users: chunk.userIds },
    })
  }

  return {
    posted: true,
    channelId,
    messageId: message.id,
    pingedPlayerCount: pingDiscordIds.length,
  }
}

function buildCheckInPromptMessage(
  event: HammaEvent,
  maybeSignupCount: number,
): RESTPostAPIChannelMessageJSONBody {
  return {
    embeds: [buildCheckInEmbed(event, maybeSignupCount)],
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

function buildCheckInEmbed(event: HammaEvent, maybeSignupCount: number): APIEmbed {
  const checkInWindow = getCheckInWindow(event)
  const startsAt = discordTimestamp(event.startsAt, 'F')
  const opensAt = checkInWindow.opensAt ? discordTimestamp(checkInWindow.opensAt, 't') : '15 minutes before draft'
  const closesAt = checkInWindow.closesAt ? discordTimestamp(checkInWindow.closesAt, 't') : 'event start'

  return {
    title: `${event.name} check-in`,
    description: `Press the button when you are ready for draft. Check-in is available from ${opensAt} until ${closesAt}.`,
    color: 0x47bf8f,
    fields: [
      { name: 'Accepted', value: String(event.players.length), inline: true },
      { name: 'Maybe', value: String(maybeSignupCount), inline: true },
      { name: 'Starts', value: startsAt, inline: false },
    ],
  }
}

function mentionChunks(userIds: string[]) {
  const chunks: Array<{ userIds: string[]; content: string }> = []
  let currentIds: string[] = []
  let currentMentions: string[] = []

  for (const userId of userIds) {
    const mention = `<@${userId}>`
    const nextContent = [...currentMentions, mention].join(' ')
    if (currentIds.length && (currentIds.length >= 100 || nextContent.length > 1900)) {
      chunks.push({ userIds: currentIds, content: currentMentions.join(' ') })
      currentIds = []
      currentMentions = []
    }
    currentIds.push(userId)
    currentMentions.push(mention)
  }

  if (currentIds.length) {
    chunks.push({ userIds: currentIds, content: currentMentions.join(' ') })
  }

  return chunks
}

function discordTimestamp(value: string, format: 'F' | 't') {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return value
  return `<t:${Math.floor(time / 1000)}:${format}>`
}

function isDiscordMessageNotFound(error: unknown) {
  return error instanceof DiscordAPIError && error.status === 404
}
