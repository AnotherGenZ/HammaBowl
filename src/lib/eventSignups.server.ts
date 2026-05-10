import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { env } from './env'
import { HONU_DEFAULT_ZONE_ID } from './honu'
import {
  BID_INCREMENT,
  BONUS_POOL,
  MAX_PLAYER_BONUS,
  SALARY_POOL,
} from './rules'
import {
  db,
  getDbEvent,
  getParticipantDiscordRoleIds,
} from './db.server'
import {
  eventAuditLog,
  eventAvailableFactions,
  eventAvailableSides,
  eventAvailableSpecs,
  eventDiscordMessages,
  eventParticipantSpecs,
  eventParticipants,
  eventRecurrences,
  eventReminders,
  eventRoleGates,
  eventSignupLimits,
  eventSignupSpecs,
  eventSignups,
  eventTemplateSpecs,
  eventTemplates,
  events,
  participants,
} from './schema'
import type { EventSpecOption, Faction, HammaEvent } from './types'

export const NATIVE_EVENT_FEATURE_FLAG = 'NATIVE_EVENT_SIGNUPS_ENABLED'

export type NativeSignupStatus = 'accepted' | 'maybe' | 'bench' | 'absent' | 'late' | 'removed'

const PROJECTED_SIGNUP_STATUSES = new Set<NativeSignupStatus>(['accepted', 'late'])
const PENDING_SIGNUP_STATUSES = new Set<NativeSignupStatus>(['maybe', 'bench'])
const ALL_SIGNUP_STATUSES = new Set<NativeSignupStatus>([
  'accepted',
  'maybe',
  'bench',
  'absent',
  'late',
  'removed',
])
const DEFAULT_EVENT_SPECS: EventSpecOption[] = [
  { emoji: '⚔️', name: 'Infantry' },
  { emoji: '✈️', name: 'Air' },
  { emoji: '🛡️', name: 'Armor' },
  { emoji: '📡', name: 'Logistics' },
  { emoji: '🔄', name: 'Flex' },
]
const DEFAULT_EVENT_DURATION_MINUTES = 120
const DEFAULT_SIGNUP_CLOSE_MINUTES_BEFORE = 60

export interface NativeEventDetails {
  event: HammaEvent
  signups: NativeEventSignup[]
  limits: NativeSignupLimit[]
  reminders: NativeEventReminder[]
  recurrences: NativeEventRecurrence[]
  messages: NativeDiscordMessage[]
  roleGates: NativeRoleGates
  auditLog: NativeAuditEntry[]
  csv: string
}

export interface NativeEventSignup {
  discordId: string
  name: string
  status: NativeSignupStatus
  lateMinutes: number
  note?: string
  specs: string[]
  createdAt: string
  updatedAt: string
  createdByDiscordId?: string
}

export interface NativeSignupLimit {
  status?: NativeSignupStatus
  specName?: string
  limit: number
}

export interface NativeEventReminder {
  id: string
  kind: string
  target: string
  offsetMinutes: number
  channelId?: string
  message?: string
  enabled: boolean
  lastSentAt?: string
}

export interface NativeEventRecurrence {
  id: string
  intervalDays: number
  postTime: string
  nextPostAt: string
  enabled: boolean
}

export interface NativeDiscordMessage {
  kind: string
  channelId: string
  messageId: string
  threadId?: string
  updatedAt: string
}

export interface NativeRoleGates {
  allowedRoleIds: string[]
  bannedRoleIds: string[]
}

export interface NativeAuditEntry {
  id: string
  actorDiscordId?: string
  action: string
  payload?: unknown
  createdAt: string
}

export function isNativeEventSignupsEnabled() {
  return env(NATIVE_EVENT_FEATURE_FLAG, 'true') !== 'false'
}

export async function createNativeEvent(values: {
  name: string
  startsAt: string
  durationMinutes?: string | number
  closingTime?: string
  server?: string
  channelId?: string
  description?: string
  color?: string
  imageUrl?: string
  mentionRoleIds?: string[] | string
  embedUseDiscordMentions?: boolean
  autoCreateSignupThread?: boolean
  allowedRoleIds?: string[] | string
  bannedRoleIds?: string[] | string
  specs?: Array<string | Partial<EventSpecOption>> | string
  signupLimit?: string | number
  specLimits?: Record<string, unknown>
  reminders?: Array<Partial<NativeEventReminder>>
  recurrenceIntervalDays?: string | number
  copySignupsFromEventId?: string
}, actorDiscordId?: string) {
  const template = getDefaultTemplate()
  const name = requireTrimmed(values.name, 'Event title is required.')
  const startsAt = normalizeDateTime(values.startsAt, 'Event time must be a valid date.')
  const durationMinutes = normalizeInteger(
    values.durationMinutes,
    template?.defaultDurationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES,
    'Duration',
    { min: 1, max: 24 * 60 },
  )
  const endsAt = new Date(Date.parse(startsAt) + durationMinutes * 60_000).toISOString()
  const closingTime = values.closingTime
    ? normalizeDateTime(values.closingTime, 'Signup close time must be a valid date.')
    : new Date(
      Date.parse(startsAt) -
      (template?.defaultSignupCloseMinutesBefore ?? DEFAULT_SIGNUP_CLOSE_MINUTES_BEFORE) * 60_000,
    ).toISOString()
  const id = `native-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const specs = normalizeSpecOptions(values.specs).length
    ? normalizeSpecOptions(values.specs)
    : getDefaultTemplateSpecs(template?.id)
  const channelId = String(values.channelId ?? template?.defaultChannelId ?? '').trim()
  const mentionRoleIds = normalizeStringList(values.mentionRoleIds)

  db.insert(events)
    .values({
      id,
      raidHelperEventId: id,
      raidHelperChannelId: channelId || null,
      source: 'native',
      name,
      server: String(values.server ?? env('HAMMABOWL_SERVER_NAME', 'Jaeger')).trim() || 'Jaeger',
      startsAt,
      endsAt,
      closingTime,
      phase: 'signups',
      salaryPool: SALARY_POOL,
      bonusPool: BONUS_POOL,
      maxPlayerBonus: MAX_PLAYER_BONUS,
      bidIncrement: BID_INCREMENT,
      pendingSignupCount: 0,
      eventDescription: String(values.description ?? '').trim() || null,
      eventColor: normalizeColor(values.color || template?.color),
      eventImageUrl: normalizeOptionalUrl(values.imageUrl),
      mentionRoleIdsJson: JSON.stringify(mentionRoleIds),
      embedUseDiscordMentions: Boolean(values.embedUseDiscordMentions),
      autoCreateSignupThread: Boolean(values.autoCreateSignupThread),
      trophyId: 'hammo-bowl-cup',
      honuZoneId: HONU_DEFAULT_ZONE_ID,
      updatedAt: now,
    })
    .run()

  replaceEventListRows(id, eventAvailableFactions, 'faction', ['VS', 'NC', 'TR'], now)
  replaceEventListRows(id, eventAvailableSides, 'side', ['north', 'south'], now)
  replaceEventSpecRows(id, specs, now)
  replaceRoleGates(id, values.allowedRoleIds, values.bannedRoleIds, now)
  replaceSignupLimits(id, buildSignupLimits(values.signupLimit, values.specLimits, specs), now)
  replaceEventReminders(id, normalizeReminderInputs(values.reminders, channelId), now)

  const recurrenceIntervalDays = normalizeOptionalInteger(
    values.recurrenceIntervalDays,
    'Recurrence interval',
    { min: 1, max: 365 },
  )
  if (recurrenceIntervalDays) {
    upsertRecurrence(id, recurrenceIntervalDays, startsAt, now)
  }

  if (values.copySignupsFromEventId) {
    copyNativeSignups(values.copySignupsFromEventId, id, actorDiscordId)
  }

  logEventAudit(id, actorDiscordId, 'event.created', { name, startsAt, channelId, specs })
  const event = await getDbEvent(id)
  if (!event) throw new Error('Native event was created but could not be loaded.')
  return event
}

export async function updateNativeEvent(values: {
  eventId: string
  name?: string
  startsAt?: string
  durationMinutes?: string | number
  closingTime?: string
  server?: string
  channelId?: string
  description?: string
  color?: string
  imageUrl?: string
  mentionRoleIds?: string[] | string
  embedUseDiscordMentions?: boolean
  autoCreateSignupThread?: boolean
  allowedRoleIds?: string[] | string
  bannedRoleIds?: string[] | string
  specs?: Array<string | Partial<EventSpecOption>> | string
  signupLimit?: string | number
  specLimits?: Record<string, unknown>
  reminders?: Array<Partial<NativeEventReminder>>
  recurrenceIntervalDays?: string | number
}, actorDiscordId?: string) {
  const existing = db.select().from(events).where(eq(events.id, values.eventId)).get()
  if (!existing) throw new Error('Event not found.')
  if (existing.source !== 'native') throw new Error('Only native events can be edited here.')

  const startsAt = values.startsAt
    ? normalizeDateTime(values.startsAt, 'Event time must be a valid date.')
    : existing.startsAt
  const durationMinutes = values.durationMinutes === undefined
    ? Math.max(1, Math.round((Date.parse(existing.endsAt ?? startsAt) - Date.parse(startsAt)) / 60_000) || DEFAULT_EVENT_DURATION_MINUTES)
    : normalizeInteger(values.durationMinutes, DEFAULT_EVENT_DURATION_MINUTES, 'Duration', { min: 1, max: 24 * 60 })
  const now = new Date().toISOString()
  const nextName = values.name === undefined ? existing.name : requireTrimmed(values.name, 'Event title is required.')
  const channelId = values.channelId === undefined
    ? existing.raidHelperChannelId
    : String(values.channelId ?? '').trim() || null

  db.update(events)
    .set({
      name: nextName,
      raidHelperChannelId: channelId,
      server: values.server?.trim() || existing.server,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + durationMinutes * 60_000).toISOString(),
      closingTime: values.closingTime === undefined
        ? existing.closingTime
        : values.closingTime
          ? normalizeDateTime(values.closingTime, 'Signup close time must be a valid date.')
          : null,
      eventDescription: values.description === undefined
        ? existing.eventDescription
        : values.description.trim() || null,
      eventColor: values.color === undefined ? existing.eventColor : normalizeColor(values.color),
      eventImageUrl: values.imageUrl === undefined ? existing.eventImageUrl : normalizeOptionalUrl(values.imageUrl),
      mentionRoleIdsJson: values.mentionRoleIds === undefined
        ? existing.mentionRoleIdsJson
        : JSON.stringify(normalizeStringList(values.mentionRoleIds)),
      embedUseDiscordMentions: values.embedUseDiscordMentions === undefined
        ? existing.embedUseDiscordMentions
        : Boolean(values.embedUseDiscordMentions),
      autoCreateSignupThread: values.autoCreateSignupThread === undefined
        ? existing.autoCreateSignupThread
        : Boolean(values.autoCreateSignupThread),
      updatedAt: now,
    })
    .where(eq(events.id, existing.id))
    .run()

  if (values.specs !== undefined) {
    replaceEventSpecRows(existing.id, normalizeSpecOptions(values.specs), now)
  }
  if (values.allowedRoleIds !== undefined || values.bannedRoleIds !== undefined) {
    replaceRoleGates(existing.id, values.allowedRoleIds, values.bannedRoleIds, now)
  }
  if (values.signupLimit !== undefined || values.specLimits !== undefined || values.specs !== undefined) {
    replaceSignupLimits(existing.id, buildSignupLimits(values.signupLimit, values.specLimits, normalizeSpecOptions(values.specs)), now)
  }
  if (values.reminders !== undefined) {
    replaceEventReminders(existing.id, normalizeReminderInputs(values.reminders, channelId ?? undefined), now)
  }
  if (values.recurrenceIntervalDays !== undefined) {
    const interval = normalizeOptionalInteger(values.recurrenceIntervalDays, 'Recurrence interval', { min: 1, max: 365 })
    if (interval) upsertRecurrence(existing.id, interval, startsAt, now)
    else db.delete(eventRecurrences).where(eq(eventRecurrences.templateEventId, existing.id)).run()
  }

  await reprojectNativeEventSignups(existing.id)
  logEventAudit(existing.id, actorDiscordId, 'event.updated', values)
  return getDbEventOrThrow(existing.id)
}

export async function duplicateNativeEvent(eventId: string, options: {
  startsAt: string
  copySignups?: boolean
}, actorDiscordId?: string) {
  const details = await getNativeEventDetails(eventId)
  const startsAt = normalizeDateTime(options.startsAt, 'New event time must be a valid date.')
  const durationMinutes = details.event.endsAt
    ? Math.max(1, Math.round((Date.parse(details.event.endsAt) - Date.parse(details.event.startsAt)) / 60_000))
    : DEFAULT_EVENT_DURATION_MINUTES
  const closingDelta = details.event.closingTime
    ? Date.parse(details.event.startsAt) - Date.parse(details.event.closingTime)
    : DEFAULT_SIGNUP_CLOSE_MINUTES_BEFORE * 60_000
  return createNativeEvent({
    name: details.event.name,
    startsAt,
    durationMinutes,
    closingTime: new Date(Date.parse(startsAt) - closingDelta).toISOString(),
    server: details.event.server,
    channelId: details.event.eventChannelId,
    description: details.event.eventDescription,
    color: details.event.eventColor,
    imageUrl: details.event.eventImageUrl,
    mentionRoleIds: details.event.mentionRoleIds,
    embedUseDiscordMentions: details.event.embedUseDiscordMentions,
    autoCreateSignupThread: details.event.autoCreateSignupThread,
    specs: details.event.availableSpecOptions ?? details.event.availableSpecs,
    allowedRoleIds: details.roleGates.allowedRoleIds,
    bannedRoleIds: details.roleGates.bannedRoleIds,
    signupLimit: details.limits.find((limit) => !limit.status && !limit.specName)?.limit,
    specLimits: Object.fromEntries(details.limits.filter((limit) => limit.specName).map((limit) => [limit.specName, limit.limit])),
    reminders: details.reminders,
    copySignupsFromEventId: options.copySignups ? eventId : undefined,
  }, actorDiscordId)
}

export async function upsertNativeSignup(values: {
  eventId: string
  discordId: string
  name?: string
  status: NativeSignupStatus | string
  specs?: string[] | string
  note?: string
  lateMinutes?: string | number
  actorDiscordId?: string
  actorIsAdmin?: boolean
  memberRoleIds?: string[]
}) {
  const event = await getDbEventOrThrow(values.eventId)
  const status = normalizeSignupStatus(values.status)
  const discordId = requireTrimmed(values.discordId, 'Discord ID is required.')
  const name = String(values.name ?? discordId).trim() || discordId
  const specs = normalizeStringList(values.specs)
  const roleIds = values.memberRoleIds ?? getParticipantDiscordRoleIds(discordId)
  validateSignup(event, { discordId, status, specs, roleIds, actorIsAdmin: values.actorIsAdmin })

  const now = new Date().toISOString()
  upsertParticipantIdentity(discordId, name, now)

  if (status === 'removed') {
    db.delete(eventSignups)
      .where(and(eq(eventSignups.eventId, event.id), eq(eventSignups.discordId, discordId)))
      .run()
    db.delete(eventSignupSpecs)
      .where(and(eq(eventSignupSpecs.eventId, event.id), eq(eventSignupSpecs.discordId, discordId)))
      .run()
  } else {
    const existing = db
      .select()
      .from(eventSignups)
      .where(and(eq(eventSignups.eventId, event.id), eq(eventSignups.discordId, discordId)))
      .get()
    db.insert(eventSignups)
      .values({
        eventId: event.id,
        discordId,
        name,
        status,
        lateMinutes: normalizeInteger(values.lateMinutes, 0, 'Late minutes', { min: 0, max: 24 * 60 }),
        note: String(values.note ?? '').trim() || null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        createdByDiscordId: values.actorDiscordId ?? discordId,
      })
      .onConflictDoUpdate({
        target: [eventSignups.eventId, eventSignups.discordId],
        set: {
          name,
          status,
          lateMinutes: normalizeInteger(values.lateMinutes, existing?.lateMinutes ?? 0, 'Late minutes', { min: 0, max: 24 * 60 }),
          note: String(values.note ?? '').trim() || null,
          updatedAt: now,
        },
      })
      .run()
    replaceSignupSpecs(event.id, discordId, specs, now)
  }

  await reprojectNativeEventSignups(event.id)
  logEventAudit(event.id, values.actorDiscordId ?? discordId, 'signup.updated', { discordId, status, specs })
  return getNativeEventDetails(event.id)
}

export async function removeNativeSignup(eventId: string, discordId: string, actorDiscordId?: string) {
  return upsertNativeSignup({
    eventId,
    discordId,
    status: 'removed',
    actorDiscordId,
    actorIsAdmin: true,
  })
}

export async function setNativeEventPhase(eventId: string, phase: HammaEvent['phase'], actorDiscordId?: string) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')
  if (event.source !== 'native') throw new Error('Only native events can be changed here.')
  const now = new Date().toISOString()
  db.update(events)
    .set({
      phase,
      closingTime: phase === 'signups' ? event.closingTime : now,
      updatedAt: now,
    })
    .where(eq(events.id, eventId))
    .run()
  logEventAudit(eventId, actorDiscordId, `event.${phase}`, {})
  return getDbEventOrThrow(eventId)
}

export async function reopenNativeEvent(eventId: string, actorDiscordId?: string) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')
  const fallbackClose = new Date(Date.parse(event.startsAt) - DEFAULT_SIGNUP_CLOSE_MINUTES_BEFORE * 60_000).toISOString()
  db.update(events)
    .set({ phase: 'signups', closingTime: event.closingTime ?? fallbackClose, updatedAt: new Date().toISOString() })
    .where(eq(events.id, eventId))
    .run()
  logEventAudit(eventId, actorDiscordId, 'event.reopened', {})
  return getDbEventOrThrow(eventId)
}

export async function getNativeEventDetails(eventId: string): Promise<NativeEventDetails> {
  const event = await getDbEventOrThrow(eventId)
  const signupRows = db.select().from(eventSignups).where(eq(eventSignups.eventId, eventId)).all()
  const specsBySignup = groupSignupSpecs(eventId)
  const signups = signupRows
    .map((signup) => ({
      discordId: signup.discordId,
      name: signup.name,
      status: normalizeSignupStatus(signup.status),
      lateMinutes: signup.lateMinutes,
      note: signup.note ?? undefined,
      specs: specsBySignup.get(signup.discordId) ?? [],
      createdAt: signup.createdAt,
      updatedAt: signup.updatedAt,
      createdByDiscordId: signup.createdByDiscordId ?? undefined,
    }))
    .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.name.localeCompare(b.name))

  const limits = db.select().from(eventSignupLimits).where(eq(eventSignupLimits.eventId, eventId)).all()
    .map((limit) => ({
      status: limit.status ? normalizeSignupStatus(limit.status) : undefined,
      specName: limit.specName || undefined,
      limit: limit.limit,
    }))
  const reminders = db.select().from(eventReminders).where(eq(eventReminders.eventId, eventId)).all()
    .map((reminder) => ({
      id: reminder.id,
      kind: reminder.kind,
      target: reminder.target,
      offsetMinutes: reminder.offsetMinutes,
      channelId: reminder.channelId ?? undefined,
      message: reminder.message ?? undefined,
      enabled: reminder.enabled,
      lastSentAt: reminder.lastSentAt ?? undefined,
    }))
  const recurrences = db.select().from(eventRecurrences).where(eq(eventRecurrences.templateEventId, eventId)).all()
    .map((recurrence) => ({
      id: recurrence.id,
      intervalDays: recurrence.intervalDays,
      postTime: recurrence.postTime,
      nextPostAt: recurrence.nextPostAt,
      enabled: recurrence.enabled,
    }))
  const messages = db.select().from(eventDiscordMessages).where(eq(eventDiscordMessages.eventId, eventId)).all()
    .map((message) => ({
      kind: message.kind,
      channelId: message.channelId,
      messageId: message.messageId,
      threadId: message.threadId ?? undefined,
      updatedAt: message.updatedAt,
    }))
  const roleRows = db.select().from(eventRoleGates).where(eq(eventRoleGates.eventId, eventId)).all()
  const auditLog = db.select().from(eventAuditLog).where(eq(eventAuditLog.eventId, eventId)).all()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 50)
    .map((entry) => ({
      id: entry.id,
      actorDiscordId: entry.actorDiscordId ?? undefined,
      action: entry.action,
      payload: parseJson(entry.payloadJson),
      createdAt: entry.createdAt,
    }))

  return {
    event,
    signups,
    limits,
    reminders,
    recurrences,
    messages,
    roleGates: {
      allowedRoleIds: roleRows.filter((row) => row.gate === 'allow').map((row) => row.roleId),
      bannedRoleIds: roleRows.filter((row) => row.gate === 'ban').map((row) => row.roleId),
    },
    auditLog,
    csv: exportSignupsCsv(signups),
  }
}

export async function reprojectNativeEventSignups(eventId: string) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event || event.source !== 'native') return

  const now = new Date().toISOString()
  const signupRows = db.select().from(eventSignups).where(eq(eventSignups.eventId, eventId)).all()
  const activeRows = signupRows.filter((signup) =>
    PROJECTED_SIGNUP_STATUSES.has(normalizeSignupStatus(signup.status)),
  )
  const activeIds = new Set(activeRows.map((signup) => signup.discordId))
  const existingParticipants = db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId)).all()

  for (const participant of existingParticipants) {
    if (activeIds.has(participant.discordId)) continue
    db.update(eventParticipants)
      .set({ status: 'disqualified', disqualified: true, updatedAt: now })
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.discordId, participant.discordId)))
      .run()
    db.delete(eventParticipantSpecs)
      .where(and(eq(eventParticipantSpecs.eventId, eventId), eq(eventParticipantSpecs.discordId, participant.discordId)))
      .run()
  }

  const signupSpecs = groupSignupSpecs(eventId)
  for (const signup of activeRows) {
    upsertParticipantIdentity(signup.discordId, signup.name, now)
    db.insert(eventParticipants)
      .values({
        eventId,
        discordId: signup.discordId,
        name: signup.name,
        status: 'signed_up',
        disqualified: false,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [eventParticipants.eventId, eventParticipants.discordId],
        set: {
          name: signup.name,
          status: 'signed_up',
          disqualified: false,
          updatedAt: now,
        },
      })
      .run()
    replaceParticipantSpecs(eventId, signup.discordId, signupSpecs.get(signup.discordId) ?? [], now)
  }

  const pendingSignupCount = signupRows.filter((signup) =>
    PENDING_SIGNUP_STATUSES.has(normalizeSignupStatus(signup.status)),
  ).length
  db.update(events)
    .set({ pendingSignupCount, updatedAt: now })
    .where(eq(events.id, eventId))
    .run()
}

export function exportSignupsCsv(signups: NativeEventSignup[]) {
  const rows = [
    ['discord_id', 'name', 'status', 'specs', 'late_minutes', 'note', 'updated_at'],
    ...signups.map((signup) => [
      signup.discordId,
      signup.name,
      signup.status,
      signup.specs.join('; '),
      String(signup.lateMinutes),
      signup.note ?? '',
      signup.updatedAt,
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function validateSignup(
  event: HammaEvent,
  values: {
    discordId: string
    status: NativeSignupStatus
    specs: string[]
    roleIds: string[]
    actorIsAdmin?: boolean
  },
) {
  if (event.source !== 'native') throw new Error('This event does not use native signups.')
  if (event.phase !== 'signups' && !values.actorIsAdmin) throw new Error('Signups are closed for this event.')
  if (!values.actorIsAdmin && event.closingTime && Date.now() >= Date.parse(event.closingTime)) {
    throw new Error('The signup window has closed.')
  }
  const roleGates = getRoleGates(event.id)
  if (!values.actorIsAdmin && roleGates.bannedRoleIds.some((roleId) => values.roleIds.includes(roleId))) {
    throw new Error('You are not eligible to sign up for this event.')
  }
  if (
    !values.actorIsAdmin &&
    roleGates.allowedRoleIds.length &&
    !roleGates.allowedRoleIds.some((roleId) => values.roleIds.includes(roleId))
  ) {
    throw new Error('You do not have a Discord role that can sign up for this event.')
  }

  const availableSpecs = event.availableSpecs ?? []
  if (values.specs.length && availableSpecs.length) {
    const allowed = new Set(availableSpecs.map((spec) => spec.toLowerCase()))
    const invalid = values.specs.find((spec) => !allowed.has(spec.toLowerCase()))
    if (invalid) throw new Error(`${invalid} is not available for this event.`)
  }
  if (PROJECTED_SIGNUP_STATUSES.has(values.status) && availableSpecs.length && !values.specs.length) {
    throw new Error('Choose at least one spec.')
  }
  assertSignupLimits(event.id, values)
}

function assertSignupLimits(eventId: string, values: {
  discordId: string
  status: NativeSignupStatus
  specs: string[]
}) {
  const limitRows = db.select().from(eventSignupLimits).where(eq(eventSignupLimits.eventId, eventId)).all()
  if (!limitRows.length || values.status === 'removed') return

  const signups = db.select().from(eventSignups).where(eq(eventSignups.eventId, eventId)).all()
    .filter((signup) => signup.discordId !== values.discordId)
  const specsBySignup = groupSignupSpecs(eventId)
  for (const limit of limitRows) {
    const statusMatches = !limit.status || normalizeSignupStatus(limit.status) === values.status
    const specMatches = !limit.specName || values.specs.includes(limit.specName)
    if (!statusMatches || !specMatches) continue

    const currentCount = signups.filter((signup) => {
      const status = normalizeSignupStatus(signup.status)
      if (limit.status && status !== normalizeSignupStatus(limit.status)) return false
      if (limit.specName && !(specsBySignup.get(signup.discordId) ?? []).includes(limit.specName)) return false
      if (!limit.status && !limit.specName) return PROJECTED_SIGNUP_STATUSES.has(status)
      return true
    }).length
    if (currentCount + 1 > limit.limit) {
      throw new Error(limit.specName ? `${limit.specName} signup limit is full.` : 'The signup limit is full.')
    }
  }
}

function copyNativeSignups(fromEventId: string, toEventId: string, actorDiscordId?: string) {
  const signups = db.select().from(eventSignups).where(eq(eventSignups.eventId, fromEventId)).all()
  const specsBySignup = groupSignupSpecs(fromEventId)
  const now = new Date().toISOString()
  for (const signup of signups) {
    db.insert(eventSignups)
      .values({
        eventId: toEventId,
        discordId: signup.discordId,
        name: signup.name,
        status: signup.status,
        lateMinutes: signup.lateMinutes,
        note: signup.note,
        createdAt: now,
        updatedAt: now,
        createdByDiscordId: actorDiscordId ?? signup.createdByDiscordId,
      })
      .onConflictDoNothing()
      .run()
    replaceSignupSpecs(toEventId, signup.discordId, specsBySignup.get(signup.discordId) ?? [], now)
  }
  void reprojectNativeEventSignups(toEventId)
}

function replaceSignupSpecs(eventId: string, discordId: string, specs: string[], updatedAt: string) {
  db.delete(eventSignupSpecs)
    .where(and(eq(eventSignupSpecs.eventId, eventId), eq(eventSignupSpecs.discordId, discordId)))
    .run()
  normalizeStringList(specs).forEach((specName, index) => {
    db.insert(eventSignupSpecs)
      .values({ eventId, discordId, specName, position: index + 1, updatedAt })
      .run()
  })
}

function replaceParticipantSpecs(eventId: string, discordId: string, specs: string[], updatedAt: string) {
  db.delete(eventParticipantSpecs)
    .where(and(eq(eventParticipantSpecs.eventId, eventId), eq(eventParticipantSpecs.discordId, discordId)))
    .run()
  normalizeStringList(specs).forEach((specName, index) => {
    db.insert(eventParticipantSpecs)
      .values({ eventId, discordId, specName, position: index + 1, updatedAt })
      .run()
  })
}

function groupSignupSpecs(eventId: string) {
  const specs = db.select().from(eventSignupSpecs).where(eq(eventSignupSpecs.eventId, eventId)).all()
  const grouped = new Map<string, Array<{ specName: string; position: number }>>()
  for (const spec of specs) {
    const list = grouped.get(spec.discordId) ?? []
    list.push({ specName: spec.specName, position: spec.position })
    grouped.set(spec.discordId, list)
  }
  return new Map(Array.from(grouped).map(([discordId, rows]) => [
    discordId,
    rows.sort((a, b) => a.position - b.position).map((row) => row.specName),
  ]))
}

function replaceSignupLimits(eventId: string, limits: NativeSignupLimit[], updatedAt: string) {
  db.delete(eventSignupLimits).where(eq(eventSignupLimits.eventId, eventId)).run()
  for (const limit of limits) {
    if (!Number.isSafeInteger(limit.limit) || limit.limit < 1) continue
    db.insert(eventSignupLimits)
      .values({
        eventId,
        status: limit.status ?? '',
        specName: limit.specName ?? '',
        limit: limit.limit,
        updatedAt,
      })
      .run()
  }
}

function buildSignupLimits(
  signupLimit?: string | number,
  specLimits?: Record<string, unknown>,
  specs?: EventSpecOption[],
): NativeSignupLimit[] {
  const limits: NativeSignupLimit[] = []
  const totalLimit = normalizeOptionalInteger(signupLimit, 'Signup limit', { min: 1, max: 500 })
  if (totalLimit) limits.push({ limit: totalLimit })

  const perSpecLimits = Object.keys(specLimits ?? {}).length
    ? specLimits ?? {}
    : Object.fromEntries((specs ?? [])
      .filter((spec) => spec.name.trim() && spec.limit !== undefined)
      .map((spec) => [spec.name, spec.limit]))

  for (const [specName, rawLimit] of Object.entries(perSpecLimits)) {
    const limit = normalizeOptionalInteger(rawLimit as string | number, `${specName} limit`, { min: 1, max: 500 })
    if (specName.trim() && limit) limits.push({ specName: specName.trim(), limit })
  }
  return limits
}

function replaceRoleGates(eventId: string, allowed?: string[] | string, banned?: string[] | string, updatedAt = new Date().toISOString()) {
  db.delete(eventRoleGates).where(eq(eventRoleGates.eventId, eventId)).run()
  for (const roleId of normalizeStringList(allowed)) {
    db.insert(eventRoleGates).values({ eventId, roleId, gate: 'allow', updatedAt }).run()
  }
  for (const roleId of normalizeStringList(banned)) {
    db.insert(eventRoleGates).values({ eventId, roleId, gate: 'ban', updatedAt }).run()
  }
}

function getRoleGates(eventId: string): NativeRoleGates {
  const rows = db.select().from(eventRoleGates).where(eq(eventRoleGates.eventId, eventId)).all()
  return {
    allowedRoleIds: rows.filter((row) => row.gate === 'allow').map((row) => row.roleId),
    bannedRoleIds: rows.filter((row) => row.gate === 'ban').map((row) => row.roleId),
  }
}

function replaceEventReminders(eventId: string, reminders: Array<Partial<NativeEventReminder>>, updatedAt: string) {
  db.delete(eventReminders).where(eq(eventReminders.eventId, eventId)).run()
  for (const reminder of reminders) {
    db.insert(eventReminders)
      .values({
        id: reminder.id || crypto.randomUUID(),
        eventId,
        kind: String(reminder.kind ?? 'event_start'),
        target: String(reminder.target ?? 'signed'),
        offsetMinutes: normalizeInteger(reminder.offsetMinutes, 60, 'Reminder offset', { min: 0, max: 30 * 24 * 60 }),
        channelId: reminder.channelId || null,
        message: reminder.message || null,
        enabled: reminder.enabled ?? true,
      })
      .run()
  }
}

function normalizeReminderInputs(reminders: Array<Partial<NativeEventReminder>> | undefined, channelId?: string | null) {
  if (reminders?.length) return reminders
  return [
    {
      kind: 'signup_close',
      target: 'unsigned',
      offsetMinutes: 120,
      channelId: channelId || undefined,
      message: 'Signups close soon.',
      enabled: true,
    },
    {
      kind: 'event_start',
      target: 'signed',
      offsetMinutes: 60,
      channelId: channelId || undefined,
      message: 'Hamma Bowl starts soon.',
      enabled: true,
    },
    {
      kind: 'event_start',
      target: 'admins',
      offsetMinutes: 30,
      channelId: channelId || undefined,
      message: 'Review signups before event start.',
      enabled: true,
    },
  ]
}

function upsertRecurrence(eventId: string, intervalDays: number, startsAt: string, updatedAt: string) {
  const nextPostAt = new Date(Date.parse(startsAt) + intervalDays * 24 * 60 * 60_000).toISOString()
  const postTime = startsAt.slice(11, 16)
  const existing = db.select().from(eventRecurrences).where(eq(eventRecurrences.templateEventId, eventId)).get()
  db.insert(eventRecurrences)
    .values({
      id: existing?.id ?? crypto.randomUUID(),
      templateEventId: eventId,
      intervalDays,
      postTime,
      nextPostAt,
      enabled: true,
    })
    .onConflictDoUpdate({
      target: eventRecurrences.id,
      set: { intervalDays, postTime, nextPostAt, enabled: true },
    })
    .run()
}

function replaceEventListRows(
  eventId: string,
  table: typeof eventAvailableFactions | typeof eventAvailableSides,
  key: 'faction' | 'side',
  values: string[],
  updatedAt: string,
) {
  db.delete(table).where(eq(table.eventId, eventId)).run()
  normalizeStringList(values).forEach((value, index) => {
    db.insert(table)
      .values({
        eventId,
        [key]: value,
        position: index + 1,
        updatedAt,
      } as never)
      .run()
  })
}

function replaceEventSpecRows(eventId: string, specs: EventSpecOption[], updatedAt: string) {
  db.delete(eventAvailableSpecs).where(eq(eventAvailableSpecs.eventId, eventId)).run()
  normalizeSpecOptions(specs).forEach((spec, index) => {
    db.insert(eventAvailableSpecs)
      .values({
        eventId,
        specName: spec.name,
        specEmoji: spec.emoji ?? null,
        position: index + 1,
        updatedAt,
      })
      .run()
  })
}

function upsertParticipantIdentity(discordId: string, name: string, updatedAt: string) {
  const existing = db.select().from(participants).where(eq(participants.discordId, discordId)).get()
  const displayName = existing?.nameOverridden ? existing.name : name
  db.insert(participants)
    .values({ discordId, name: displayName, nameOverridden: existing?.nameOverridden ?? false, updatedAt })
    .onConflictDoUpdate({
      target: participants.discordId,
      set: { name: displayName, updatedAt },
    })
    .run()
}

function getDefaultTemplate() {
  return db.select().from(eventTemplates).where(eq(eventTemplates.id, 'hamma-bowl-standard')).get()
}

function getDefaultTemplateSpecs(templateId?: string) {
  if (!templateId) return DEFAULT_EVENT_SPECS
  const specs = db.select().from(eventTemplateSpecs).where(eq(eventTemplateSpecs.templateId, templateId)).all()
    .sort((a, b) => a.position - b.position)
    .map((spec) => ({
      name: spec.specName,
      emoji: spec.specEmoji ?? undefined,
      limit: spec.defaultLimit ?? undefined,
    }))
  return specs.length ? specs : DEFAULT_EVENT_SPECS
}

async function getDbEventOrThrow(eventId: string) {
  const event = await getDbEvent(eventId)
  if (!event) throw new Error('Event not found.')
  return event
}

function logEventAudit(eventId: string, actorDiscordId: string | undefined, action: string, payload: unknown) {
  db.insert(eventAuditLog)
    .values({
      id: crypto.randomUUID(),
      eventId,
      actorDiscordId: actorDiscordId || null,
      action,
      payloadJson: JSON.stringify(payload ?? {}),
      createdAt: new Date().toISOString(),
    })
    .run()
}

function normalizeSignupStatus(value: string): NativeSignupStatus {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'signed_up') return 'accepted'
  if (ALL_SIGNUP_STATUSES.has(normalized as NativeSignupStatus)) return normalized as NativeSignupStatus
  throw new Error('Unknown signup status.')
}

function normalizeDateTime(value: string, message: string) {
  const trimmed = value.trim()
  const timestamp = Date.parse(trimmed)
  if (!trimmed || Number.isNaN(timestamp)) throw new Error(message)
  return new Date(timestamp).toISOString()
}

function normalizeOptionalInteger(value: string | number | undefined, label: string, options: { min: number; max: number }) {
  if (value === undefined || value === null || value === '') return undefined
  return normalizeInteger(value, 0, label, options)
}

function normalizeInteger(value: string | number | undefined, fallback: number, label: string, options: { min: number; max: number }) {
  if (value === undefined || value === null || value === '') return fallback
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount < options.min || amount > options.max) {
    throw new Error(`${label} must be a whole number from ${options.min} to ${options.max}.`)
  }
  return amount
}

function normalizeStringList(value: string[] | string | undefined | null) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]/)
      : []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    const trimmed = item.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

function normalizeSpecOptions(value: Array<string | Partial<EventSpecOption>> | string | undefined | null): EventSpecOption[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\n/)
      : []
  const seen = new Set<string>()
  const result: EventSpecOption[] = []
  for (const item of raw) {
    const parsed = typeof item === 'string' ? parseSpecOptionText(item) : {
      name: String(item.name ?? '').trim(),
      emoji: String(item.emoji ?? '').trim(),
      limit: normalizeOptionalInteger(item.limit as string | number | undefined, `${String(item.name ?? '').trim() || 'Spec'} limit`, { min: 1, max: 500 }),
    }
    const key = parsed.name.toLowerCase()
    if (!parsed.name || seen.has(key)) continue
    seen.add(key)
    result.push({
      name: parsed.name,
      emoji: parsed.emoji || undefined,
      limit: parsed.limit,
    })
  }
  return result
}

function parseSpecOptionText(value: string): EventSpecOption {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\S+)\s+(.+)$/)
  if (match && !/^[\w-]+$/.test(match[1] ?? '')) {
    return { emoji: match[1], name: match[2]?.trim() ?? '' }
  }
  return { name: trimmed }
}

function requireTrimmed(value: string, message: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(message)
  return trimmed
}

function normalizeColor(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed && /^#[\da-f]{6}$/i.test(trimmed) ? trimmed : null
}

function normalizeOptionalUrl(value: string | undefined | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function statusOrder(status: NativeSignupStatus) {
  return ['accepted', 'late', 'maybe', 'bench', 'absent', 'removed'].indexOf(status)
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function parseJson(value: string | null) {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}
