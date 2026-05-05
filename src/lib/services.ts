import { createServerOnlyFn } from '@tanstack/start-fn-stubs'
import {
  buildRaidHelperCompUpdate,
  createRaidHelperClient,
  hydrateCurrentEventsFromRaidHelper,
  isRaidHelperConfigured,
} from './raidHelper'
import { undraftedDraftEligiblePlayers } from './rules'
import type { HammaEvent, Role } from './types'

const RAID_HELPER_REFRESH_INTERVAL_MS = 10 * 60 * 1000
let eventCache: HammaEvent | null = null
let eventCacheGeneration = 0
let eventDbRefresh:
  | { generation: number; promise: Promise<HammaEvent | null> }
  | null = null
let lastRaidHelperRefreshAt = 0
let raidHelperRefreshPromise: Promise<HammaEvent | null> | null = null
let autoRefreshTimerStarted = false

export interface SessionUser {
  id: string
  name: string
  groupTag?: string
  groupTagColor?: string
  roles: Role[]
}

export async function getCurrentEvent(options: { force?: boolean } = {}): Promise<HammaEvent | null> {
  if (typeof window !== 'undefined') {
    const response = await fetch('/api/event/current')
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }

  return getCurrentEventServer(options)
}

export async function getCurrentEvents(options: { force?: boolean } = {}): Promise<HammaEvent[]> {
  if (typeof window !== 'undefined') {
    const response = await fetch('/api/event/current/events')
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }

  const event = await getCurrentEvent(options)
  const events = await getCurrentEventsFromDb()
  return events.length ? events : event ? [event] : []
}

const getCurrentEventServer = createServerOnlyFn(
  async (options: { force?: boolean } = {}): Promise<HammaEvent | null> => {
    ensureRaidHelperAutoRefresh()

    if (!options.force && eventCache && !isRaidHelperRefreshDue()) {
      return eventCache
    }

    const cacheGeneration = eventCacheGeneration
    const dbEvent = options.force ? null : await getCoalescedCurrentEventFromDb()
    if (!options.force && dbEvent && !isRaidHelperRefreshDue()) {
      if (cacheGeneration === eventCacheGeneration) {
        eventCache = dbEvent
      }
      return dbEvent
    }

    if (!options.force && raidHelperRefreshPromise) {
      return dbEvent ?? raidHelperRefreshPromise
    }

    return refreshCurrentEventFromRaidHelper({
      fallbackEvent: options.force ? null : dbEvent,
    })
  },
)

export function clearCurrentEventCache() {
  eventCacheGeneration += 1
  eventCache = null
}

export async function requireCurrentEvent(): Promise<HammaEvent> {
  const event = await getCurrentEvent()
  if (!event) throw new Response('No current Raid Helper event found.', { status: 404 })
  return event
}

export const requireEventByIdOrCurrent = createServerOnlyFn(async (eventId?: string): Promise<HammaEvent> => {
  const trimmedEventId = eventId?.trim()
  if (!trimmedEventId) return requireCurrentEvent()

  const { getDbEvent } = await import('./db.server')
  const event = await getDbEvent(trimmedEventId)
  if (!event) throw new Response('Event not found.', { status: 404 })
  return event
})

export async function getSessionUser(): Promise<SessionUser | null> {
  return null
}

export async function refreshRaidHelperEvent(): Promise<HammaEvent | null> {
  clearCurrentEventCache()
  return getCurrentEvent({ force: true })
}

const getCurrentEventFromDb = createServerOnlyFn(async () => {
  const { getCurrentDbEvent } = await import('./db.server')
  return getCurrentDbEvent()
})

function getCoalescedCurrentEventFromDb() {
  const generation = eventCacheGeneration
  if (eventDbRefresh?.generation === generation) {
    return eventDbRefresh.promise
  }

  const promise = getCurrentEventFromDb().finally(() => {
    if (eventDbRefresh?.promise === promise) {
      eventDbRefresh = null
    }
  })
  eventDbRefresh = { generation, promise }
  return promise
}

const getCurrentEventsFromDb = createServerOnlyFn(async () => {
  const { getCurrentDbEvents } = await import('./db.server')
  return getCurrentDbEvents()
})

const upsertRaidHelperEvents = createServerOnlyFn(async (events: HammaEvent[]) => {
  const { getCurrentDbEvent, upsertEventFromRaidHelper } = await import('./db.server')
  for (const event of events) {
    await upsertEventFromRaidHelper(event)
  }
  return getCurrentDbEvent()
})

function isRaidHelperRefreshDue() {
  return Date.now() - lastRaidHelperRefreshAt >= RAID_HELPER_REFRESH_INTERVAL_MS
}

function ensureRaidHelperAutoRefresh() {
  if (autoRefreshTimerStarted || typeof window !== 'undefined' || !isRaidHelperConfigured()) {
    return
  }

  autoRefreshTimerStarted = true
  const timer = setInterval(() => {
    if (!isRaidHelperRefreshDue()) return

    void getCurrentEventFromDb()
      .then((fallbackEvent) => refreshCurrentEventFromRaidHelper({ fallbackEvent }))
      .catch((error) => console.error(error))
  }, RAID_HELPER_REFRESH_INTERVAL_MS)
  timer.unref?.()
}

function refreshCurrentEventFromRaidHelper(options: {
  fallbackEvent?: HammaEvent | null
} = {}) {
  if (raidHelperRefreshPromise) return raidHelperRefreshPromise

  raidHelperRefreshPromise = (async () => {
    try {
      const events = await hydrateCurrentEventsFromRaidHelper()
      if (!events.length) {
        eventCache = options.fallbackEvent ?? null
        return options.fallbackEvent ?? null
      }

      const dbEvent = await upsertRaidHelperEvents(events)
      eventCache = dbEvent
      return dbEvent
    } catch (error) {
      console.error(error)
      eventCache = options.fallbackEvent ?? null
      return options.fallbackEvent ?? null
    } finally {
      lastRaidHelperRefreshAt = Date.now()
      raidHelperRefreshPromise = null
    }
  })()

  return raidHelperRefreshPromise
}

ensureRaidHelperAutoRefresh()

export async function syncTeamCompositionToRaidHelper(event: HammaEvent) {
  const undraftedPlayers = undraftedDraftEligiblePlayers(event)
  if (undraftedPlayers.length) {
    throw new Response('Cannot sync Raid Helper comp while players remain undrafted.', {
      status: 400,
    })
  }

  const nameSync = await syncEventParticipantNameOverridesToRaidHelper(event)
  const body = buildRaidHelperCompUpdate(event)
  console.debug('Syncing team composition to Raid Helper', JSON.stringify({
    eventId: event.id,
    raidHelperEventId: event.raidHelperEventId,
    syncedNameOverrideCount: nameSync.synced,
    teamCount: event.teams.length,
    draftPickCount: event.draftPicks.length,
    payload: body,
  }, null, 2))

  const client = createRaidHelperClient()
  await client.updateComp(event.raidHelperEventId, body)

  return {
    ok: true,
    message: `${event.name} teams synced to Raid Helper comp ${event.raidHelperEventId}`,
  }
}

export async function syncParticipantNameOverrideToRaidHelper(
  discordId: string,
  name: string,
) {
  const normalizedDiscordId = discordId.trim()
  const normalizedName = name.trim()
  if (!normalizedDiscordId || !normalizedName || !isRaidHelperConfigured()) {
    return { synced: 0 }
  }

  const currentEvents = await getCurrentEvents()
  const raidHelperEvents = currentEvents.filter((event) =>
    event.raidHelperEventId &&
    event.players.some((player) => player.id === normalizedDiscordId),
  )
  if (!raidHelperEvents.length) return { synced: 0 }

  const client = createRaidHelperClient()
  let synced = 0

  for (const event of raidHelperEvents) {
    const signups = await client.getSignups(event.raidHelperEventId)
    const signup = signups.find((item) => item.discordId === normalizedDiscordId)
    if (!signup?.signupId) {
      console.warn('Raid Helper signup not found for player rename', {
        eventId: event.id,
        raidHelperEventId: event.raidHelperEventId,
        discordId: normalizedDiscordId,
      })
      continue
    }

    await client.updateSignupName(event.raidHelperEventId, signup.signupId, normalizedName)
    synced += 1
  }

  return { synced }
}

export const syncEventParticipantNameOverridesToRaidHelper = createServerOnlyFn(async (event: HammaEvent) => {
  if (!event.raidHelperEventId || !isRaidHelperConfigured()) return { synced: 0 }

  const { getEventParticipantNameOverrides } = await import('./db.server')
  const overrides = getEventParticipantNameOverrides(event.id)
  if (!overrides.length) return { synced: 0 }

  const client = createRaidHelperClient()
  const signups = await client.getSignups(event.raidHelperEventId)
  let synced = 0

  for (const override of overrides) {
    const signup = signups.find((item) => item.discordId === override.discordId)
    if (!signup?.signupId) {
      console.warn('Raid Helper signup not found for event name override sync', {
        eventId: event.id,
        raidHelperEventId: event.raidHelperEventId,
        discordId: override.discordId,
      })
      continue
    }

    await client.updateSignupName(event.raidHelperEventId, signup.signupId, override.name)
    synced += 1
  }

  return { synced }
})
