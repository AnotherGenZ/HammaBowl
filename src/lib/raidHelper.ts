import { env, requireEnv } from './env'
import type { Faction, HammaEvent, Player } from './types'
import { SALARY_POOL } from './rules'

const RAID_HELPER_API_BASE_URL = 'https://raid-helper.xyz/api/v4'

export interface RaidHelperSignup {
  discordId: string
  name: string
  className?: string
  status?: string
}

interface RaidHelperRemoteEvent {
  id: string
  title: string
  startsAt: string
  closingTime?: string
  signups: RaidHelperSignup[]
}

export interface RaidHelperClient {
  getCurrentEvent(): Promise<RaidHelperRemoteEvent>
  getSignups(eventId: string): Promise<RaidHelperSignup[]>
  postComposition(eventId: string, content: string): Promise<void>
}

export function createRaidHelperClient(): RaidHelperClient {
  const apiKey = requireEnv('RAID_HELPER_API_KEY')
  const serverId = encodeURIComponent(requireEnv('RAID_HELPER_SERVER_ID'))

  return {
    async getCurrentEvent() {
      const payload = await requestUnknown(
        `${RAID_HELPER_API_BASE_URL}/servers/${serverId}/events`,
        apiKey,
      )
      return selectCurrentEvent(payload)
    },
    async getSignups(eventId) {
      const payload = await requestUnknown(
        `${RAID_HELPER_API_BASE_URL}/events/${encodeURIComponent(eventId)}`,
        apiKey,
      )
      return normalizeRemoteEvent(payload).signups
    },
    async postComposition(eventId, content) {
      await requestUnknown(
        `${RAID_HELPER_API_BASE_URL}/events/${encodeURIComponent(eventId)}/composition`,
        apiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        },
      )
    },
  }
}

export function isRaidHelperConfigured() {
  return Boolean(process.env.RAID_HELPER_SERVER_ID && process.env.RAID_HELPER_API_KEY)
}

export async function hydrateEventFromRaidHelper(): Promise<HammaEvent | null> {
  if (!isRaidHelperConfigured()) return null

  const client = createRaidHelperClient()
  const remoteEvent = await client.getCurrentEvent()
  const signups = remoteEvent.signups.length
    ? remoteEvent.signups
    : await client.getSignups(remoteEvent.id)

  return {
    id: `raid-helper-${remoteEvent.id}`,
    raidHelperEventId: remoteEvent.id,
    name: stripMarkdown(remoteEvent.title),
    server: env('HAMMABOWL_SERVER_NAME', 'Jaeger'),
    startsAt: remoteEvent.startsAt,
    closingTime: remoteEvent.closingTime,
    phase: 'signups' as const,
    salaryPool: SALARY_POOL,
    pendingPlayerCount: signups.filter(isMaybeSignup).length,
    availableFactions: ['VS', 'NC', 'TR'] as Faction[],
    availableSides: ['north', 'south'],
    captains: [],
    players: signupPlayers(signups),
    ratings: [],
    draftPicks: [],
  }
}

export function buildTeamCompositionMessage(event: HammaEvent) {
  const playerById = new Map(event.players.map((player) => [player.id, player]))
  const lines = [`**${event.name} teams**`]

  for (const captain of event.captains) {
    lines.push('', `__${captain.teamName}__`)
    const picks = event.draftPicks.filter((pick) => pick.captainId === captain.id)
    for (const pick of picks) {
      const player = playerById.get(pick.playerId)
      if (player) lines.push(`- ${player.name}`)
    }
  }

  return lines.join('\n')
}

function signupPlayers(signups: RaidHelperSignup[]): Player[] {
  const seen = new Set<string>()
  const players: Player[] = []

  for (const signup of signups.filter(isAcceptedSignup)) {
    const id = signup.discordId
    if (!id || seen.has(id)) continue
    seen.add(id)
    players.push({
      id,
      name: signup.name,
      outfit: '',
      faction: 'NS',
      status: 'signed_up',
    })
  }

  return players.sort((a, b) => a.name.localeCompare(b.name))
}

function isAcceptedSignup(signup: RaidHelperSignup) {
  return signup.className?.toLowerCase() === 'accepted'
}

function isMaybeSignup(signup: RaidHelperSignup) {
  const className = signup.className?.toLowerCase()
  const status = signup.status?.toLowerCase()
  return className === 'maybe' || status === 'maybe'
}

async function requestUnknown(
  url: string,
  apiKey: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers)

  headers.set('Authorization', apiKey)

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Raid Helper request failed: ${response.status} ${url}${detail ? ` - ${detail}` : ''}`,
    )
  }

  if (response.status === 204) return null
  return response.json()
}

function selectCurrentEvent(payload: unknown): RaidHelperRemoteEvent {
  const events = normalizeScheduledEvents(payload)
  const configuredEventId = env('RAID_HELPER_EVENT_ID')
  const nameFilter = env('RAID_HELPER_EVENT_NAME_CONTAINS').toLowerCase()

  if (configuredEventId) {
    return selectEventById(payload, configuredEventId)
  }

  const filtered = nameFilter
    ? events.filter((event) => event.title.toLowerCase().includes(nameFilter))
    : events

  const upcoming = filtered
    .filter((event) => new Date(event.startsAt).getTime() >= Date.now())
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )

  const selected =
    upcoming[0] ??
    filtered.sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    )[0]

  if (!selected) {
    throw new Error('Raid Helper scheduled events response did not include any events')
  }

  return selected
}

function selectEventById(payload: unknown, eventId: string) {
  const event = normalizeScheduledEvents(payload).find((item) => item.id === eventId)

  if (!event) {
    throw new Error(`Raid Helper scheduled events response did not include ${eventId}`)
  }

  return event
}

function normalizeScheduledEvents(payload: unknown): RaidHelperRemoteEvent[] {
  return eventItems(payload).map(normalizeRemoteEvent)
}

function eventItems(payload: unknown): unknown[] {
  const record = asRecord(payload)

  if (Array.isArray(payload)) return payload
  if (Array.isArray(record.events)) return record.events
  if (Array.isArray(record.postedEvents)) return record.postedEvents
  if (Array.isArray(record.scheduledEvents)) return record.scheduledEvents
  if (Array.isArray(record.scheduled_events)) return record.scheduled_events
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.response)) return record.response

  return []
}

function normalizeRemoteEvent(payload: unknown): RaidHelperRemoteEvent {
  const record = asRecord(payload)
  const source = asRecord(record.event ?? record.data ?? record)
  const id = stringValue(
    source.id ??
      source.eventId ??
      source.eventid ??
      source.event_id ??
      source.raidId ??
      source.raid_id,
  )
  const title = stripMarkdown(stringValue(source.title ?? source.name ?? source.summary))
  const startsAt = dateValue(
    source.startsAt ??
      source.startTime ??
      source.start_time ??
      source.date ??
      source.timestamp,
  )
  const closingTime = dateValue(
    source.closingTime ??
      source.closeTime ??
      source.closing_time ??
      source.close_time,
  )

  if (!id || !title || !startsAt) {
    throw new Error('Raid Helper current event response is missing id/title/startsAt')
  }

  return {
    id,
    title,
    startsAt,
    closingTime: closingTime || undefined,
    signups: normalizeSignups(
      source.signups ??
        source.signUps ??
        source.signupList ??
        source.signup_list ??
        source.users ??
        source.members ??
        record.signups ??
        [],
    ),
  }
}

function normalizeSignups(payload: unknown): RaidHelperSignup[] {
  const record = asRecord(payload)
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(record.signUps)
      ? record.signUps
    : Array.isArray(record.signups)
      ? record.signups
      : Array.isArray(record.signupList)
        ? record.signupList
      : Array.isArray(record.users)
        ? record.users
      : Array.isArray(record.members)
        ? record.members
      : Array.isArray(record.data)
        ? record.data
        : flattenSignupGroups(record)

  return items.map((item) => {
    const signup = asRecord(item)
    const user = asRecord(signup.user ?? signup.member ?? {})
    return {
      discordId: stringValue(
        signup.discordId ??
          signup.discord_id ??
          signup.userId ??
          signup.user_id ??
          signup.userid ??
          signup.memberId ??
          signup.member_id ??
          user.id,
      ),
      name: stringValue(
        signup.name ??
          signup.username ??
          signup.userName ??
          signup.user_name ??
          signup.displayName ??
          signup.display_name ??
          signup.nickname ??
          user.global_name ??
          user.globalName ??
          user.displayName ??
          user.username,
      ),
      className: stringValue(signup.className ?? signup.class ?? signup.role),
      status: stringValue(signup.status),
    }
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function flattenSignupGroups(record: Record<string, unknown>) {
  return Object.entries(record).flatMap(([groupName, value]) =>
    Array.isArray(value)
      ? value.map((item) => {
          const signup = asRecord(item)
          return signup.className || signup.class || signup.status
            ? item
            : { ...signup, className: groupName }
        })
      : [],
  )
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function dateValue(value: unknown) {
  if (typeof value === 'number') {
    return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString()
  }

  return stringValue(value)
}

function stripMarkdown(value: string) {
  return value.replace(/\*\*/g, '').replace(/__/g, '').trim()
}
