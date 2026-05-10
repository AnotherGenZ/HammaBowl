import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { db } from './db.server'
import { postDiscordChannelMessage } from './discord'
import { envList } from './env'
import {
  eventDiscordMessages,
  eventRecurrences,
  eventReminders,
  eventSignups,
  events,
  participants,
} from './schema'
import { updateNativeEventSignupMessageSoon } from './eventDiscord.server'
import {
  createNativeEvent,
  getNativeEventDetails,
  isNativeEventSignupsEnabled,
} from './eventSignups.server'

const EVENT_SCHEDULER_INTERVAL_MS = 60_000
const SIGNUP_CLOSING_SOON_MS = 60 * 60_000
let schedulerStarted = false

export function ensureNativeEventScheduler() {
  if (schedulerStarted || typeof window !== 'undefined' || !isNativeEventSignupsEnabled()) return

  schedulerStarted = true
  void runNativeEventSchedulerTick().catch((error) => console.error(error))
  const timer = setInterval(() => {
    void runNativeEventSchedulerTick().catch((error) => console.error(error))
  }, EVENT_SCHEDULER_INTERVAL_MS)
  timer.unref?.()
}

export async function runNativeEventSchedulerTick(now = new Date()) {
  await materializeDueRecurrences(now)
  await sendDueEventReminders(now)
  refreshSignupEmbedColorTransitions(now)
}

function refreshSignupEmbedColorTransitions(now: Date) {
  const nowMs = now.getTime()
  const signupMessages = db.select().from(eventDiscordMessages).where(eq(eventDiscordMessages.kind, 'signup')).all()
  for (const message of signupMessages) {
    const event = db.select().from(events).where(eq(events.id, message.eventId)).get()
    if (!event || event.source !== 'native') continue

    const lastUpdatedMs = Date.parse(message.updatedAt)
    if (!Number.isFinite(lastUpdatedMs)) {
      updateNativeEventSignupMessageSoon(event.id)
      continue
    }

    const transitionTimes = signupEmbedColorTransitionTimes(event)
    if (transitionTimes.some((transitionMs) => lastUpdatedMs < transitionMs && nowMs >= transitionMs)) {
      updateNativeEventSignupMessageSoon(event.id)
    }
  }
}

function signupEmbedColorTransitionTimes(event: { phase: string; updatedAt: string; closingTime: string | null }) {
  const transitions: number[] = []
  if (event.phase !== 'signups') {
    const phaseChangedAt = Date.parse(event.updatedAt)
    if (Number.isFinite(phaseChangedAt)) transitions.push(phaseChangedAt)
  }
  if (event.closingTime) {
    const closingMs = Date.parse(event.closingTime)
    if (Number.isFinite(closingMs)) {
      transitions.push(closingMs - SIGNUP_CLOSING_SOON_MS, closingMs)
    }
  }
  return transitions
}

async function sendDueEventReminders(now: Date) {
  const nowMs = now.getTime()
  const reminders = db.select().from(eventReminders).all().filter((reminder) => reminder.enabled && !reminder.lastSentAt)
  for (const reminder of reminders) {
    const event = db.select().from(events).where(eq(events.id, reminder.eventId)).get()
    if (!event || event.source !== 'native') continue

    const baseAt = reminder.kind === 'signup_close'
      ? event.closingTime
      : event.startsAt
    if (!baseAt) continue

    const dueAt = Date.parse(baseAt) - reminder.offsetMinutes * 60_000
    if (!Number.isFinite(dueAt) || nowMs < dueAt) continue

    try {
      const channelId = reminder.channelId || event.raidHelperChannelId
      if (!channelId) continue
      const details = await getNativeEventDetails(event.id)
      const targetIds = reminder.target === 'event_channel' || reminder.target === 'event_thread'
        ? []
        : getReminderTargetDiscordIds(details, reminder.target)
      const mentions = targetIds.map((discordId) => `<@${discordId}>`).join(' ')
      const content = [
        mentions,
        reminder.message || defaultReminderMessage(event.name, reminder.kind),
      ].filter(Boolean).join('\n')
      await postDiscordChannelMessage(channelId, {
        content,
        allowed_mentions: { users: targetIds },
      })
      db.update(eventReminders)
        .set({ lastSentAt: now.toISOString() })
        .where(eq(eventReminders.id, reminder.id))
        .run()
    } catch (error) {
      console.warn('Unable to send native event reminder', {
        reminderId: reminder.id,
        eventId: reminder.eventId,
        error,
      })
    }
  }
}

async function materializeDueRecurrences(now: Date) {
  const recurrences = db.select().from(eventRecurrences).all().filter((recurrence) => recurrence.enabled)
  for (const recurrence of recurrences) {
    const nextPostMs = Date.parse(recurrence.nextPostAt)
    if (!Number.isFinite(nextPostMs) || now.getTime() < nextPostMs) continue

    const template = db.select().from(events).where(eq(events.id, recurrence.templateEventId)).get()
    if (!template || template.source !== 'native') continue

    try {
      const durationMinutes = template.endsAt
        ? Math.max(1, Math.round((Date.parse(template.endsAt) - Date.parse(template.startsAt)) / 60_000))
        : 120
      const closingDelta = template.closingTime
        ? Date.parse(template.startsAt) - Date.parse(template.closingTime)
        : 60 * 60_000
      const nextStartsAt = recurrence.nextPostAt
      const details = await getNativeEventDetails(template.id)
      await createNativeEvent({
        name: template.name,
        startsAt: nextStartsAt,
        durationMinutes,
        closingTime: new Date(Date.parse(nextStartsAt) - closingDelta).toISOString(),
        server: template.server,
        channelId: template.raidHelperChannelId ?? undefined,
        description: template.eventDescription ?? undefined,
        color: template.eventColor ?? undefined,
        imageUrl: template.eventImageUrl ?? undefined,
        mentionRoleIds: details.event.mentionRoleIds,
        embedUseDiscordMentions: details.event.embedUseDiscordMentions,
        autoCreateSignupThread: details.event.autoCreateSignupThread,
        minSignupSpecs: details.event.minSignupSpecs,
        maxSignupSpecs: details.event.maxSignupSpecs,
        specs: details.event.availableSpecs,
        allowedRoleIds: details.roleGates.allowedRoleIds,
        bannedRoleIds: details.roleGates.bannedRoleIds,
        reminders: details.reminders,
      }, 'scheduler')

      const nextPostAt = new Date(nextPostMs + recurrence.intervalDays * 24 * 60 * 60_000).toISOString()
      db.update(eventRecurrences)
        .set({ nextPostAt })
        .where(eq(eventRecurrences.id, recurrence.id))
        .run()
    } catch (error) {
      console.warn('Unable to materialize native event recurrence', {
        recurrenceId: recurrence.id,
        eventId: recurrence.templateEventId,
        error,
      })
    }
  }
}

function getReminderTargetDiscordIds(
  details: Awaited<ReturnType<typeof getNativeEventDetails>>,
  target: string,
) {
  if (target === 'admins') return envList('DISCORD_ADMIN_USER_IDS')
  if (target === 'signed') {
    return details.signups.filter((signup) => signup.status === 'accepted' || signup.status === 'late').map((signup) => signup.discordId)
  }
  if (target === 'maybe' || target === 'bench') {
    return details.signups.filter((signup) => signup.status === target).map((signup) => signup.discordId)
  }
  if (target === 'maybe_bench') {
    return details.signups.filter((signup) => signup.status === 'maybe' || signup.status === 'bench').map((signup) => signup.discordId)
  }
  if (target === 'unsigned') {
    const signedIds = new Set(details.signups.map((signup) => signup.discordId))
    return db.select().from(participants).all().map((participant) => participant.discordId).filter((id) => !signedIds.has(id))
  }
  return []
}

function defaultReminderMessage(eventName: string, kind: string) {
  return kind === 'signup_close'
    ? `${eventName} signups close soon.`
    : `${eventName} starts soon.`
}
