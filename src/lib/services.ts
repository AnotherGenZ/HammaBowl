import { createServerOnlyFn } from '@tanstack/start-fn-stubs'
import {
  buildTeamCompositionMessage,
  createRaidHelperClient,
  hydrateEventFromRaidHelper,
  isRaidHelperConfigured,
} from './raidHelper'
import type { HammaEvent, Role } from './types'

const EVENT_CACHE_TTL_MS = 30 * 60 * 1000
let eventCache: { event: HammaEvent; expiresAt: number } | null = null

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

const getCurrentEventServer = createServerOnlyFn(
  async (options: { force?: boolean } = {}): Promise<HammaEvent | null> => {
  if (!options.force && eventCache && eventCache.expiresAt > Date.now()) {
    return eventCache.event
  }

  try {
    const event = await hydrateEventFromRaidHelper()
    if (!event) return null
    const { getDbEvent, upsertEventFromRaidHelper } = await import('./db.server')
    const eventId = await upsertEventFromRaidHelper(event)
    const dbEvent = (await getDbEvent(eventId)) ?? event
    eventCache = {
      event: dbEvent,
      expiresAt: Date.now() + EVENT_CACHE_TTL_MS,
    }
    return dbEvent
  } catch (error) {
    console.error(error)
    return null
  }
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

export async function getSessionUser(): Promise<SessionUser | null> {
  return null
}

export async function refreshRaidHelperEvent(): Promise<HammaEvent | null> {
  clearCurrentEventCache()
  return getCurrentEvent({ force: true })
}

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
