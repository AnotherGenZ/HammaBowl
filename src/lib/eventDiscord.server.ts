import '@tanstack/react-start/server-only'

import {
  ButtonStyle,
  ComponentType,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  MessageFlags,
  TextInputStyle,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIEmbed,
  type APIInteractionResponse,
  type APISelectMenuOption,
  type APIStringSelectComponent,
  InteractionResponseType,
} from 'discord-api-types/v10'
import { and, eq } from 'drizzle-orm'
import { db } from './db.server'
import {
  createDiscordMessageThread,
  createDiscordScheduledEvent,
  deleteDiscordChannel,
  deleteDiscordChannelMessage,
  deleteDiscordScheduledEvent,
  editDiscordScheduledEvent,
  editDiscordChannelMessage,
  postDiscordChannelMessage,
} from './discord'
import { discordTimestamp } from './discordFormatting'
import { appBaseUrl, envList } from './env'
import {
  eventDiscordMessages,
  events,
  participants,
} from './schema'
import { buildTeamLedgers, undraftedDraftEligiblePlayers } from './rules'
import {
  getEventSpecSelectionLimits,
  getNativeEventDetails,
  upsertNativeSignup,
  type NativeSignupStatus,
} from './eventSignups.server'
import type { HammaEvent } from './types'

export const EVENT_SIGNUP_BUTTON_PREFIX = 'hammabowl:event-signup:'
export const EVENT_SPEC_SELECT_PREFIX = 'hammabowl:event-specs:'
export const EVENT_CONFIG_BUTTON_PREFIX = 'hammabowl:event-config:'
export const EVENT_NOTE_BUTTON_PREFIX = 'hammabowl:event-note:'
export const EVENT_NOTE_MODAL_PREFIX = 'hammabowl:event-note-modal:'

type EventComponent =
  | { kind: 'signup'; eventId: string; status: NativeSignupStatus }
  | { kind: 'specs'; eventId: string }
  | { kind: 'config'; eventId: string }
  | { kind: 'note'; eventId: string }
  | null

type CustomButtonStyle =
  | ButtonStyle.Primary
  | ButtonStyle.Secondary
  | ButtonStyle.Success
  | ButtonStyle.Danger

type EmbedFields = NonNullable<APIEmbed['fields']>
type EventSignupEmbedState = 'open' | 'closing-soon' | 'closed'

const PUBLIC_SIGNUP_STATUSES = new Set<NativeSignupStatus>(['accepted', 'maybe', 'absent', 'removed'])
const SIGNUP_CLOSING_SOON_MS = 60 * 60_000
const SIGNUP_EMBED_COLORS: Record<EventSignupEmbedState, number> = {
  open: 0x47bf8f,
  'closing-soon': 0xe4b45e,
  closed: 0xd94f3d,
}
const signupMessageTimers = new Map<string, NodeJS.Timeout>()
const signupMessageUpdateInFlight = new Set<string>()
const signupMessageUpdatePending = new Set<string>()

export async function publishNativeEventSignupMessage(eventId: string, options: { createThread?: boolean } = {}) {
  const details = await getNativeEventDetails(eventId)
  const channelId = details.event.eventChannelId
  if (!channelId) throw new Error('Configure an event Discord channel before posting the signup message.')

  const existing = details.messages.find((message) => message.kind === 'signup')
  const now = new Date().toISOString()
  if (existing && existing.channelId === channelId) {
    const body = buildNativeEventDiscordMessage(details.event, details, discordSnowflakeTimestamp(existing.messageId) ?? now)
    await editDiscordChannelMessage(existing.channelId, existing.messageId, body)
    db.insert(eventDiscordMessages)
      .values({
        eventId,
        kind: 'signup',
        channelId: existing.channelId,
        messageId: existing.messageId,
        threadId: existing.threadId ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [eventDiscordMessages.eventId, eventDiscordMessages.kind],
        set: {
          channelId: existing.channelId,
          messageId: existing.messageId,
          threadId: existing.threadId ?? null,
          updatedAt: now,
        },
      })
      .run()
    return { posted: false, updated: true, channelId: existing.channelId, messageId: existing.messageId }
  }

  const body = buildNativeEventDiscordMessage(details.event, details, now)
  const message = await postDiscordChannelMessage(channelId, body)
  let threadId: string | undefined
  const createThread = options.createThread ?? Boolean(details.event.autoCreateSignupThread)
  if (createThread) {
    threadId = await createDiscordMessageThread(channelId, message.id, {
      name: `${details.event.name} discussion`.slice(0, 100),
      auto_archive_duration: 1440,
    }).then((thread) => thread.id).catch(() => undefined)
  }
  db.insert(eventDiscordMessages)
    .values({
      eventId,
      kind: 'signup',
      channelId,
      messageId: message.id,
      threadId: threadId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [eventDiscordMessages.eventId, eventDiscordMessages.kind],
      set: { channelId, messageId: message.id, threadId: threadId ?? null, updatedAt: now },
    })
    .run()
  return {
    posted: true,
    updated: false,
    moved: Boolean(existing && existing.channelId !== channelId),
    previousChannelId: existing?.channelId,
    channelId,
    messageId: message.id,
    threadId,
  }
}

export async function syncDiscordScheduledEvent(eventId: string) {
  const details = await getNativeEventDetails(eventId)
  const existing = details.messages.find((message) => message.kind === 'scheduled_event')
  const body = {
    name: details.event.name.slice(0, 100),
    description: details.event.eventDescription?.slice(0, 1000),
    scheduled_start_time: details.event.startsAt,
    scheduled_end_time: details.event.endsAt,
    privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
    entity_type: GuildScheduledEventEntityType.External,
    entity_metadata: { location: 'Hamma Bowl Discord' },
  }
  const scheduledEvent = existing
    ? await editDiscordScheduledEvent(existing.messageId, body)
    : await createDiscordScheduledEvent(body)
  const now = new Date().toISOString()
  db.insert(eventDiscordMessages)
    .values({
      eventId,
      kind: 'scheduled_event',
      channelId: details.event.eventChannelId ?? 'guild',
      messageId: scheduledEvent.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [eventDiscordMessages.eventId, eventDiscordMessages.kind],
      set: {
        channelId: details.event.eventChannelId ?? 'guild',
        messageId: scheduledEvent.id,
        updatedAt: now,
      },
    })
    .run()
  return { ok: true, message: existing ? 'Discord Scheduled Event updated.' : 'Discord Scheduled Event created.', scheduledEventId: scheduledEvent.id }
}

export async function updateExistingDiscordScheduledEvent(eventId: string) {
  const details = await getNativeEventDetails(eventId)
  const existing = details.messages.find((message) => message.kind === 'scheduled_event')
  if (!existing) return { updated: false, skipped: true }

  const body = {
    name: details.event.name.slice(0, 100),
    description: details.event.eventDescription?.slice(0, 1000),
    scheduled_start_time: details.event.startsAt,
    scheduled_end_time: details.event.endsAt,
    privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
    entity_type: GuildScheduledEventEntityType.External,
    entity_metadata: { location: 'Hamma Bowl Discord' },
  }
  const scheduledEvent = await editDiscordScheduledEvent(existing.messageId, body)
  const now = new Date().toISOString()
  db.update(eventDiscordMessages)
    .set({
      channelId: details.event.eventChannelId ?? 'guild',
      updatedAt: now,
    })
    .where(and(eq(eventDiscordMessages.eventId, eventId), eq(eventDiscordMessages.kind, 'scheduled_event')))
    .run()
  return { updated: true, skipped: false, scheduledEventId: scheduledEvent.id }
}

export async function deleteEventDiscordArtifacts(eventId: string) {
  const messages = db.select().from(eventDiscordMessages).where(eq(eventDiscordMessages.eventId, eventId)).all()
  const event = db.select().from(events).where(eq(events.id, eventId)).get()

  for (const message of messages) {
    if (message.threadId) {
      await deleteDiscordChannel(message.threadId).catch((error) => {
        console.warn(`Unable to delete Discord thread ${message.threadId}`, error)
      })
    }

    if (message.kind === 'scheduled_event') {
      await deleteDiscordScheduledEvent(message.messageId).catch((error) => {
        console.warn(`Unable to delete Discord scheduled event ${message.messageId}`, error)
      })
      continue
    }

    await deleteDiscordChannelMessage(message.channelId, message.messageId).catch((error) => {
      console.warn(`Unable to delete Discord message ${message.messageId}`, error)
    })
  }

  if (event?.discordCheckInMessageChannelId && event.discordCheckInMessageId) {
    await deleteDiscordChannelMessage(event.discordCheckInMessageChannelId, event.discordCheckInMessageId).catch((error) => {
      console.warn(`Unable to delete Discord check-in message ${event.discordCheckInMessageId}`, error)
    })
  }
}

export function updateNativeEventSignupMessageSoon(eventId: string) {
  signupMessageUpdatePending.add(eventId)
  const existing = signupMessageTimers.get(eventId)
  if (existing) return

  const timer = setTimeout(() => {
    signupMessageTimers.delete(eventId)
    void flushNativeEventSignupMessageUpdate(eventId)
  }, 1_500)
  timer.unref?.()
  signupMessageTimers.set(eventId, timer)
}

export async function updateExistingNativeEventSignupMessage(eventId: string) {
  const existing = db
    .select()
    .from(eventDiscordMessages)
    .where(and(eq(eventDiscordMessages.eventId, eventId), eq(eventDiscordMessages.kind, 'signup')))
    .get()
  if (!existing) return { updated: false, skipped: true }
  return publishNativeEventSignupMessage(eventId)
}

async function flushNativeEventSignupMessageUpdate(eventId: string) {
  if (signupMessageUpdateInFlight.has(eventId)) {
    updateNativeEventSignupMessageSoon(eventId)
    return
  }
  if (!signupMessageUpdatePending.delete(eventId)) return

  signupMessageUpdateInFlight.add(eventId)
  try {
    await publishNativeEventSignupMessage(eventId)
  } catch (error) {
    console.warn('Unable to update native event signup message', error)
  } finally {
    signupMessageUpdateInFlight.delete(eventId)
    if (signupMessageUpdatePending.has(eventId)) {
      updateNativeEventSignupMessageSoon(eventId)
    }
  }
}

export async function publishTeamCompositionToDiscord(event: HammaEvent) {
  const undraftedPlayers = undraftedDraftEligiblePlayers(event)
  if (undraftedPlayers.length) {
    throw new Response('Cannot publish team composition while players remain undrafted.', { status: 400 })
  }
  const channelId = event.eventChannelId
  if (!channelId) throw new Error('Configure an event Discord channel before publishing teams.')

  const existing = db
    .select()
    .from(eventDiscordMessages)
    .where(and(eq(eventDiscordMessages.eventId, event.id), eq(eventDiscordMessages.kind, 'composition')))
    .get()
  const body = {
    content: buildTeamCompositionContent(event),
    allowed_mentions: { parse: [] },
  }
  const now = new Date().toISOString()
  if (existing) {
    await editDiscordChannelMessage(existing.channelId, existing.messageId, body)
    db.update(eventDiscordMessages)
      .set({ updatedAt: now })
      .where(and(eq(eventDiscordMessages.eventId, event.id), eq(eventDiscordMessages.kind, 'composition')))
      .run()
    return { ok: true, message: `${event.name} teams updated in Discord.` }
  }

  const message = await postDiscordChannelMessage(channelId, body)
  db.insert(eventDiscordMessages)
    .values({
      eventId: event.id,
      kind: 'composition',
      channelId,
      messageId: message.id,
      updatedAt: now,
    })
    .run()
  return { ok: true, message: `${event.name} teams published to Discord.` }
}

export async function sendNativeEventTargetedMessage(eventId: string, target: string, message: string) {
  const details = await getNativeEventDetails(eventId)
  const content = message.trim()
  if (!content) throw new Error('Message is required.')
  const channelId = details.event.eventChannelId
  if (!channelId) throw new Error('Configure an event Discord channel before sending messages.')

  const discordIds = getTargetDiscordIds(details, target)
  const mentions = discordIds.map((id) => `<@${id}>`).join(' ')
  const prefix = mentions ? `${mentions}\n` : ''
  await postDiscordChannelMessage(channelId, {
    content: `${prefix}${content}`,
    allowed_mentions: { users: discordIds },
  })
  return { ok: true, message: `Message sent to ${discordIds.length || 1} target${discordIds.length === 1 ? '' : 's'}.` }
}

export async function handleNativeEventComponent(options: {
  customId: string
  discordId: string
  displayName?: string
  memberRoleIds?: string[]
  values?: string[]
}): Promise<APIInteractionResponse> {
  const parsed = parseNativeEventComponentId(options.customId)
  if (!parsed) return ephemeralResponse('Unsupported event component.')

  try {
    if (parsed.kind === 'specs') {
      const details = await upsertNativeSignup({
        eventId: parsed.eventId,
        discordId: options.discordId,
        name: options.displayName,
        status: 'accepted',
        specs: options.values ?? [],
        memberRoleIds: options.memberRoleIds,
      })
      updateNativeEventSignupMessageSoon(parsed.eventId)
      const signup = details.signups.find((item) => item.discordId === options.discordId)
      return ephemeralResponse(`Signed up for ${details.event.name}${signup?.specs.length ? ` as ${signup.specs.join(', ')}` : ''}.`)
    }

    if (parsed.kind === 'signup') {
      const details = await getNativeEventDetails(parsed.eventId)
      if (parsed.status === 'accepted' && eventHasSpecOptions(details.event)) {
        const existingSignup = details.signups.find((signup) => signup.discordId === options.discordId)
        if (!signupHasReusableSpecs(details.event, existingSignup?.specs ?? [])) {
          return specSelectResponse(parsed.eventId, options.discordId)
        }
      }
      const updatedDetails = await upsertNativeSignup({
        eventId: parsed.eventId,
        discordId: options.discordId,
        name: options.displayName,
        status: parsed.status,
        memberRoleIds: options.memberRoleIds,
      })
      updateNativeEventSignupMessageSoon(parsed.eventId)
      return ephemeralResponse(parsed.status === 'removed' ? 'Signup removed.' : `Updated ${updatedDetails.event.name} signup to ${parsed.status}.`)
    }

    if (parsed.kind === 'config') {
      return signupConfigResponse(parsed.eventId, options.discordId)
    }

    if (parsed.kind === 'note') {
      return signupNoteModalResponse(parsed.eventId)
    }
  } catch (error) {
    return ephemeralResponse(error instanceof Error ? error.message : 'Unable to update signup.')
  }

  return ephemeralResponse('Unsupported event component.')
}

export async function handleNativeEventModalSubmit(options: {
  customId: string
  discordId: string
  note: string
  displayName?: string
  memberRoleIds?: string[]
}): Promise<APIInteractionResponse> {
  if (!options.customId.startsWith(EVENT_NOTE_MODAL_PREFIX)) {
    return ephemeralResponse('Unsupported event modal.')
  }
  const eventId = options.customId.slice(EVENT_NOTE_MODAL_PREFIX.length)
  try {
    const details = await getNativeEventDetails(eventId)
    const existing = details.signups.find((signup) => signup.discordId === options.discordId)
    if (!existing) return ephemeralResponse('Sign up before adding a note.')
    await upsertNativeSignup({
      eventId,
      discordId: options.discordId,
      name: options.displayName ?? existing.name,
      status: existing.status,
      specs: existing.specs,
      note: options.note,
      memberRoleIds: options.memberRoleIds,
    })
    updateNativeEventSignupMessageSoon(eventId)
    return ephemeralResponse('Signup note saved.')
  } catch (error) {
    return ephemeralResponse(error instanceof Error ? error.message : 'Unable to save signup note.')
  }
}

export function parseNativeEventComponentId(customId: string): EventComponent {
  if (customId.startsWith(EVENT_SIGNUP_BUTTON_PREFIX)) {
    const [eventId, status] = customId.slice(EVENT_SIGNUP_BUTTON_PREFIX.length).split(':')
    if (eventId && PUBLIC_SIGNUP_STATUSES.has(status as NativeSignupStatus)) {
      return { kind: 'signup', eventId, status: status as NativeSignupStatus }
    }
  }
  if (customId.startsWith(EVENT_SPEC_SELECT_PREFIX)) {
    const eventId = customId.slice(EVENT_SPEC_SELECT_PREFIX.length)
    if (eventId) return { kind: 'specs', eventId }
  }
  if (customId.startsWith(EVENT_CONFIG_BUTTON_PREFIX)) {
    const eventId = customId.slice(EVENT_CONFIG_BUTTON_PREFIX.length)
    if (eventId) return { kind: 'config', eventId }
  }
  if (customId.startsWith(EVENT_NOTE_BUTTON_PREFIX)) {
    const eventId = customId.slice(EVENT_NOTE_BUTTON_PREFIX.length)
    if (eventId) return { kind: 'note', eventId }
  }
  return null
}

function buildNativeEventDiscordMessage(event: HammaEvent, details: Awaited<ReturnType<typeof getNativeEventDetails>>, postedAt: string) {
  return {
    content: buildMentionContent(event),
    embeds: [buildEventEmbed(event, details, postedAt)],
    components: [signupButtonRow(event.id)],
    allowed_mentions: { roles: event.mentionRoleIds ?? [] },
  }
}

function buildEventEmbed(event: HammaEvent, details: Awaited<ReturnType<typeof getNativeEventDetails>>, postedAt: string): APIEmbed {
  const signupState = getEventSignupEmbedState(event)
  const available = details.signups.filter((signup) => signup.status === 'accepted' || signup.status === 'late')
  const maybe = details.signups.filter((signup) => signup.status === 'maybe')
  const absent = details.signups.filter((signup) => signup.status === 'absent')
  const totalLimit = details.limits.find((limit) => !limit.status && !limit.specName)?.limit
  const fields: EmbedFields = [
    ...buildEventDetailFields(event, signupState, available.length, maybe.length, totalLimit),
    {
      name: `✅ Available (${formatSignupCount(available.length, totalLimit)})`,
      value: formatSignupList(available, event, 'No available signups yet.'),
      inline: true,
    },
  ]

  if (maybe.length) {
    fields.push({
      name: `❔ Maybe (${maybe.length})`,
      value: formatSignupList(maybe, event, 'No maybe signups.'),
      inline: true,
    })
  }

  if (absent.length) {
    fields.push({
      name: `❌ Absent (${absent.length})`,
      value: formatSignupList(absent, event, 'No absent signups.'),
      inline: true,
    })
  }
  fields.push(buildEventLinksField(event))

  return {
    title: event.name,
    description: buildEventEmbedDescription(event),
    color: SIGNUP_EMBED_COLORS[signupState],
    image: event.eventImageUrl ? { url: event.eventImageUrl } : undefined,
    fields,
    footer: { text: buildEventEmbedFooter(event, signupState) },
    timestamp: postedAt,
  }
}

function discordSnowflakeTimestamp(messageId: string) {
  try {
    const timestampMs = Number((BigInt(messageId) >> 22n) + 1_420_070_400_000n)
    if (!Number.isFinite(timestampMs)) return undefined
    return new Date(timestampMs).toISOString()
  } catch {
    return undefined
  }
}

function buildEventEmbedDescription(event: HammaEvent) {
  const description = event.eventDescription?.trim()
    ? truncateEmbedText(event.eventDescription.trim(), 800)
    : undefined
  return description ? truncateEmbedText(description, 4096) : undefined
}

function buildEventDetailFields(
  event: HammaEvent,
  signupState: EventSignupEmbedState,
  availableCount: number,
  maybeCount: number,
  totalLimit?: number,
): EmbedFields {
  const spacerLine = '\n\u200B'
  const timeRange = event.endsAt
    ? `${discordTimestamp(event.startsAt, 't')} - ${discordTimestamp(event.endsAt, 't')}`
    : discordTimestamp(event.startsAt, 't')
  const closeTime = buildSignupCloseTimeLines(event)
  return [
    {
      name: '\u200B',
      value: `📅 ${discordTimestamp(event.startsAt, 'D')}\n🕓 ${timeRange}${spacerLine}`,
      inline: true,
    },
    {
      name: '\u200B',
      value: `👥 ${formatHeaderSignupCount(availableCount, maybeCount, totalLimit)}\n⌛ ${discordTimestamp(event.startsAt, 'R')}${spacerLine}`,
      inline: true,
    },
    {
      name: '\u200B',
      value: `${signupState === 'closed' ? '🔒' : '🔓'} ${closeTime}${spacerLine}`,
      inline: true,
    },
  ]
}

function buildSignupCloseTimeLines(event: HammaEvent) {
  if (event.closingTime) {
    return `${discordTimestamp(event.closingTime, 'R')}\n${discordTimestamp(event.closingTime, 'f')}`
  }
  return event.phase === 'signups'
    ? 'Open until manually closed\n\u200B'
    : 'Signups closed\n\u200B'
}

function buildEventEmbedFooter(event: HammaEvent, signupState: EventSignupEmbedState) {
  if (signupState === 'closed') return 'Signups closed'
  if (signupState === 'closing-soon') return 'Signups close in under 1 hour'
  return event.phase === 'signups' ? 'Signups open' : `Event phase: ${event.phase}`
}

function getEventSignupEmbedState(event: HammaEvent, nowMs = Date.now()): EventSignupEmbedState {
  if (event.phase !== 'signups') return 'closed'
  if (!event.closingTime) return 'open'
  const closingMs = Date.parse(event.closingTime)
  if (!Number.isFinite(closingMs)) return 'open'
  if (nowMs >= closingMs) return 'closed'
  return closingMs - nowMs <= SIGNUP_CLOSING_SOON_MS ? 'closing-soon' : 'open'
}

function buildEventLinksField(event: HammaEvent): EmbedFields[number] {
  return {
    name: '\u200B',
    value: truncateEmbedText(buildEventLinks(event), 1024),
    inline: false,
  }
}

function buildEventLinks(event: HammaEvent) {
  const baseUrl = appBaseUrl().replace(/\/+$/, '')
  return [
    `[Web View](${baseUrl}/)`,
    `[Comp](${baseUrl}/draft)`,
    `[GCal](${buildGoogleCalendarUrl(event)})`,
  ].join(' | ')
}

function buildGoogleCalendarUrl(event: HammaEvent) {
  const endAt = event.endsAt ?? new Date(Date.parse(event.startsAt) + 2 * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${toGoogleCalendarDate(event.startsAt)}/${toGoogleCalendarDate(endAt)}`,
    details: truncateEmbedText(event.eventDescription ?? '', 200),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function toGoogleCalendarDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function formatSignupCount(count: number, limit?: number) {
  return limit ? `${count}/${limit}` : String(count)
}

function formatHeaderSignupCount(availableCount: number, maybeCount: number, limit?: number) {
  const available = formatSignupCount(availableCount, limit)
  return `${available} (+${maybeCount})`
}

function formatSignupList(
  signups: Awaited<ReturnType<typeof getNativeEventDetails>>['signups'],
  event: HammaEvent,
  emptyMessage: string,
) {
  if (!signups.length) return emptyMessage
  const specLabel = specEmojiLabeler(event)
  const visible = signups.slice(0, 12).map((signup, index) => {
    const specIcons = signup.specs.map(specLabel).filter(Boolean)
    const specs = specIcons.length ? ` - ${specIcons.join(' ')}` : ''
    const note = signup.note?.trim() ? ` (${truncateEmbedText(signup.note.trim(), 80)})` : ''
    return `${index + 1}. ${formatSignupDisplayName(signup, event)}${specs}${note}`
  })
  const overflow = signups.length > visible.length ? `\n...and ${signups.length - visible.length} more` : ''
  return truncateEmbedText(`${visible.join('\n')}${overflow}`, 1024)
}

function formatSignupDisplayName(
  signup: Awaited<ReturnType<typeof getNativeEventDetails>>['signups'][number],
  event: HammaEvent,
) {
  return event.embedUseDiscordMentions ? `<@${signup.discordId}>` : truncateSignupName(signup.name)
}

function truncateSignupName(name: string) {
  return truncateEmbedText(name.trim() || 'Unknown player', 32)
}

function signupButtonRow(eventId: string): APIActionRowComponent<APIButtonComponent> {
  const buttons: APIButtonComponent[] = [
    signupButton(eventId, 'accepted', 'Available', ButtonStyle.Primary, '✅'),
    signupButton(eventId, 'maybe', 'Maybe', ButtonStyle.Primary, '❔'),
    signupButton(eventId, 'absent', 'Absent', ButtonStyle.Primary, '❌'),
    configButton(eventId),
  ]
  return { type: ComponentType.ActionRow, components: buttons }
}

function signupButton(eventId: string, status: NativeSignupStatus, label: string, style: CustomButtonStyle, emoji: string): APIButtonComponent {
  return {
    type: ComponentType.Button,
    custom_id: `${EVENT_SIGNUP_BUTTON_PREFIX}${eventId}:${status}`,
    label,
    emoji: { name: emoji },
    style,
  }
}

function configButton(eventId: string): APIButtonComponent {
  return {
    type: ComponentType.Button,
    custom_id: `${EVENT_CONFIG_BUTTON_PREFIX}${eventId}`,
    emoji: { name: '⚙️' },
    style: ButtonStyle.Secondary,
  }
}

async function signupConfigResponse(eventId: string, discordId: string): Promise<APIInteractionResponse> {
  const details = await getNativeEventDetails(eventId)
  const components: Array<APIActionRowComponent<APIButtonComponent | APIStringSelectComponent>> = []
  const specRow = specSelectRow(eventId, details, discordId, {
    placeholder: 'Change your specs',
  })
  if (specRow) components.push(specRow)
  components.push({
    type: ComponentType.ActionRow,
    components: [
      noteButton(eventId),
      signupButton(eventId, 'removed', 'Cancel Signup', ButtonStyle.Danger, '🗑️'),
    ],
  })
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `Manage your signup for ${details.event.name}.`,
      flags: MessageFlags.Ephemeral,
      components,
    },
  }
}

async function specSelectResponse(eventId: string, discordId: string): Promise<APIInteractionResponse> {
  const details = await getNativeEventDetails(eventId)
  const specRow = specSelectRow(eventId, details, discordId, {
    placeholder: 'Choose your specs',
  })
  if (!specRow) return ephemeralResponse('No specs are configured for this event.')
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: 'Choose your preferred specs.',
      flags: MessageFlags.Ephemeral,
      components: [specRow],
    },
  }
}

function specSelectRow(
  eventId: string,
  details: Awaited<ReturnType<typeof getNativeEventDetails>>,
  discordId: string,
  options: { placeholder: string },
): APIActionRowComponent<APIStringSelectComponent> | undefined {
  const specs = eventSpecOptions(details.event)
  if (!specs.length) return undefined
  const specLimits = getEventSpecSelectionLimits(details.event, specs.length)
  const currentSpecNames = new Set(details.signups.find((signup) => signup.discordId === discordId)?.specs ?? [])
  const defaultSpecNames = new Set(
    specs
      .filter((spec) => currentSpecNames.has(spec.name))
      .slice(0, specLimits.maxSignupSpecs)
      .map((spec) => spec.name),
  )
  const selectOptions: APISelectMenuOption[] = specs.slice(0, 25).map((spec) => ({
    label: spec.name.slice(0, 100),
    value: spec.name.slice(0, 100),
    emoji: discordComponentEmoji(spec.emoji),
    default: defaultSpecNames.has(spec.name),
  }))
  const select: APIStringSelectComponent = {
    type: ComponentType.StringSelect,
    custom_id: `${EVENT_SPEC_SELECT_PREFIX}${eventId}`,
    placeholder: options.placeholder,
    min_values: Math.min(specLimits.minSignupSpecs, selectOptions.length),
    max_values: Math.min(Math.max(selectOptions.length, 1), specLimits.maxSignupSpecs),
    options: selectOptions,
  }
  return { type: ComponentType.ActionRow, components: [select] }
}

function eventHasSpecOptions(event: HammaEvent) {
  return eventSpecOptions(event).length > 0
}

function signupHasReusableSpecs(event: HammaEvent, specs: string[]) {
  const specOptions = eventSpecOptions(event)
  const allowedSpecs = new Set(specOptions.map((spec) => spec.name.toLowerCase()))
  const { minSignupSpecs, maxSignupSpecs } = getEventSpecSelectionLimits(event, specOptions.length)
  return specs.length >= minSignupSpecs &&
    specs.length <= maxSignupSpecs &&
    specs.every((spec) => allowedSpecs.has(spec.toLowerCase()))
}

function eventSpecOptions(event: HammaEvent): Array<{ name: string; emoji?: string }> {
  return event.availableSpecOptions?.length
    ? event.availableSpecOptions
    : (event.availableSpecs ?? []).map((name) => ({ name }))
}

function noteButton(eventId: string): APIButtonComponent {
  return {
    type: ComponentType.Button,
    custom_id: `${EVENT_NOTE_BUTTON_PREFIX}${eventId}`,
    label: 'Add/Edit Note',
    emoji: { name: '📝' },
    style: ButtonStyle.Secondary,
  }
}

function signupNoteModalResponse(eventId: string): APIInteractionResponse {
  return {
    type: InteractionResponseType.Modal,
    data: {
      custom_id: `${EVENT_NOTE_MODAL_PREFIX}${eventId}`,
      title: 'Signup note',
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: 'note',
              label: 'Note',
              style: TextInputStyle.Paragraph,
              required: false,
              max_length: 500,
            },
          ],
        },
      ],
    },
  }
}

function buildTeamCompositionContent(event: HammaEvent) {
  const ledgers = buildTeamLedgers(event)
  const sections = ledgers.map((ledger) => {
    const captain = ledger.captainPlayer ? `Captain: ${ledger.captainPlayer.name}` : 'Captain: Unassigned'
    const picks = ledger.picks
      .sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt))
      .map((pick, index) => `${index + 1}. ${pick.player.name}`)
    return `**${ledger.team.teamName}**\n${captain}\n${picks.length ? picks.join('\n') : 'No drafted players.'}`
  })
  return `# ${event.name} Teams\n${sections.join('\n\n')}`
}

function specLabeler(event: HammaEvent) {
  const labels = new Map((event.availableSpecOptions ?? []).map((spec) => [spec.name, formatSpecOption(spec)]))
  return (specName: string) => labels.get(specName) ?? specName
}

function specEmojiLabeler(event: HammaEvent) {
  const labels = new Map((event.availableSpecOptions ?? []).map((spec) => [spec.name, spec.emoji?.trim() ?? '']))
  return (specName: string) => labels.get(specName) ?? ''
}

function formatSpecOption(spec: { name: string; emoji?: string }) {
  return [spec.emoji, spec.name].filter(Boolean).join(' ')
}

function discordComponentEmoji(value?: string) {
  if (!value) return undefined
  const customEmoji = parseCustomDiscordEmoji(value)
  if (customEmoji) {
    return {
      id: customEmoji.id,
      name: customEmoji.name,
      animated: customEmoji.animated,
    }
  }
  return { name: value }
}

function parseCustomDiscordEmoji(value: string) {
  const match = value.match(/^<(?<animated>a?):(?<name>[A-Za-z0-9_]+):(?<id>\d+)>$/)
  if (!match?.groups) return null
  return {
    animated: match.groups.animated === 'a',
    name: match.groups.name,
    id: match.groups.id,
  }
}

function buildMentionContent(event: HammaEvent) {
  return event.mentionRoleIds?.length ? event.mentionRoleIds.map((roleId) => `<@&${roleId}>`).join(' ') : undefined
}

function getTargetDiscordIds(details: Awaited<ReturnType<typeof getNativeEventDetails>>, target: string) {
  const statusTargets = new Set(['accepted', 'late', 'maybe', 'absent'])
  if (target === 'signed') {
    return details.signups.filter((signup) => signup.status === 'accepted' || signup.status === 'late').map((signup) => signup.discordId)
  }
  if (target === 'admins') return envList('DISCORD_ADMIN_USER_IDS')
  if (statusTargets.has(target)) {
    return details.signups.filter((signup) => signup.status === target).map((signup) => signup.discordId)
  }
  if (target === 'unsigned') {
    const signedIds = new Set(details.signups.map((signup) => signup.discordId))
    return db.select().from(participants).all().map((participant) => participant.discordId).filter((id) => !signedIds.has(id))
  }
  return []
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

function truncateEmbedText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value
}
