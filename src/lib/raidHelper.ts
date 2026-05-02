import { env, requireEnv } from './env'
import type { Faction, HammaEvent, Player } from './types'
import { BID_INCREMENT, BONUS_POOL, MAX_PLAYER_BONUS, SALARY_POOL } from './rules'

const RAID_HELPER_API_BASE_URL = 'https://raid-helper.xyz/api/v4'

export interface RaidHelperSignup {
  signupId: string
  discordId: string
  name: string
  className?: string
  status?: string
}

interface RaidHelperRemoteEvent {
  id: string
  title: string
  startsAt: string
  endsAt?: string
  closingTime?: string
  signups: RaidHelperSignup[]
}

export interface RaidHelperClient {
  getCurrentEvent(): Promise<RaidHelperRemoteEvent>
  getCurrentEvents(): Promise<RaidHelperRemoteEvent[]>
  getSignups(eventId: string): Promise<RaidHelperSignup[]>
  updateComp(compId: string, body: RaidHelperCompUpdate): Promise<void>
  updateSignupName(eventId: string, signupId: string, name: string): Promise<void>
}

interface RaidHelperCompUpdate {
  title: string
  showRoles: false
  showClasses: false
  groupCount: number
  slotCount: number
  groups: Array<{
    name: string
    position: number
  }>
  slots: Array<{
    name: string
    className: 'Accepted'
    specName: 'Accepted'
    groupNumber: number
    slotNumber: number
    isConfirmed: 'confirmed'
  }>
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
    async getCurrentEvents() {
      const payload = await requestUnknown(
        `${RAID_HELPER_API_BASE_URL}/servers/${serverId}/events`,
        apiKey,
      )
      return selectCurrentEvents(payload)
    },
    async getSignups(eventId) {
      const payload = await requestUnknown(
        `${RAID_HELPER_API_BASE_URL}/events/${encodeURIComponent(eventId)}`,
        apiKey,
      )
      return normalizeRemoteEvent(payload).signups
    },
    async updateComp(compId, body) {
      const url = `${RAID_HELPER_API_BASE_URL}/comps/${encodeURIComponent(compId)}`
      const requestBody = JSON.stringify(body)
      console.debug('Raid Helper comp PATCH payload', JSON.stringify({
        compId,
        url,
        body,
      }, null, 2))
      await requestUnknown(
        url,
        apiKey,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        },
      )
    },
    async updateSignupName(eventId, signupId, name) {
      const url = `${RAID_HELPER_API_BASE_URL}/events/${encodeURIComponent(eventId)}/signups/${encodeURIComponent(signupId)}`
      const body = { name }
      const requestBody = JSON.stringify(body)
      console.debug('Raid Helper signup PATCH payload', JSON.stringify({
        eventId,
        signupId,
        url,
        body,
      }, null, 2))
      await requestUnknown(
        url,
        apiKey,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
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
  return hydrateRemoteEvent(client, remoteEvent)
}

export async function hydrateCurrentEventsFromRaidHelper(): Promise<HammaEvent[]> {
  if (!isRaidHelperConfigured()) return []

  const client = createRaidHelperClient()
  const remoteEvents = await client.getCurrentEvents()
  return Promise.all(remoteEvents.map((remoteEvent) => hydrateRemoteEvent(client, remoteEvent)))
}

async function hydrateRemoteEvent(
  client: RaidHelperClient,
  remoteEvent: RaidHelperRemoteEvent,
): Promise<HammaEvent> {
  const signups = remoteEvent.signups.length
    ? remoteEvent.signups
    : await client.getSignups(remoteEvent.id)

  return {
    id: `raid-helper-${remoteEvent.id}`,
    raidHelperEventId: remoteEvent.id,
    name: stripMarkdown(remoteEvent.title),
    server: env('HAMMABOWL_SERVER_NAME', 'Jaeger'),
    startsAt: remoteEvent.startsAt,
    endsAt: remoteEvent.endsAt,
    closingTime: remoteEvent.closingTime,
    draftStartMinutesBefore: undefined,
    phase: 'signups' as const,
    salaryPool: SALARY_POOL,
    bonusPool: BONUS_POOL,
    maxPlayerBonus: MAX_PLAYER_BONUS,
    bidIncrement: BID_INCREMENT,
    pendingPlayerCount: signups.filter(isMaybeSignup).length,
    availableFactions: ['VS', 'NC', 'TR'] as Faction[],
    availableSides: ['north', 'south'],
    teams: [],
    players: signupPlayers(signups),
    ratings: [],
    draftPicks: [],
    eventLinks: [],
  }
}

export function buildRaidHelperCompUpdate(event: HammaEvent): RaidHelperCompUpdate {
  const playerById = new Map(event.players.map((player) => [player.id, player]))
  const compTeams = event.teams.slice(0, 2)
  const teamMembers = compTeams.map((team) => {
    const members = team.captainDiscordId
      ? [playerById.get(team.captainDiscordId)?.name ?? team.captainDiscordId]
      : []
    const draftedPlayers = event.draftPicks
      .filter((pick) => pick.teamId === team.id && pick.playerId !== team.captainDiscordId)
      .sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt))

    for (const pick of draftedPlayers) {
      const player = playerById.get(pick.playerId)
      if (player) members.push(player.name)
    }
    return members
  })

  return {
    title: event.name,
    showRoles: false,
    showClasses: false,
    groupCount: compTeams.length,
    slotCount: Math.max(0, ...teamMembers.map((members) => members.length)),
    groups: compTeams.map((team, index) => ({
      name: team.teamName,
      position: index + 1,
    })),
    slots: teamMembers.flatMap((members, teamIndex) =>
      members.map((name, memberIndex) => ({
        name,
        className: 'Accepted',
        specName: 'Accepted',
        groupNumber: teamIndex + 1,
        slotNumber: memberIndex + 1,
        isConfirmed: 'confirmed',
      })),
    ),
  }
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
    console.error('Raid Helper request failed', {
      method: init.method ?? 'GET',
      url,
      status: response.status,
      statusText: response.statusText,
      detail,
      requestBody: typeof init.body === 'string' ? init.body : undefined,
    })
    throw new Error(
      `Raid Helper request failed: ${response.status} ${url}${detail ? ` - ${detail}` : ''}`,
    )
  }

  if (response.status === 204) return null
  return response.json()
}

function selectCurrentEvent(payload: unknown): RaidHelperRemoteEvent {
  const configuredEventId = env('RAID_HELPER_EVENT_ID')

  if (configuredEventId) {
    return selectEventById(payload, configuredEventId)
  }

  const filtered = filterNamedEvents(normalizeScheduledEvents(payload))
  const selected = selectFirstCurrentEvent(filtered) ?? selectLatestEvent(filtered)

  if (!selected) {
    throw new Error('Raid Helper scheduled events response did not include any events')
  }

  return selected
}

function selectCurrentEvents(payload: unknown): RaidHelperRemoteEvent[] {
  return selectCurrentEventList(filterNamedEvents(normalizeScheduledEvents(payload)))
}

function filterNamedEvents(events: RaidHelperRemoteEvent[]) {
  const nameFilter = env('RAID_HELPER_EVENT_NAME_CONTAINS').toLowerCase()
  const filtered = nameFilter
    ? events.filter((event) => event.title.toLowerCase().includes(nameFilter))
    : events
  return filtered
}

function selectCurrentEventList(events: RaidHelperRemoteEvent[]) {
  const now = Date.now()
  return events
    .filter((event) => {
      const startsAt = new Date(event.startsAt).getTime()
      const endsAt = event.endsAt ? new Date(event.endsAt).getTime() : Number.NaN
      return startsAt > now && endsAt > now
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}

function selectFirstCurrentEvent(events: RaidHelperRemoteEvent[]) {
  return selectCurrentEventList(events)[0]
}

function selectLatestEvent(events: RaidHelperRemoteEvent[]) {
  return events
    .filter((event) => new Date(event.startsAt).getTime() >= Date.now())
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0] ??
    events.sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    )[0]
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
  const endsAt = dateValue(
    source.endsAt ??
      source.endAt ??
      source.endTime ??
      source.end_time ??
      source.end ??
      source.endDate ??
      source.end_date ??
      source.endTimestamp ??
      source.end_timestamp,
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
    endsAt: endsAt || undefined,
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
      signupId: stringValue(
        signup.id ??
          signup.signupId ??
          signup.signupID ??
          signup.signup_id,
      ),
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
    const date = new Date(value < 10_000_000_000 ? value * 1000 : value)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }

  const text = stringValue(value).trim()
  if (!text) return ''

  if (/^\d+$/.test(text)) {
    const numeric = Number(text)
    const date = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }

  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString()
}

function stripMarkdown(value: string) {
  return value.replace(/\*\*/g, '').replace(/__/g, '').trim()
}
