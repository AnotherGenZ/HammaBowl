import { createServerOnlyFn } from '@tanstack/start-fn-stubs'
import {
  buildTeamCompositionMessage,
  createRaidHelperClient,
  hydrateCurrentEventsFromRaidHelper,
  isRaidHelperConfigured,
} from './raidHelper'
import type { HammaEvent, Role } from './types'

const RAID_HELPER_REFRESH_INTERVAL_MS = 10 * 60 * 1000
let eventCache: HammaEvent | null = null
let lastRaidHelperRefreshAt = 0
let raidHelperRefreshPromise: Promise<HammaEvent | null> | null = null
let autoRefreshTimerStarted = false

export interface SessionUser {
  id: string
  name: string
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

    const dbEvent = options.force ? null : await getCurrentEventFromDb()
    if (!options.force && dbEvent && !isRaidHelperRefreshDue()) {
      eventCache = dbEvent
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
  eventCache = null
}

export async function requireCurrentEvent(): Promise<HammaEvent> {
  const event = await getCurrentEvent()
  if (!event) throw new Response('No current Raid Helper event found.', { status: 404 })
  return event
}

export async function requireEventByIdOrCurrent(eventId?: string): Promise<HammaEvent> {
  const trimmedEventId = eventId?.trim()
  if (!trimmedEventId) return requireCurrentEvent()

  const { getDbEvent } = await import('./db.server')
  const event = await getDbEvent(trimmedEventId)
  if (!event) throw new Response('Event not found.', { status: 404 })
  return event
}

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

export async function postTeamCompositionToDiscord(event: HammaEvent) {
  if (isRaidHelperConfigured()) {
    const client = createRaidHelperClient()
    await client.postComposition(
      event.raidHelperEventId,
      buildTeamCompositionMessage(event),
    )
  }

  return {
    ok: true,
    message: `${event.name} teams posted through Raid Helper event ${event.raidHelperEventId}`,
  }
}
