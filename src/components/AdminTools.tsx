import { type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, useEffect, useId, useRef, useState } from 'react'
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react'
import type {
  AdminBadgeManagerData,
  AdminPlayerCharacterConfig,
  AdminSignupManagerData,
  EventLink,
  EventSpecOption,
  EventTrophyId,
  Team,
  EventPlayerCharacterAssignment,
  Faction,
  HammaEvent,
  HonuPsbAccountSuggestion,
  Player,
  RegisteredParticipant,
  StartingSide,
} from '../lib/types'
import { localDatetimeToIso, shortDate, toDatetimeLocalValue } from '../lib/format'
import { useDisplayTimeZone } from '../lib/useDisplayTimeZone'
import { HONU_ALERT_ZONE_OPTIONS } from '../lib/honu'
import { undraftedDraftEligiblePlayers } from '../lib/rules'
import { DateTimeLocalInput } from './DateTimeLocalInput'
import { EVENT_LINK_ICON_OPTIONS, EventLinkIcon } from './EventLinkIcons'
import { PlayerName } from './PlayerName'

const EVENT_TROPHY_OPTIONS: Array<{ id: EventTrophyId; label: string }> = [
  { id: 'hammo-bowl-cup', label: 'HammaBowl Cup' },
  { id: 'hamma-dome-biolab', label: 'Hamma Dome I - Bitol Bio' },
]
const DEFAULT_SPEC_OPTIONS: EventSpecOption[] = [
  { emoji: '⚔️', name: 'Infantry' },
  { emoji: '✈️', name: 'Air' },
  { emoji: '🛡️', name: 'Armor' },
  { emoji: '📡', name: 'Logistics' },
  { emoji: '🔄', name: 'Flex' },
]
const TWEMOJI_VERSION = '17.0.2'
const TWEMOJI_BASE_URL = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg`

interface RealtimeAdminUpdate {
  type: string
  eventId: string
  at: string
}

export function AdminTools({
  event,
  currentEvents,
  creating,
  onEditEventIdChange,
  onCreateEventChange,
  onClearEditEventChange,
  onEventJaegerWarningCount,
  onCreationModeChange,
}: {
  event: HammaEvent | null
  currentEvents: HammaEvent[]
  creating: boolean
  onEditEventIdChange?: (eventId: string) => void
  onCreateEventChange?: () => void
  onClearEditEventChange?: () => void
  onEventJaegerWarningCount?: (count: number) => void
  onCreationModeChange?: (creating: boolean) => void
}) {
  const [currentEvent, setCurrentEvent] = useState<HammaEvent | null>(event)
  const [currentEventOptions, setCurrentEventOptions] = useState(currentEvents)
  const [creatingEvent, setCreatingEvent] = useState(creating)
  const [lastEditingEvent, setLastEditingEvent] = useState<HammaEvent | null>(event)
  const [pendingEditEventId, setPendingEditEventId] = useState<string>()
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0)
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const displayTimeZone = useDisplayTimeZone()
  const undraftedPlayers = currentEvent ? undraftedDraftEligiblePlayers(currentEvent) : []
  const canSyncTeams = undraftedPlayers.length === 0
  const draftLocked = Boolean(currentEvent?.rounds.length)

  function setConfiguredEvent(event: HammaEvent) {
    setCreatingEvent(false)
    setLastEditingEvent(event)
    setCurrentEvent(event)
    setCurrentEventOptions((options) => mergeEventOptions(options, event))
    setPendingEditEventId(event.id)
    onEditEventIdChange?.(event.id)
  }

  useEffect(() => {
    setCreatingEvent(creating)
    if (creating) setCurrentEvent(null)
  }, [creating])

  useEffect(() => {
    if (creatingEvent) {
      setCurrentEventOptions(currentEvents)
      return
    }

    setCurrentEvent((current) => {
      if (pendingEditEventId && current?.id === pendingEditEventId) {
        return currentEvents.find((option) => option.id === pendingEditEventId) ?? current
      }
      return event
    })
    if (event) setLastEditingEvent(event)
  }, [creatingEvent, event, currentEvents, pendingEditEventId])

  useEffect(() => {
    if (pendingEditEventId && event?.id === pendingEditEventId) setPendingEditEventId(undefined)
  }, [event?.id, pendingEditEventId])

  useEffect(() => {
    if (creatingEvent || !currentEvent) {
      setCurrentEventOptions(currentEvents)
      return
    }

    setCurrentEventOptions(mergeEventOptions(currentEvents, currentEvent))
  }, [creatingEvent, currentEvent, currentEvents])

  useEffect(() => {
    onCreationModeChange?.(creatingEvent)
  }, [creatingEvent, onCreationModeChange])

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    if (!currentEvent) return

    let active = true
    const source = new EventSource('/api/event/current/stream')
    source.addEventListener('event-update', (eventMessage) => {
      const update = parseRealtimeAdminUpdate(eventMessage)
      if (!update) return

      void fetch(`/api/admin/event?eventId=${encodeURIComponent(currentEvent.id)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(await response.text())
          return response.json() as Promise<{
            event: HammaEvent | null
            currentEvents: HammaEvent[]
          }>
        })
        .then((payload) => {
          if (!active) return
          setCurrentEventOptions(payload.currentEvents)
          if (payload.event) setCurrentEvent(payload.event)
          setRealtimeRefreshKey((key) => key + 1)
        })
        .catch((error) => console.warn('Admin event refresh failed', error))
    })

    return () => {
      active = false
      source.close()
    }
  }, [currentEvent?.id])

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label)
    setMessage(undefined)
    try {
      const result = await action()
      const summary = summarizeResult(result)
      setMessage(summary)
      if (isCurrentEventsResult(result)) {
        setCurrentEventOptions(isEventResult(result) ? mergeEventOptions(result.currentEvents, result.event) : result.currentEvents)
      } else if (isEventResult(result)) {
        setCurrentEventOptions((options) => mergeEventOptions(options, result.event))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed.')
    } finally {
      setBusy(undefined)
    }
  }

  function beginCreateEvent() {
    if (currentEvent) setLastEditingEvent(currentEvent)
    setCurrentEvent(null)
    setCreatingEvent(true)
    setMessage(undefined)
    onCreateEventChange?.()
  }

  function cancelCreateEvent() {
    const fallback = lastEditingEvent ?? currentEventOptions[0] ?? event
    if (fallback) {
      setConfiguredEvent(fallback)
    } else {
      setCreatingEvent(false)
      onClearEditEventChange?.()
    }
  }

  function handleEventDeleted(eventId: string) {
    setCurrentEventOptions((options) => options.filter((option) => option.id !== eventId))
    setCurrentEvent(null)
    setLastEditingEvent((current) => (current?.id === eventId ? null : current))
    setCreatingEvent(false)
    setRealtimeRefreshKey((key) => key + 1)
    onClearEditEventChange?.()
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h1>Event Admin</h1>
        </div>
        <EventTargetControls
          event={currentEvent}
          currentEvents={currentEventOptions}
          creating={creatingEvent}
          timeZone={displayTimeZone}
          onEvent={setConfiguredEvent}
          onNew={beginCreateEvent}
          onCancel={cancelCreateEvent}
        />
      </div>

      {message ? <div className="admin-result">{message}</div> : null}

      <div className="admin-stack">
        <NativeEventOps
          event={currentEvent}
          creating={creatingEvent}
          busy={busy}
          onRun={run}
          onEvent={setConfiguredEvent}
          onDeleted={handleEventDeleted}
          refreshKey={realtimeRefreshKey}
        />

        {currentEvent && !creatingEvent ? (
          <>
            <EventIdentityControls event={currentEvent} busy={busy} onRun={run} onEvent={setConfiguredEvent} />

            <DraftControls event={currentEvent} busy={busy} onRun={run} onEvent={setConfiguredEvent} />

            <TeamEditor
              event={currentEvent}
              busy={busy}
              onRun={run}
              onEvent={setConfiguredEvent}
              locked={draftLocked}
            />

            <EventJaegerAssignments
              event={currentEvent}
              busy={busy}
              onRun={run}
              refreshKey={realtimeRefreshKey}
              onWarningCount={onEventJaegerWarningCount}
            />

            <CoinflipControls event={currentEvent} busy={busy} onRun={run} onEvent={setConfiguredEvent} />

            <RatingAdjustments
              event={currentEvent}
              busy={busy}
              onRun={run}
              onEvent={setConfiguredEvent}
            />

            <RoundControls event={currentEvent} busy={busy} onRun={run} onEvent={setConfiguredEvent} />

            <AdminSection
              id="admin-composition"
              title="Team composition"
              actions={
                <button
                  type="button"
                  disabled={busy === 'post' || !canSyncTeams}
                  title={
                    canSyncTeams
                      ? undefined
                      : `${undraftedPlayers.length} draft-eligible players remain undrafted.`
                  }
                  onClick={() =>
                    void run('post', () =>
                      postAdminJson('/api/admin/raid-helper/post-composition', {
                        eventId: currentEvent.id,
                      }),
                    )
                  }
                >
                  {currentEvent.source === 'native' ? 'Publish teams' : 'Sync teams'}
                </button>
              }
            >
              <p>
                {canSyncTeams
                  ? currentEvent.source === 'native'
                    ? 'Publishes or updates the Discord teams message from the current persisted draft.'
                    : 'Updates the Raid Helper comp with the current persisted teams.'
                  : `Finish the draft before syncing. ${undraftedPlayers.length} draft-eligible players remain undrafted.`}
              </p>
            </AdminSection>
          </>
        ) : null}
      </div>
    </section>
  )
}

function EventTargetControls({
  event,
  currentEvents,
  creating,
  timeZone,
  onEvent,
  onNew,
  onCancel,
}: {
  event: HammaEvent | null
  currentEvents: HammaEvent[]
  creating: boolean
  timeZone: string
  onEvent: (event: HammaEvent) => void
  onNew: () => void
  onCancel: () => void
}) {
  const options = event ? mergeEventOptions(currentEvents, event) : currentEvents

  return (
    <div className="admin-heading-actions">
      {creating ? (
        <div className="event-mode-chip">Creating new event</div>
      ) : (
        <div className="admin-heading-event-select">
          <label className="admin-heading-control">
            Editing event
            <select
              value={event?.id ?? ''}
              disabled={!options.length}
              onChange={(changeEvent) => {
                const nextEvent = options.find((option) => option.id === changeEvent.currentTarget.value)
                if (nextEvent) onEvent(nextEvent)
              }}
            >
              {options.length
                ? event ? null : <option value="">Choose event</option>
                : <option value="">No events available</option>}
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} - {shortDate(option.startsAt, { timeZone })}
                </option>
              ))}
            </select>
          </label>
          {event ? <div className="event-mode-chip">{formatEventModeChip(event)}</div> : null}
        </div>
      )}
      <div className="button-row">
        {creating && options.length ? (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : creating ? null : (
          <button type="button" className="secondary" onClick={onNew}>
            New event
          </button>
        )}
      </div>
    </div>
  )
}

function formatEventModeChip(event: HammaEvent) {
  const source = event.source === 'raid_helper'
    ? 'Raid Helper'
    : event.source === 'native'
      ? 'Native'
      : 'Manual'
  return `${source} · ${event.phase}`
}

function ActiveEventControls({
  event,
  currentEvents,
  busy,
  onRun,
  onEvent,
}: {
  event: HammaEvent | null
  currentEvents: HammaEvent[]
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent | null) => void
}) {
  const [activeEventId, setActiveEventId] = useState(event?.id ?? '')
  const displayTimeZone = useDisplayTimeZone()
  const options = event ? mergeEventOptions(currentEvents, event) : currentEvents

  useEffect(() => {
    setActiveEventId(event?.id ?? '')
  }, [event?.id])

  return (
    <AdminSection id="admin-active-event" title="Active event">
      <div className="event-result-grid">
        <div className="event-result-card">
          <strong>Admin target</strong>
          <label>
            Active event
            <select
              value={activeEventId}
              onChange={(event) => setActiveEventId(event.currentTarget.value)}
            >
              <option value="">No active event</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} - {shortDate(option.startsAt, { timeZone: displayTimeZone })}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy === 'active-event' || activeEventId === (event?.id ?? '')}
            onClick={() =>
              void onRun('active-event', async () => {
                const result = await postAdminJson('/api/admin/event', { activeEventId })
                if (isEventResult(result)) onEvent(result.event)
                else if (isNullEventResult(result)) onEvent(null)
                return result
              })
            }
          >
            Set active event
          </button>
          <small>
            {event ? `${event.name} is visible on the homepage.` : 'The homepage has no active event.'}{' '}
            {options.length} current event{options.length === 1 ? '' : 's'} available.
          </small>
        </div>
      </div>
    </AdminSection>
  )
}

export function GeneralAdminTools({
  event,
  currentEvents,
}: {
  event: HammaEvent | null
  currentEvents: HammaEvent[]
}) {
  const [activeEvent, setActiveEvent] = useState(event)
  const [currentEventOptions, setCurrentEventOptions] = useState(currentEvents)
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0)
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState<string>()

  useEffect(() => {
    setActiveEvent(event)
    setCurrentEventOptions(currentEvents)
  }, [event, currentEvents])

  function setActiveEventSelection(event: HammaEvent | null) {
    setActiveEvent(event)
    if (event) setCurrentEventOptions((options) => mergeEventOptions(options, event))
  }

  useEffect(() => {
    if (typeof EventSource === 'undefined') return

    let active = true
    const source = new EventSource('/api/event/current/stream')
    source.addEventListener('event-update', (eventMessage) => {
      const update = parseRealtimeAdminUpdate(eventMessage)
      if (!update) return

      void fetch('/api/admin/event')
        .then(async (response) => {
          if (!response.ok) throw new Error(await response.text())
          return response.json() as Promise<{
            event: HammaEvent | null
            currentEvents: HammaEvent[]
          }>
        })
        .then((payload) => {
          if (!active) return
          setActiveEvent(payload.event)
          setCurrentEventOptions(payload.currentEvents)
          setRealtimeRefreshKey((key) => key + 1)
        })
        .catch((error) => console.warn('Admin general refresh failed', error))
    })

    return () => {
      active = false
      source.close()
    }
  }, [])

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label)
    setMessage(undefined)
    try {
      const result = await action()
      setMessage(summarizeResult(result))
      if (isEventResult(result)) {
        setActiveEvent(result.event)
        setCurrentEventOptions((options) => mergeEventOptions(options, result.event))
      } else if (isNullEventResult(result)) {
        setActiveEvent(null)
      }
      if (isCurrentEventsResult(result)) {
        setCurrentEventOptions(result.currentEvents)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed.')
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h1>General controls</h1>
        </div>
      </div>

      {message ? <div className="admin-result">{message}</div> : null}

      <div className="admin-stack">
        <ActiveEventControls
          event={activeEvent}
          currentEvents={currentEventOptions}
          busy={busy}
          onRun={run}
          onEvent={setActiveEventSelection}
        />

        {activeEvent?.source === 'native' ? null : (
          <AdminSection
            id="admin-event-sync"
            title="Event sync"
            actions={
              <button
                type="button"
                disabled={busy === 'refresh'}
                onClick={() =>
                  void run('refresh', async () => {
                    const result = await postAdminAction('/api/admin/raid-helper/refresh')
                    return result
                  })
                }
              >
                {busy === 'refresh' ? 'Refreshing' : 'Force refresh'}
              </button>
            }
          >
            <p>Pull current events, closing times, and accepted signups from Raid Helper.</p>
          </AdminSection>
        )}

        <AdminSection
          id="admin-discord-cache"
          title="Discord cache"
          actions={
            <button
              type="button"
              disabled={busy === 'discord-options-refresh'}
              onClick={() =>
                void run('discord-options-refresh', () =>
                  postAdminJson('/api/admin/event', { action: 'discord-options.refresh' }))
              }
            >
              {busy === 'discord-options-refresh' ? 'Refreshing' : 'Refresh emojis'}
            </button>
          }
        >
          <p>Force refresh cached Discord channels, roles, and custom emojis from the bot.</p>
        </AdminSection>

        <PlayerRenameManager busy={busy} onRun={run} refreshKey={realtimeRefreshKey} />
        <PlayerJaegerManager busy={busy} onRun={run} refreshKey={realtimeRefreshKey} />
        <BadgeManager busy={busy} onRun={run} refreshKey={realtimeRefreshKey} />
      </div>
    </section>
  )
}

function formatParticipantLabel(player: RegisteredParticipant) {
  return player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name
}

function combinedSignupPlayers(data: AdminSignupManagerData) {
  const players = new Map<string, RegisteredParticipant>()
  for (const player of [...data.players, ...data.signedUpPlayers]) {
    players.set(player.discordId, player)
  }

  return Array.from(players.values()).sort((left, right) =>
    formatParticipantLabel(left).localeCompare(formatParticipantLabel(right)),
  )
}

interface NativeEventOpsData {
  signups: Array<{
    discordId: string
    name: string
    status: string
    specs: string[]
    note?: string
  }>
  csv: string
  roleGates: {
    allowedRoleIds: string[]
    bannedRoleIds: string[]
  }
  limits: Array<{ status?: string; specName?: string; limit: number }>
  reminders: Array<{
    id?: string
    kind: string
    target: string
    offsetMinutes: number
    channelId?: string
    message?: string
    enabled: boolean
    lastSentAt?: string
  }>
  recurrences: Array<{ intervalDays: number; nextPostAt: string; enabled: boolean }>
}

interface NativeReminderFormRow {
  clientId: string
  id?: string
  kind: string
  target: string
  offsetMinutes: string
  channelId: string
  message: string
  enabled: boolean
  lastSentAt?: string
}

interface DiscordGuildOptionsData {
  channels: Array<{ id: string; name: string }>
  roles: Array<{ id: string; name: string; color?: number; managed?: boolean }>
  emojis: Array<{ id: string; name: string; animated?: boolean; guildName?: string; mention: string; url: string }>
  refreshedAt?: string
  stale?: boolean
  error?: string
}

type EventSetupField = 'title' | 'startsAt' | 'durationMinutes' | 'signupCloseMinutesBefore'
type EventSetupErrors = Partial<Record<EventSetupField, string>>

function NativeEventOps({
  event,
  creating,
  busy,
  onRun,
  onEvent,
  onDeleted,
  refreshKey,
}: {
  event: HammaEvent | null
  creating: boolean
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
  onDeleted: (eventId: string) => void
  refreshKey: number
}) {
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('120')
  const [signupCloseMinutesBefore, setSignupCloseMinutesBefore] = useState('60')
  const [channelId, setChannelId] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [embedUseDiscordMentions, setEmbedUseDiscordMentions] = useState(false)
  const [autoCreateSignupThread, setAutoCreateSignupThread] = useState(false)
  const [specOptions, setSpecOptions] = useState<EventSpecOption[]>(DEFAULT_SPEC_OPTIONS)
  const [minSignupSpecs, setMinSignupSpecs] = useState('1')
  const [maxSignupSpecs, setMaxSignupSpecs] = useState('5')
  const [signupLimit, setSignupLimit] = useState('')
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>([])
  const [bannedRoleIds, setBannedRoleIds] = useState<string[]>([])
  const [mentionRoleIds, setMentionRoleIds] = useState<string[]>([])
  const [reminders, setReminders] = useState<NativeReminderFormRow[]>(defaultReminderFormRows)
  const [signupDiscordId, setSignupDiscordId] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupStatus, setSignupStatus] = useState('accepted')
  const [signupSpecs, setSignupSpecs] = useState<string[]>([])
  const [signupNote, setSignupNote] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [signupPlayers, setSignupPlayers] = useState<AdminSignupManagerData>({
    players: [],
    signedUpPlayers: [],
  })
  const [signupPlayersLoaded, setSignupPlayersLoaded] = useState(false)
  const [targetMessage, setTargetMessage] = useState('')
  const [targetGroup, setTargetGroup] = useState('signed')
  const [eventSetupErrors, setEventSetupErrors] = useState<EventSetupErrors>({})
  const [eventOps, setEventOps] = useState<NativeEventOpsData | null>(null)
  const [discordOptions, setDiscordOptions] = useState<DiscordGuildOptionsData>({
    channels: [],
    roles: [],
    emojis: [],
  })
  const ready = useClientReady()

  useEffect(() => {
    let active = true
    const query = event ? `?eventId=${encodeURIComponent(event.id)}` : ''
    void fetch(`/api/admin/event${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text())
        return response.json() as Promise<{
          eventOps?: NativeEventOpsData | null
          discordOptions?: DiscordGuildOptionsData
        }>
      })
      .then((payload) => {
        if (!active) return
        setEventOps(event?.source === 'native' ? payload.eventOps ?? null : null)
        if (payload.discordOptions) {
          setDiscordOptions({
            channels: payload.discordOptions.channels ?? [],
            roles: payload.discordOptions.roles ?? [],
            emojis: payload.discordOptions.emojis ?? [],
            refreshedAt: payload.discordOptions.refreshedAt,
            stale: payload.discordOptions.stale,
            error: payload.discordOptions.error,
          })
        }
      })
      .catch((error) => console.warn('Native event ops load failed', error))
    return () => {
      active = false
    }
  }, [event?.id, event?.source])

  useEffect(() => {
    if (!creating) return
    setTitle('')
    setStartsAt('')
    setDurationMinutes('120')
    setSignupCloseMinutesBefore('60')
    setChannelId('')
    setDescription('')
    setImageUrl('')
    setEmbedUseDiscordMentions(false)
    setAutoCreateSignupThread(false)
    setSpecOptions(DEFAULT_SPEC_OPTIONS)
    setMinSignupSpecs('1')
    setMaxSignupSpecs('5')
    setSignupLimit('')
    setAllowedRoleIds([])
    setBannedRoleIds([])
    setMentionRoleIds([])
    setReminders(defaultReminderFormRows())
    setSignupDiscordId('')
    setSignupName('')
    setSignupStatus('accepted')
    setSignupSpecs([])
    setSignupNote('')
    setDeleteConfirm('')
    setEventSetupErrors({})
    setEventOps(null)
  }, [creating])

  useEffect(() => {
    if (!ready || !event) return
    let active = true
    setSignupPlayersLoaded(false)

    void fetch(`/api/admin/signups?eventId=${encodeURIComponent(event.id)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load signup players.')
        return response.json() as Promise<AdminSignupManagerData>
      })
      .then((payload) => {
        if (!active) return
        setSignupPlayers(payload)
        setSignupDiscordId((current) =>
          current && combinedSignupPlayers(payload).some((player) => player.discordId === current) ? current : '',
        )
        setSignupPlayersLoaded(true)
      })
      .catch(() => {
        if (active) setSignupPlayersLoaded(true)
      })

    return () => {
      active = false
    }
  }, [event?.id, ready, refreshKey])

  useEffect(() => {
    if (creating || !event) return
    setDeleteConfirm('')
    setTitle(event.name)
    setStartsAt(toDatetimeLocalValue(event.startsAt))
    setDurationMinutes(event.endsAt ? String(Math.max(1, Math.round((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000))) : '120')
    setSignupCloseMinutesBefore(String(minutesBeforeEventStart(event.startsAt, event.closingTime) ?? 60))
    setChannelId(event.eventChannelId ?? event.raidHelperChannelId ?? '')
    setDescription(event.eventDescription ?? '')
    setImageUrl(event.eventImageUrl ?? '')
    setEmbedUseDiscordMentions(Boolean(event.embedUseDiscordMentions))
    setAutoCreateSignupThread(Boolean(event.autoCreateSignupThread))
    setMinSignupSpecs(String(event.minSignupSpecs ?? 1))
    setMaxSignupSpecs(String(event.maxSignupSpecs ?? 5))
    const eventSpecs = event.availableSpecOptions?.length
      ? event.availableSpecOptions
      : specOptionsFromNames(event.availableSpecs ?? [])
    setSpecOptions(event.source === 'native' ? applySpecLimits(eventSpecs, eventOps?.limits ?? []) : eventSpecs)
    setMentionRoleIds(event.mentionRoleIds ?? [])
    if (event.source === 'native' && eventOps) {
      setAllowedRoleIds(eventOps.roleGates.allowedRoleIds)
      setBannedRoleIds(eventOps.roleGates.bannedRoleIds)
      setSignupLimit(String(eventOps.limits.find((limit) => !limit.status && !limit.specName)?.limit ?? ''))
      setReminders(reminderRowsFromEventOps(eventOps.reminders))
    } else if (event.source !== 'native') {
      setAllowedRoleIds([])
      setBannedRoleIds([])
      setSignupLimit('')
      setReminders(defaultReminderFormRows())
    }
  }, [creating, event, eventOps])

  useEffect(() => {
    if (!signupDiscordId) {
      setSignupName('')
      setSignupStatus('accepted')
      setSignupSpecs([])
      setSignupNote('')
      return
    }

    const selectedPlayer = combinedSignupPlayers(signupPlayers).find((player) => player.discordId === signupDiscordId)
    const existingSignup = eventOps?.signups.find((signup) => signup.discordId === signupDiscordId)
    const existingStatus = existingSignup?.status === 'late'
      ? 'accepted'
      : existingSignup?.status === 'bench'
        ? 'maybe'
        : existingSignup?.status
    setSignupName(existingSignup?.name ?? selectedPlayer?.name ?? signupDiscordId)
    setSignupStatus(existingStatus ?? 'accepted')
    setSignupSpecs(existingSignup?.specs ?? [])
    setSignupNote(existingSignup?.note ?? '')
  }, [eventOps?.signups, signupDiscordId, signupPlayers])

  async function createEvent() {
    const errors = validateEventSetupForm({ title, startsAt, durationMinutes, signupCloseMinutesBefore })
    setEventSetupErrors(errors)
    if (Object.keys(errors).length) return { ok: false, message: 'Fix the highlighted event setup fields.' }

    const startsAtIso = localDatetimeToIso(startsAt)
    try {
      const result = await postAdminJson('/api/admin/event', {
        action: 'native-event.create',
        name: title,
        startsAt: startsAtIso,
        durationMinutes,
        closingTime: signupCloseTimeFromMinutes(startsAt, signupCloseMinutesBefore),
        channelId,
        description,
        imageUrl,
        embedUseDiscordMentions,
        autoCreateSignupThread,
        minSignupSpecs,
        maxSignupSpecs,
        specs: specOptions,
        signupLimit,
        allowedRoleIds,
        bannedRoleIds,
        mentionRoleIds,
        reminders: reminderPayload(reminders),
      })
      setEventSetupErrors({})
      if (isEventResult(result)) onEvent(result.event)
      if (isNativeEventOpsResult(result)) setEventOps(result.eventOps)
      return result
    } catch (error) {
      setEventSetupErrors(errorsFromAdminError(error))
      throw error
    }
  }

  async function updateEvent() {
    if (!event) return { ok: true, message: 'No event selected.' }
    const errors = validateEventSetupForm({ title, startsAt, durationMinutes, signupCloseMinutesBefore })
    setEventSetupErrors(errors)
    if (Object.keys(errors).length) return { ok: false, message: 'Fix the highlighted event setup fields.' }

    const startsAtIso = localDatetimeToIso(startsAt)
    try {
      const result = await postAdminJson('/api/admin/event', {
        action: 'native-event.update',
        eventId: event.id,
        name: title,
        startsAt: startsAtIso,
        durationMinutes,
        closingTime: signupCloseTimeFromMinutes(startsAt, signupCloseMinutesBefore),
        channelId,
        description,
        imageUrl,
        embedUseDiscordMentions,
        autoCreateSignupThread,
        minSignupSpecs,
        maxSignupSpecs,
        specs: specOptions,
        signupLimit,
        allowedRoleIds,
        bannedRoleIds,
        mentionRoleIds,
        reminders: reminderPayload(reminders),
      })
      setEventSetupErrors({})
      if (isEventResult(result)) onEvent(result.event)
      if (isNativeEventOpsResult(result)) setEventOps(result.eventOps)
      return result
    } catch (error) {
      setEventSetupErrors(errorsFromAdminError(error))
      throw error
    }
  }

  async function saveSignup() {
    if (!event) return { ok: true, message: 'No event selected.' }
    const selectedPlayer = combinedSignupPlayers(signupPlayers).find((player) => player.discordId === signupDiscordId)
    const existingSignup = eventOps?.signups.find((signup) => signup.discordId === signupDiscordId)
    const result = await postAdminJson('/api/admin/event', {
      action: 'native-event.signup',
      eventId: event.id,
      discordId: signupDiscordId,
      name: signupName || existingSignup?.name || selectedPlayer?.name || signupDiscordId,
      status: signupStatus,
      specs: signupSpecs,
      note: signupNote,
    })
    if (isEventResult(result)) onEvent(result.event)
    if (isNativeEventOpsResult(result)) setEventOps(result.eventOps)
    return result
  }

  async function removeSignup() {
    if (!event) return { ok: true, message: 'No event selected.' }
    const result = await postAdminJson('/api/admin/event', {
      action: 'native-event.signup.remove',
      eventId: event.id,
      discordId: signupDiscordId,
    })
    if (isEventResult(result)) onEvent(result.event)
    if (isNativeEventOpsResult(result)) setEventOps(result.eventOps)
    setSignupPlayers((current) => ({
      ...current,
      signedUpPlayers: current.signedUpPlayers.filter((player) => player.discordId !== signupDiscordId),
    }))
    setSignupDiscordId('')
    return result
  }

  async function saveEventAndPostSignupMessage() {
    if (!event) return { ok: true, message: 'No event selected.' }
    const saveResult = await updateEvent()
    if (isFailedAdminResult(saveResult)) return saveResult
    return postAdminJson('/api/admin/event', {
      action: 'native-event.post',
      eventId: event.id,
    })
  }

  async function saveEventAndSyncScheduledEvent() {
    if (!event) return { ok: true, message: 'No event selected.' }
    const saveResult = await updateEvent()
    if (isFailedAdminResult(saveResult)) return saveResult
    return postAdminJson('/api/admin/event', {
      action: 'native-event.scheduled-event',
      eventId: event.id,
    })
  }

  async function deleteSelectedEvent() {
    if (!event) return { ok: true, message: 'No event selected.' }
    if (deleteConfirm !== event.name) {
      return { ok: false, message: 'Type the event name exactly before deleting.' }
    }

    const result = await postAdminJson('/api/admin/event', {
      action: 'event.delete',
      eventId: event.id,
    })
    const deletedEventId = typeof result === 'object' && result && 'deletedEventId' in result
      ? String((result as { deletedEventId?: unknown }).deletedEventId ?? '')
      : event.id
    onDeleted(deletedEventId)
    setEventOps(null)
    setDeleteConfirm('')
    return result
  }

  const nativeSelected = event?.source === 'native'
  const signupPlayerOptions = combinedSignupPlayers(signupPlayers)
  const selectedSignup = eventOps?.signups.find((signup) => signup.discordId === signupDiscordId)
  const editingNativeEvent = !creating && nativeSelected
  const eventSetupActionLabel = creating
    ? 'Create event'
    : editingNativeEvent
      ? 'Save event'
      : 'Create native event'
  const eventSetupBusyLabel = creating || !editingNativeEvent ? 'native-event-create' : 'native-event-update'
  const eventSetupAction = creating || !editingNativeEvent ? createEvent : updateEvent
  const deleteReady = Boolean(event && deleteConfirm === event.name)

  return (
    <>
      <AdminSection
        id="admin-event-overview"
        title="Overview"
        actions={
          <button
            type="button"
            disabled={busy === eventSetupBusyLabel}
            onClick={() => void onRun(eventSetupBusyLabel, eventSetupAction)}
          >
            {eventSetupActionLabel}
          </button>
        }
      >
        <div className="event-result-grid">
          <div className="event-result-card">
            <strong>{creating ? 'New native event' : nativeSelected ? 'Native event' : 'Native event copy'}</strong>
            {!creating && !nativeSelected ? (
              <small>Match settings below apply to the selected event. Event setup changes here create a new native event.</small>
            ) : null}
            <label>
              Title
              <input
                value={title}
                aria-invalid={Boolean(eventSetupErrors.title)}
                onChange={(event) => {
                  clearEventSetupError(setEventSetupErrors, 'title')
                  setTitle(event.currentTarget.value)
                }}
              />
              <FieldError message={eventSetupErrors.title} />
            </label>
            <label>
              Start time
              <DateTimeLocalInput
                value={startsAt}
                aria-invalid={Boolean(eventSetupErrors.startsAt)}
                onChange={(event) => {
                  clearEventSetupError(setEventSetupErrors, 'startsAt')
                  setStartsAt(event.currentTarget.value)
                }}
              />
              <FieldError message={eventSetupErrors.startsAt} />
            </label>
            <label>
              Duration minutes
              <input
                type="number"
                min="1"
                max="1440"
                value={durationMinutes}
                aria-invalid={Boolean(eventSetupErrors.durationMinutes)}
                onChange={(event) => {
                  clearEventSetupError(setEventSetupErrors, 'durationMinutes')
                  setDurationMinutes(event.currentTarget.value)
                }}
              />
              <FieldError message={eventSetupErrors.durationMinutes} />
            </label>
            <label>
              Signup closes minutes before start
              <input
                type="number"
                min="0"
                max="10080"
                value={signupCloseMinutesBefore}
                aria-invalid={Boolean(eventSetupErrors.signupCloseMinutesBefore)}
                onChange={(event) => {
                  clearEventSetupError(setEventSetupErrors, 'signupCloseMinutesBefore')
                  setSignupCloseMinutesBefore(event.currentTarget.value)
                }}
              />
              <FieldError message={eventSetupErrors.signupCloseMinutesBefore} />
            </label>
            <label>
              Discord channel
              <select value={channelId} onChange={(event) => setChannelId(event.currentTarget.value)}>
                <option value="">Choose channel</option>
                {selectedMissingFromOptions(channelId, discordOptions.channels) ? (
                  <option value={channelId}>{channelId}</option>
                ) : null}
                {discordOptions.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="embed-color-indicator">
              <span>Embed color</span>
              <div className="embed-color-indicator-options">
                <span><i data-state="open" /> Green: signups open</span>
                <span><i data-state="closing" /> Yellow: under 1 hour left</span>
                <span><i data-state="closed" /> Red: signups closed</span>
              </div>
            </div>
            <label>
              Image URL
              <input value={imageUrl} inputMode="url" onChange={(event) => setImageUrl(event.currentTarget.value)} />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={embedUseDiscordMentions}
                onChange={(event) => setEmbedUseDiscordMentions(event.currentTarget.checked)}
              />
              Use Discord mentions for player names in signup embeds
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoCreateSignupThread}
                onChange={(event) => setAutoCreateSignupThread(event.currentTarget.checked)}
              />
              Automatically create a discussion thread when posting signup message
            </label>
          </div>

          <div className="event-result-card">
            <strong>Description</strong>
            <label>
              Event description
              <textarea rows={8} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
            </label>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        id="admin-event-signup-options"
        title="Signup Options"
        actions={
          <button
            type="button"
            disabled={busy === eventSetupBusyLabel}
            onClick={() => void onRun(eventSetupBusyLabel, eventSetupAction)}
          >
            {eventSetupActionLabel}
          </button>
        }
      >
        <div className="event-result-grid">
          <div className="event-result-card">
            <strong>Spec definitions</strong>
            <label>
              Specs
              <SpecOptionEditor
                value={specOptions}
                emojiOptions={discordOptions.emojis}
                onChange={setSpecOptions}
              />
            </label>
          </div>
          <div className="event-result-card">
            <strong>Signup limits</strong>
            <label>
              Total accepted limit
              <input type="number" min="1" value={signupLimit} onChange={(event) => setSignupLimit(event.currentTarget.value)} />
            </label>
            <label>
              Minimum specs per signup
              <input
                type="number"
                min="0"
                max="25"
                value={minSignupSpecs}
                onChange={(event) => setMinSignupSpecs(event.currentTarget.value)}
              />
            </label>
            <label>
              Maximum specs per signup
              <input
                type="number"
                min="1"
                max="25"
                value={maxSignupSpecs}
                onChange={(event) => setMaxSignupSpecs(event.currentTarget.value)}
              />
            </label>
          </div>
          <div className="event-result-card">
            <strong>Discord gates</strong>
            <label>
              Mention roles
              <RoleMultiSelect
                options={discordOptions.roles}
                value={mentionRoleIds}
                onChange={setMentionRoleIds}
              />
            </label>
            <label>
              Allowed roles
              <RoleMultiSelect
                options={discordOptions.roles}
                value={allowedRoleIds}
                onChange={setAllowedRoleIds}
              />
            </label>
            <label>
              Banned roles
              <RoleMultiSelect
                options={discordOptions.roles}
                value={bannedRoleIds}
                onChange={setBannedRoleIds}
              />
            </label>
            {discordOptions.error ? <small>{discordOptions.error}</small> : null}
            {discordOptions.stale ? <small>Showing cached Discord options.</small> : null}
          </div>
        </div>
      </AdminSection>

      <AdminSection
        id="admin-event-reminders"
        title="Reminders"
        actions={
          <button
            type="button"
            disabled={busy === eventSetupBusyLabel}
            onClick={() => void onRun(eventSetupBusyLabel, eventSetupAction)}
          >
            {eventSetupActionLabel}
          </button>
        }
      >
        <div className="event-result-grid">
          <div className="event-result-card">
            <div className="event-link-editor-heading">
              <strong>Reminder schedule</strong>
              <button type="button" className="secondary" onClick={() => setReminders((current) => [...current, createReminderFormRow()])}>
                Add reminder
              </button>
            </div>
            <ReminderEditor
              value={reminders}
              channels={discordOptions.channels}
              onChange={setReminders}
            />
          </div>
        </div>
      </AdminSection>

      {creating ? null : (
        <AdminSection id="admin-signups" title="Signup Management">
          <div className="event-result-grid">
            <div className="event-result-card">
              <strong>Signup editor</strong>
              {!ready ? (
                <small>Loading signup editor.</small>
              ) : (
                <>
                  {!editingNativeEvent ? (
                    <small>Create a native event before managing signup specs, notes, and removals.</small>
                  ) : null}
                  <label>
                    Player
                    <select
                      value={signupDiscordId}
                      disabled={!editingNativeEvent || !signupPlayersLoaded || !signupPlayerOptions.length}
                      onChange={(event) => setSignupDiscordId(event.currentTarget.value)}
                    >
                      <option value="">
                        {signupPlayersLoaded
                          ? signupPlayerOptions.length
                            ? 'Choose player'
                            : 'No players available'
                          : 'Loading players'}
                      </option>
                      {signupPlayerOptions.map((player) => (
                        <option key={player.discordId} value={player.discordId}>
                          {formatParticipantLabel(player)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={signupStatus}
                      disabled={!editingNativeEvent}
                      onChange={(event) => setSignupStatus(event.currentTarget.value)}
                    >
                      {[
                        { value: 'accepted', label: 'available' },
                        { value: 'maybe', label: 'maybe' },
                        { value: 'absent', label: 'absent' },
                      ].map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Specs
                    <SpecCheckboxes
                      options={specOptions}
                      value={signupSpecs}
                      disabled={!editingNativeEvent}
                      onChange={setSignupSpecs}
                    />
                  </label>
                  <label>
                    Note
                    <textarea
                      rows={2}
                      value={signupNote}
                      disabled={!editingNativeEvent}
                      onChange={(event) => setSignupNote(event.currentTarget.value)}
                    />
                  </label>
                  <div className="button-row left">
                    <button
                      type="button"
                      disabled={!editingNativeEvent || !signupDiscordId || busy === 'native-event-signup'}
                      onClick={() => void onRun('native-event-signup', saveSignup)}
                    >
                      Save signup
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={!editingNativeEvent || !selectedSignup || busy === 'native-event-signup-remove'}
                      onClick={() => void onRun('native-event-signup-remove', removeSignup)}
                    >
                      Remove signup
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </AdminSection>
      )}

      {creating ? null : (
        <AdminSection
          id="admin-event-discord"
          title="Discord Publishing"
          actions={
            <>
              <button type="button" disabled={!editingNativeEvent || busy === 'native-event-post'} onClick={() => void onRun('native-event-post', saveEventAndPostSignupMessage)}>
                Post signup message
              </button>
              <button type="button" disabled={!editingNativeEvent || busy === 'native-event-scheduled'} onClick={() => void onRun('native-event-scheduled', saveEventAndSyncScheduledEvent)}>
                Sync Scheduled Event
              </button>
              <button type="button" disabled={!editingNativeEvent || busy === 'native-event-close'} onClick={() => void onRun('native-event-close', () => postAdminJson('/api/admin/event', { action: 'native-event.close', eventId: event?.id }))}>
                Close signups
              </button>
              <button type="button" disabled={!editingNativeEvent || busy === 'native-event-open'} onClick={() => void onRun('native-event-open', () => postAdminJson('/api/admin/event', { action: 'native-event.open', eventId: event?.id }))}>
                Reopen
              </button>
            </>
          }
        >
          <div className="event-result-grid">
            <div className="event-result-card">
              <strong>Targeted message</strong>
              {!editingNativeEvent ? <small>Discord publishing controls require a native event.</small> : null}
              <label>
                Target
                <select
                  value={targetGroup}
                  disabled={!editingNativeEvent}
                  onChange={(event) => setTargetGroup(event.currentTarget.value)}
                >
                  {['signed', 'maybe', 'unsigned', 'admins'].map((target) => (
                    <option key={target} value={target}>{target}</option>
                  ))}
                </select>
              </label>
              <label>
                Message
                <textarea
                  rows={3}
                  value={targetMessage}
                  disabled={!editingNativeEvent}
                  onChange={(event) => setTargetMessage(event.currentTarget.value)}
                />
              </label>
              <div className="button-row left">
                <button type="button" disabled={!editingNativeEvent || busy === 'native-event-message'} onClick={() => void onRun('native-event-message', () => postAdminJson('/api/admin/event', { action: 'native-event.message', eventId: event?.id, target: targetGroup, message: targetMessage }))}>
                  Send message
                </button>
              </div>
            </div>
          </div>
        </AdminSection>
      )}

      {creating || !event ? null : (
        <AdminSection
          id="admin-event-danger"
          title="Danger Zone"
          actions={
            <button
              type="button"
              className="danger-button"
              disabled={busy === 'event-delete' || !deleteReady}
              onClick={() => void onRun('event-delete', deleteSelectedEvent)}
            >
              Delete event
            </button>
          }
        >
          <div className="event-result-grid">
            <div className="event-result-card danger-card">
              <strong>Delete this event</strong>
              <p>
                Deletes this event and its related signups, teams, draft data, ratings, Discord message records,
                and generated event data. Active events cannot be deleted.
              </p>
              <label>
                Type event name to confirm
                <input
                  value={deleteConfirm}
                  placeholder={event.name}
                  onChange={(event) => setDeleteConfirm(event.currentTarget.value)}
                />
              </label>
            </div>
          </div>
        </AdminSection>
      )}
    </>
  )
}

function RoleMultiSelect({
  options,
  value,
  onChange,
}: {
  options: DiscordGuildOptionsData['roles']
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listboxId = useId()
  const selected = normalizeSelectedOptions(value)
  const selectedIds = new Set(selected)
  const selectedRoles = selected.map((roleId) =>
    options.find((role) => role.id === roleId) ?? { id: roleId, name: roleId },
  )
  const filteredOptions = options
    .filter((role) => !selectedIds.has(role.id))
    .filter((role) => role.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 12)
  const activeRole = filteredOptions[activeIndex]

  useEffect(() => {
    setActiveIndex(0)
  }, [query, value, options])

  useEffect(() => {
    if (!open) return

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!rootRef.current?.contains(target)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  function addRole(roleId: string) {
    onChange([...selected, roleId])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function removeRole(roleId: string) {
    onChange(selected.filter((selectedRoleId) => selectedRoleId !== roleId))
    inputRef.current?.focus()
  }

  return (
    <div className="role-combobox" ref={rootRef}>
      <div
        className="role-combobox-control"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) inputRef.current?.focus()
        }}
      >
        {selectedRoles.map((role) => (
            <span className="role-chip" key={role.id}>
              @{role.name}
              <button
                type="button"
                aria-label={`Remove ${role.name}`}
                onClick={() => removeRole(role.id)}
              >
                x
              </button>
            </span>
          ))}
        <input
          ref={inputRef}
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeRole ? `${listboxId}-${activeRole.id}` : undefined}
          placeholder={selectedRoles.length ? 'Add role' : 'Search roles'}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              return
            }
            if (event.key === 'Backspace' && !query && selected.at(-1)) {
              event.preventDefault()
              removeRole(selected.at(-1) ?? '')
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)))
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => Math.max(index - 1, 0))
              return
            }
            if (event.key === 'Enter' && activeRole) {
              event.preventDefault()
              addRole(activeRole.id)
            }
          }}
        />
      </div>
      {open ? (
        <div className="role-combobox-menu" id={listboxId} role="listbox" aria-multiselectable="true">
          {filteredOptions.length ? (
            filteredOptions.map((role, index) => (
              <button
                key={role.id}
                id={`${listboxId}-${role.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex ? 'true' : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => addRole(role.id)}
              >
                @{role.name}
              </button>
            ))
          ) : (
            <div className="empty-inline">No matching roles</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null
}

const REMINDER_KIND_OPTIONS = [
  { value: 'signup_close', label: 'Signup close' },
  { value: 'event_start', label: 'Event start' },
]

const REMINDER_TARGET_OPTIONS = [
  { value: 'signed', label: 'Signed' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'bench', label: 'Bench' },
  { value: 'maybe_bench', label: 'Maybe + bench' },
  { value: 'unsigned', label: 'Unsigned' },
  { value: 'admins', label: 'Admins' },
  { value: 'event_channel', label: 'Event channel' },
]

function ReminderEditor({
  value,
  channels,
  onChange,
}: {
  value: NativeReminderFormRow[]
  channels: DiscordGuildOptionsData['channels']
  onChange: (value: NativeReminderFormRow[]) => void
}) {
  function updateReminder(clientId: string, patch: Partial<NativeReminderFormRow>) {
    onChange(value.map((reminder) => reminder.clientId === clientId ? { ...reminder, ...patch } : reminder))
  }

  function removeReminder(clientId: string) {
    onChange(value.filter((reminder) => reminder.clientId !== clientId))
  }

  if (!value.length) {
    return <div className="empty-inline">No reminders configured</div>
  }

  return (
    <div className="reminder-editor">
      {value.map((reminder) => (
        <div className="reminder-row" key={reminder.clientId}>
          <label>
            Trigger
            <select value={reminder.kind} onChange={(event) => updateReminder(reminder.clientId, { kind: event.currentTarget.value })}>
              {REMINDER_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Target
            <select value={reminder.target} onChange={(event) => updateReminder(reminder.clientId, { target: event.currentTarget.value })}>
              {REMINDER_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Minutes before
            <input
              type="number"
              min="0"
              max="43200"
              value={reminder.offsetMinutes}
              onChange={(event) => updateReminder(reminder.clientId, { offsetMinutes: event.currentTarget.value })}
            />
          </label>
          <label>
            Channel
            <select value={reminder.channelId} onChange={(event) => updateReminder(reminder.clientId, { channelId: event.currentTarget.value })}>
              <option value="">Event channel</option>
              {selectedMissingFromOptions(reminder.channelId, channels) ? (
                <option value={reminder.channelId}>{reminder.channelId}</option>
              ) : null}
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </label>
          <label className="reminder-message-field">
            Message
            <textarea
              rows={2}
              value={reminder.message}
              onChange={(event) => updateReminder(reminder.clientId, { message: event.currentTarget.value })}
            />
          </label>
          <div className="reminder-row-actions">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={reminder.enabled}
                onChange={(event) => updateReminder(reminder.clientId, { enabled: event.currentTarget.checked })}
              />
              Enabled
            </label>
            {reminder.lastSentAt ? <small>Sent {shortDate(reminder.lastSentAt)}</small> : null}
            <button type="button" className="secondary" onClick={() => removeReminder(reminder.clientId)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SpecOptionEditor({
  value,
  emojiOptions,
  onChange,
}: {
  value: EventSpecOption[]
  emojiOptions: DiscordGuildOptionsData['emojis']
  onChange: (value: EventSpecOption[]) => void
}) {
  function updateSpec(index: number, patch: Partial<EventSpecOption>) {
    onChange(value.map((spec, specIndex) => specIndex === index ? { ...spec, ...patch } : spec))
  }

  function removeSpec(index: number) {
    onChange(value.filter((_, specIndex) => specIndex !== index))
  }

  return (
    <div className="spec-option-editor">
      {value.map((spec, index) => (
        <div className="spec-option-row" key={index}>
          <SpecEmojiPicker
            value={spec.emoji ?? ''}
            options={emojiOptions}
            onChange={(emoji) => updateSpec(index, { emoji })}
          />
          <input
            value={spec.name}
            aria-label="Spec name"
            placeholder="Spec name"
            onChange={(event) => updateSpec(index, { name: event.currentTarget.value })}
          />
          <input
            type="number"
            min="1"
            max="500"
            value={spec.limit ?? ''}
            aria-label="Spec limit"
            placeholder="Limit"
            onChange={(event) => updateSpec(index, { limit: event.currentTarget.value ? Number(event.currentTarget.value) : undefined })}
          />
          <button type="button" className="secondary" onClick={() => removeSpec(index)}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() => onChange([...value, { emoji: '', name: '' }])}
      >
        Add spec
      </button>
    </div>
  )
}

function SpecEmojiPicker({
  value,
  options,
  onChange,
}: {
  value: string
  options: DiscordGuildOptionsData['emojis']
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ready = useClientReady()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const popoverId = useId()
  const customEmojis = options.map((emoji) => ({
    id: emoji.id,
    names: [emoji.name, emoji.guildName].filter(Boolean) as string[],
    imgUrl: emoji.url,
  }))
  const emojiById = new Map(options.map((emoji) => [emoji.id, emoji]))

  useEffect(() => {
    if (!open) return

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!rootRef.current?.contains(target)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  function chooseEmoji(emoji: EmojiClickData) {
    if (emoji.isCustom) {
      onChange(emojiById.get(emoji.emoji)?.mention ?? emoji.emoji)
    } else {
      onChange(emoji.emoji)
    }
    setOpen(false)
  }

  return (
    <div className="spec-emoji-picker" ref={rootRef}>
      <button
        type="button"
        className="spec-emoji-trigger"
        aria-label="Choose spec emoji"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? <EmojiPreview value={value} /> : <span className="spec-emoji-placeholder">Emoji</span>}
      </button>
      {open ? (
        <div className="spec-emoji-popover" id={popoverId}>
          {ready ? (
            <EmojiPicker
              autoFocusSearch
              customEmojis={customEmojis}
              emojiStyle={EmojiStyle.TWITTER}
              getEmojiUrl={twemojiUrl}
              height={380}
              lazyLoadEmojis
              onEmojiClick={chooseEmoji}
              previewConfig={{ showPreview: false }}
              searchPlaceholder="Search emojis"
              skinTonesDisabled
              theme={Theme.DARK}
              width="100%"
            />
          ) : (
            <div className="empty-inline">Loading emojis...</div>
          )}
          <label>
            Custom value
            <input
              value={value}
              placeholder="Paste emoji or <:name:id>"
              onChange={(event) => onChange(event.currentTarget.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}

function SpecCheckboxes({
  options,
  value,
  disabled,
  onChange,
}: {
  options: EventSpecOption[]
  value: string[]
  disabled?: boolean
  onChange: (value: string[]) => void
}) {
  const selected = new Set(value)
  const usableOptions = options.filter((spec) => spec.name.trim())

  if (!usableOptions.length) return <div className="empty-inline">No specs configured</div>

  return (
    <div className="spec-checkbox-grid">
      {usableOptions.map((spec) => (
        <label className="checkbox-field" key={spec.name}>
          <input
            type="checkbox"
            checked={selected.has(spec.name)}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.currentTarget.checked
                ? [...value, spec.name]
                : value.filter((item) => item !== spec.name))
            }}
          />
          <SpecLabel spec={spec} />
        </label>
      ))}
    </div>
  )
}

function normalizeSelectedOptions(value: string[]) {
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)))
}

function validateEventSetupForm(values: {
  title: string
  startsAt: string
  durationMinutes: string
  signupCloseMinutesBefore: string
}): EventSetupErrors {
  const errors: EventSetupErrors = {}
  if (!values.title.trim()) errors.title = 'Event title is required.'
  if (!values.startsAt.trim() || Number.isNaN(Date.parse(values.startsAt))) {
    errors.startsAt = 'Event time must be a valid date.'
  }

  const duration = Number(values.durationMinutes)
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
    errors.durationMinutes = 'Duration must be a whole number from 1 to 1440.'
  }

  const closeMinutes = Number(values.signupCloseMinutesBefore)
  if (!Number.isInteger(closeMinutes) || closeMinutes < 0 || closeMinutes > 10080) {
    errors.signupCloseMinutesBefore = 'Signup close offset must be a whole number from 0 to 10080.'
  }

  return errors
}

function clearEventSetupError(
  setErrors: Dispatch<SetStateAction<EventSetupErrors>>,
  field: EventSetupField,
) {
  setErrors((current) => {
    if (!current[field]) return current
    const next = { ...current }
    delete next[field]
    return next
  })
}

function applySpecLimits(specs: EventSpecOption[], limits: NativeEventOpsData['limits']) {
  const limitsBySpec = new Map(limits
    .filter((limit) => limit.specName && !limit.status)
    .map((limit) => [limit.specName, limit.limit]))

  return specs.map((spec) => ({
    ...spec,
    limit: limitsBySpec.get(spec.name) ?? spec.limit,
  }))
}

function defaultReminderFormRows() {
  return [
    createReminderFormRow({
      kind: 'signup_close',
      target: 'unsigned',
      offsetMinutes: 120,
      message: 'Signups close soon.',
      enabled: true,
    }),
    createReminderFormRow({
      kind: 'event_start',
      target: 'signed',
      offsetMinutes: 60,
      message: 'Hamma Bowl starts soon.',
      enabled: true,
    }),
    createReminderFormRow({
      kind: 'event_start',
      target: 'admins',
      offsetMinutes: 30,
      message: 'Review signups before event start.',
      enabled: true,
    }),
  ]
}

function reminderRowsFromEventOps(reminders: NativeEventOpsData['reminders']) {
  return reminders.length
    ? reminders.map((reminder) => createReminderFormRow(reminder))
    : defaultReminderFormRows()
}

function createReminderFormRow(reminder: Partial<NativeEventOpsData['reminders'][number]> = {}): NativeReminderFormRow {
  return {
    clientId: newClientId('reminder'),
    id: reminder.id,
    kind: reminder.kind ?? 'event_start',
    target: reminder.target ?? 'signed',
    offsetMinutes: String(reminder.offsetMinutes ?? 60),
    channelId: reminder.channelId ?? '',
    message: reminder.message ?? '',
    enabled: reminder.enabled ?? true,
    lastSentAt: reminder.lastSentAt,
  }
}

function reminderPayload(reminders: NativeReminderFormRow[]) {
  return reminders.map((reminder) => ({
    id: reminder.id,
    kind: reminder.kind,
    target: reminder.target,
    offsetMinutes: reminder.offsetMinutes,
    channelId: reminder.channelId,
    message: reminder.message,
    enabled: reminder.enabled,
  }))
}

function newClientId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
}

function specOptionsFromNames(names: string[]) {
  const specs = names.map((name) => ({ name }))
  return specs.length ? specs : DEFAULT_SPEC_OPTIONS
}

function SpecLabel({ spec }: { spec: EventSpecOption }) {
  return (
    <span className="spec-label">
      {spec.emoji ? <EmojiPreview value={spec.emoji} /> : null}
      <span>{spec.name}</span>
    </span>
  )
}

function EmojiPreview({ value }: { value: string }) {
  const customEmoji = parseCustomDiscordEmoji(value)
  if (customEmoji) {
    return (
      <img
        className="emoji-preview"
        src={`https://cdn.discordapp.com/emojis/${customEmoji.id}.${customEmoji.animated ? 'gif' : 'png'}`}
        alt={`:${customEmoji.name}:`}
        loading="lazy"
      />
    )
  }
  return (
    <img
      className="emoji-preview"
      src={twemojiUrl(nativeEmojiToUnified(value))}
      alt={value}
      loading="lazy"
    />
  )
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

function twemojiUrl(unified: string) {
  return `${TWEMOJI_BASE_URL}/${normalizeTwemojiUnified(unified)}.svg`
}

function nativeEmojiToUnified(value: string) {
  return Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join('-')
}

function normalizeTwemojiUnified(unified: string) {
  return unified
    .toLowerCase()
    .split('-')
    .filter((part) => part !== 'fe0f')
    .join('-')
}

function selectedMissingFromOptions(value: string, options: Array<{ id: string }>) {
  return Boolean(value && !options.some((option) => option.id === value))
}

function useClientReady() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return ready
}

function formatWholeDollarInput(value: number) {
  return value.toLocaleString('en-US')
}

function formatWholeDollarText(value: string) {
  const digits = parseWholeDollarText(value)
  return digits ? Number(digits).toLocaleString('en-US') : ''
}

function parseWholeDollarText(value: string) {
  return value.replace(/[^\d]/g, '')
}

function EventIdentityControls({
  event,
  busy,
  onRun,
  onEvent,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
}) {
  const [nameOverride, setNameOverride] = useState(event.nameOverride ?? '')
  const [eventDescription, setEventDescription] = useState(event.eventDescription ?? '')
  const [eventLinks, setEventLinks] = useState<EventLink[]>(event.eventLinks)
  const [trophyId, setTrophyId] = useState<EventTrophyId>(event.trophyId)
  const [streamUrl, setStreamUrl] = useState(event.twitchStreamUrl ?? '')
  const [vodUrl, setVodUrl] = useState(event.twitchVodUrl ?? '')
  const [honuZoneId, setHonuZoneId] = useState(event.honuZoneId.toString())
  const [openIconPicker, setOpenIconPicker] = useState<number | null>(null)

  useEffect(() => {
    setNameOverride(event.nameOverride ?? '')
    setEventDescription(event.eventDescription ?? '')
    setEventLinks(event.eventLinks)
    setTrophyId(event.trophyId)
    setStreamUrl(event.twitchStreamUrl ?? '')
    setVodUrl(event.twitchVodUrl ?? '')
    setHonuZoneId(event.honuZoneId.toString())
  }, [event])

  useEffect(() => {
    if (openIconPicker === null) return

    function closePickerOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.event-icon-picker')) return
      setOpenIconPicker(null)
    }

    function closePickerOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenIconPicker(null)
    }

    document.addEventListener('pointerdown', closePickerOnOutsidePointer)
    document.addEventListener('keydown', closePickerOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closePickerOnOutsidePointer)
      document.removeEventListener('keydown', closePickerOnEscape)
    }
  }, [openIconPicker])

  function addEventLink() {
    setEventLinks((current) => [...current, { name: '', url: '', icon: 'Link' }])
  }

  function updateEventLink(index: number, patch: Partial<EventLink>) {
    setEventLinks((current) =>
      current.map((link, linkIndex) => (linkIndex === index ? { ...link, ...patch } : link)),
    )
  }

  function removeEventLink(index: number) {
    setEventLinks((current) => current.filter((_, linkIndex) => linkIndex !== index))
    setOpenIconPicker((current) => (current === index ? null : current))
  }

  async function saveEventDetails() {
    const result = await postAdminJson('/api/admin/event', {
      eventId: event.id,
      nameOverride,
      eventDescription,
      eventLinks,
      trophyId,
      twitchStreamUrl: streamUrl,
      twitchVodUrl: vodUrl,
      honuZoneId,
    })
    if (isEventResult(result) && result.event) onEvent(result.event)
    return result
  }

  async function resetHonuReports() {
    const result = await postAdminJson('/api/admin/event', {
      eventId: event.id,
      resetHonuReports: true,
    })
    if (isEventResult(result) && result.event) onEvent(result.event)
    return result
  }

  async function generateHonuReports() {
    const result = await postAdminJson('/api/admin/event', {
      eventId: event.id,
      generateHonuReports: true,
    })
    if (isEventResult(result) && result.event) onEvent(result.event)
    return result
  }

  return (
    <AdminSection id="admin-event-details" title="Event Details">
      <div className="event-result-grid">
        <div className="event-result-card">
          <strong>Name override</strong>
          <label>
            Display name
            <input
              value={nameOverride}
              placeholder={event.name}
              onChange={(event) => setNameOverride(event.currentTarget.value)}
            />
          </label>
          <label>
            Trophy
            <select
              value={trophyId}
              onChange={(event) => setTrophyId(event.currentTarget.value as EventTrophyId)}
            >
              {EVENT_TROPHY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="event-result-card event-details-card">
          <strong>Event page details</strong>
          <label>
            Description
            <textarea
              value={eventDescription}
              rows={3}
              onChange={(event) => setEventDescription(event.currentTarget.value)}
            />
          </label>
          <div className="event-link-editor">
            <div className="event-link-editor-heading">
              <span>Links</span>
              <button type="button" onClick={addEventLink}>
                Add link
              </button>
            </div>
            {eventLinks.length ? (
              eventLinks.map((link, index) => (
                <div className="event-link-editor-row" key={index}>
                  <label>
                    Name
                    <input
                      value={link.name}
                      onChange={(event) => updateEventLink(index, { name: event.currentTarget.value })}
                    />
                  </label>
                  <label>
                    URL
                    <input
                      value={link.url}
                      inputMode="url"
                      placeholder="https://"
                      onChange={(event) => updateEventLink(index, { url: event.currentTarget.value })}
                    />
                  </label>
                  <div className="event-icon-picker">
                    <button
                      type="button"
                      className="event-icon-picker-trigger"
                      aria-haspopup="dialog"
                      aria-expanded={openIconPicker === index}
                      onClick={() => setOpenIconPicker((current) => (current === index ? null : index))}
                    >
                      <EventLinkIcon name={link.icon} />
                      <span>{EVENT_LINK_ICON_OPTIONS.find((option) => option.name === link.icon)?.label ?? 'Icon'}</span>
                    </button>
                    {openIconPicker === index ? (
                      <div className="event-icon-picker-popup" role="dialog" aria-label={`Icon for ${link.name || 'event link'}`}>
                        {EVENT_LINK_ICON_OPTIONS.map((option) => (
                          <button
                            key={option.name}
                            type="button"
                            className={link.icon === option.name ? 'active' : ''}
                            title={option.label}
                            aria-label={option.label}
                            onClick={() => {
                              updateEventLink(index, { icon: option.name })
                              setOpenIconPicker(null)
                            }}
                          >
                            <EventLinkIcon name={option.name} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" className="text-button danger" onClick={() => removeEventLink(index)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <small>No links configured.</small>
            )}
          </div>
        </div>

        <div className="event-result-card">
          <strong>Twitch links</strong>
          <label>
            Live stream
            <input
              type="url"
              value={streamUrl}
              placeholder="https://www.twitch.tv/..."
              onChange={(event) => setStreamUrl(event.currentTarget.value)}
            />
          </label>
          <label>
            VOD
            <input
              type="url"
              value={vodUrl}
              placeholder="https://www.twitch.tv/videos/..."
              onChange={(event) => setVodUrl(event.currentTarget.value)}
            />
          </label>
        </div>

        <div className="event-result-card">
          <strong>Honu alert</strong>
          <label>
            Zone
            <select value={honuZoneId} onChange={(event) => setHonuZoneId(event.currentTarget.value)}>
              {HONU_ALERT_ZONE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <small>
            {event.honuAlertId ? (
              <a href={`https://wt.honu.pw/alert/${event.honuAlertId}`} target="_blank" rel="noreferrer">
                Honu alert {event.honuAlertId}
              </a>
            ) : (
              'A Honu alert is created after the final round ends.'
            )}
          </small>
          <div className="button-row left">
            <button
              type="button"
              disabled={busy === 'honu-generate'}
              onClick={() => void onRun('honu-generate', generateHonuReports)}
            >
              Generate Honu links
            </button>
            <button
              type="button"
              disabled={busy === 'honu-reset'}
              onClick={() => void onRun('honu-reset', resetHonuReports)}
            >
              Reset Honu links
            </button>
          </div>
        </div>
      </div>
      <div className="admin-section-footer">
        <button
          type="button"
          disabled={busy === 'event-details'}
          onClick={() => void onRun('event-details', saveEventDetails)}
        >
          Save
        </button>
      </div>
    </AdminSection>
  )
}

function DraftControls({
  event,
  busy,
  onRun,
  onEvent,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
}) {
  const [draftStartMinutesBefore, setDraftStartMinutesBefore] = useState(
    event.draftStartMinutesBefore?.toString() ?? '',
  )
  const [salaryPool, setSalaryPool] = useState(event.salaryPool.toString())
  const [bonusPool, setBonusPool] = useState(event.bonusPool.toString())
  const [maxPlayerBonus, setMaxPlayerBonus] = useState(event.maxPlayerBonus.toString())
  const [bidIncrement, setBidIncrement] = useState(event.bidIncrement.toString())

  useEffect(() => {
    setDraftStartMinutesBefore(event.draftStartMinutesBefore?.toString() ?? '')
    setSalaryPool(formatWholeDollarInput(event.salaryPool))
    setBonusPool(formatWholeDollarInput(event.bonusPool))
    setMaxPlayerBonus(formatWholeDollarInput(event.maxPlayerBonus))
    setBidIncrement(formatWholeDollarInput(event.bidIncrement))
  }, [event])

  async function saveDraftSettings() {
    const result = await postAdminJson('/api/admin/event', {
      eventId: event.id,
      salaryPool: parseWholeDollarText(salaryPool),
      bonusPool: parseWholeDollarText(bonusPool),
      maxPlayerBonus: parseWholeDollarText(maxPlayerBonus),
      bidIncrement: parseWholeDollarText(bidIncrement),
      draftStartMinutesBefore,
    })
    if (isEventResult(result) && result.event) onEvent(result.event)
    return result
  }

  return (
    <AdminSection id="admin-draft" title="Draft">
      <div className="event-result-grid">
        <div className="event-result-card">
          <strong>Budgets</strong>
          <label>
            Total salary pool
            <input
              inputMode="numeric"
              value={salaryPool}
              onChange={(event) => setSalaryPool(formatWholeDollarText(event.currentTarget.value))}
            />
          </label>
          <label>
            Total bonus pool
            <input
              inputMode="numeric"
              value={bonusPool}
              onChange={(event) => setBonusPool(formatWholeDollarText(event.currentTarget.value))}
            />
          </label>
          <label>
            Max player bonus
            <input
              inputMode="numeric"
              value={maxPlayerBonus}
              onChange={(event) => setMaxPlayerBonus(formatWholeDollarText(event.currentTarget.value))}
            />
          </label>
          <label>
            Bid increment
            <input
              inputMode="numeric"
              value={bidIncrement}
              onChange={(event) => setBidIncrement(formatWholeDollarText(event.currentTarget.value))}
            />
          </label>
        </div>

        <div className="event-result-card">
          <strong>Timing</strong>
          <label>
            Minutes before event start
            <input
              type="number"
              min="0"
              max="1440"
              step="1"
              value={draftStartMinutesBefore}
              placeholder="Use event start"
              onChange={(event) => setDraftStartMinutesBefore(event.currentTarget.value)}
            />
          </label>
          <small>Leave blank to count down to the event start after signups close.</small>
        </div>
      </div>
      <div className="admin-section-footer">
        <button
          type="button"
          disabled={busy === 'draft-settings'}
          onClick={() => void onRun('draft-settings', saveDraftSettings)}
        >
          Save draft settings
        </button>
      </div>
    </AdminSection>
  )
}

function AdminSection({
  id,
  title,
  actions,
  children,
  defaultOpen = true,
}: {
  id?: string
  title: string
  actions?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section id={id} className={`admin-section${open ? '' : ' is-collapsed'}`}>
      <div className="admin-section-header">
        <button
          type="button"
          className="collapse-toggle"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="collapse-caret" aria-hidden="true" />
        </button>
        <h2>{title}</h2>
        {actions ? <div className="admin-section-actions">{actions}</div> : null}
      </div>
      {open ? <div className="admin-section-body">{children}</div> : null}
    </section>
  )
}

function TeamEditor({
  event,
  busy,
  onRun,
  onEvent,
  locked,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
  locked?: boolean
}) {
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamDraft>>(() =>
    createTeamDrafts(event.teams),
  )
  const changedTeams = getChangedTeamDrafts(event.teams, teamDrafts)

  useEffect(() => {
    setTeamDrafts(createTeamDrafts(event.teams))
  }, [event.teams])

  function updateTeamDraft(teamId: string, patch: Partial<TeamDraft>) {
    setTeamDrafts((current) => {
      const team = event.teams.find((candidate) => candidate.id === teamId)
      const draft = current[teamId] ?? {
        name: team?.teamName ?? '',
        captainDiscordId: team?.captainDiscordId ?? '',
        score: team?.score.toString() ?? '0',
      }
      return {
        ...current,
        [teamId]: { ...draft, ...patch },
      }
    })
  }

  async function saveTeams() {
    let result: unknown = { ok: true, message: 'No team changes to save.', event }

    for (const { team, draft } of changedTeams) {
      result = await postAdminJson('/api/admin/team/update', {
        eventId: event.id,
        teamId: team.id,
        name: draft.name,
        captainDiscordId: draft.captainDiscordId,
        score: Number(draft.score),
      })
      if (isEventResult(result)) onEvent(result.event)
    }

    if (isEventResult(result)) {
      return {
        ...result,
        message: `${changedTeams.length} team${changedTeams.length === 1 ? '' : 's'} saved.`,
      }
    }

    return result
  }

  return (
    <AdminSection
      id="admin-teams"
      title="Captains and team setup"
      actions={
        <button
          type="button"
          disabled={busy === 'teams' || locked}
          onClick={() =>
            void onRun('teams', async () => {
              const result = await postAdminJson('/api/admin/teams/ensure', { eventId: event.id })
              if (isEventResult(result) && result.event) onEvent(result.event)
              return result
            })
          }
        >
          {event.teams.length ? 'Ensure teams' : 'Create teams'}
        </button>
      }
    >

      {locked ? <p>The draft is locked because the first round has started.</p> : null}

      {event.teams.length ? (
        <div className="team-admin-grid">
          {event.teams.map((team) => (
            <TeamForm
              key={team.id}
              team={team}
              players={event.players}
              draft={teamDrafts[team.id]}
              disabled={Boolean(busy) || Boolean(locked)}
              onDraft={(patch) => updateTeamDraft(team.id, patch)}
            />
          ))}
        </div>
      ) : (
        <p>Create teams, then assign teams and names here.</p>
      )}
      <div className="admin-section-footer">
        <button
          type="button"
          disabled={busy === 'team-settings' || Boolean(locked) || !changedTeams.length}
          onClick={() => void onRun('team-settings', saveTeams)}
        >
          Save teams
        </button>
      </div>
    </AdminSection>
  )
}

interface TeamDraft {
  name: string
  captainDiscordId: string
  score: string
}

function createTeamDrafts(teams: Team[]): Record<string, TeamDraft> {
  return Object.fromEntries(
    teams.map((team) => [
      team.id,
      {
        name: team.teamName,
        captainDiscordId: team.captainDiscordId,
        score: team.score.toString(),
      },
    ]),
  )
}

function getChangedTeamDrafts(teams: Team[], drafts: Record<string, TeamDraft>) {
  return teams.flatMap((team) => {
    const draft = drafts[team.id]
    if (!draft) return []
    const changed =
      draft.name !== team.teamName ||
      draft.captainDiscordId !== team.captainDiscordId ||
      Number(draft.score) !== team.score

    return changed ? [{ team, draft }] : []
  })
}

function EventJaegerAssignments({
  event,
  busy,
  onRun,
  refreshKey,
  onWarningCount,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  refreshKey: number
  onWarningCount?: (count: number) => void
}) {
  const [assignments, setAssignments] = useState<EventPlayerCharacterAssignment[]>([])
  const [selectedDiscordId, setSelectedDiscordId] = useState('')
  const [accountPrefix, setAccountPrefix] = useState('')
  const [loaded, setLoaded] = useState(false)
  const ready = useClientReady()
  const unresolvedAssignmentCount = countUnresolvedEventJaegerAssignments(event, assignments)

  useEffect(() => {
    if (loaded) onWarningCount?.(unresolvedAssignmentCount)
  }, [loaded, onWarningCount, unresolvedAssignmentCount])

  useEffect(() => {
    let active = true
    setLoaded(false)
    onWarningCount?.(0)
    fetch(`/api/admin/player-characters?eventId=${encodeURIComponent(event.id)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load event Jaeger assignments.')
        return response.json() as Promise<{ assignments: EventPlayerCharacterAssignment[] }>
      })
      .then((payload) => {
        if (!active) return
        setAssignments(payload.assignments)
        setSelectedDiscordId((current) => current || payload.assignments[0]?.discordId || '')
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })

    return () => {
      active = false
    }
  }, [event.id, onWarningCount, refreshKey])

  useEffect(() => {
    if (selectedDiscordId && assignments.some((assignment) => assignment.discordId === selectedDiscordId)) return
    setSelectedDiscordId(assignments[0]?.discordId ?? '')
  }, [assignments, selectedDiscordId])

  async function assignCharacter() {
    const result = await postAdminJson('/api/admin/player-characters', {
      eventId: event.id,
      discordId: selectedDiscordId,
      accountPrefix,
    }) as { assignments?: EventPlayerCharacterAssignment[] }
    if (result.assignments) {
      setAssignments(result.assignments)
      setSelectedDiscordId(result.assignments[0]?.discordId ?? '')
    }
    setAccountPrefix('')
    return result
  }

  async function copyCsv() {
    const response = await fetch(eventJaegerCsvUrl(event.id))
    if (!response.ok) throw new Error(await response.text())
    await navigator.clipboard.writeText(await response.text())
    return { ok: true, message: 'Character CSV copied to clipboard.' }
  }

  return (
    <AdminSection
      id="admin-jaeger"
      title="Event Jaeger assignments"
      actions={
        <>
          <button
            type="button"
            className="secondary"
            disabled={
              busy === 'event-jaeger-copy' ||
              !ready ||
              typeof navigator === 'undefined' ||
              !navigator.clipboard
            }
            onClick={() => void onRun('event-jaeger-copy', copyCsv)}
          >
            Copy CSV
          </button>
          {event.teams.length ? (
            event.teams.map((team) => (
              <a
                key={team.id}
                className="button-link secondary"
                href={eventJaegerCsvUrl(event.id, team.id)}
                download
              >
                {team.teamName} CSV
              </a>
            ))
          ) : (
            <a className="button-link secondary" href={eventJaegerCsvUrl(event.id)} download>
              Export CSV
            </a>
          )}
          <button
            type="button"
            disabled={busy === 'event-jaeger' || !selectedDiscordId || !accountPrefix.trim()}
            onClick={() => void onRun('event-jaeger', assignCharacter)}
          >
            Resolve and assign all
          </button>
        </>
      }
    >
      <div className="rating-adjustment-grid">
        <label>
          Player
          <select
            value={selectedDiscordId}
            disabled={!assignments.length}
            onChange={(event) => setSelectedDiscordId(event.currentTarget.value)}
          >
            {assignments.length ? (
              assignments.map((assignment) => (
                <option key={assignment.discordId} value={assignment.discordId}>
                  {assignment.groupTag ? `[${assignment.groupTag}] ${assignment.playerName}` : assignment.playerName}
                </option>
              ))
            ) : (
              <option value="">{loaded ? 'No players need assignments' : 'Loading players'}</option>
            )}
          </select>
        </label>
        <label>
          Character
          <input
            value={accountPrefix}
            disabled={!assignments.length}
            placeholder="TAGxCHARACTER"
            onChange={(event) => setAccountPrefix(event.currentTarget.value)}
          />
        </label>
      </div>
    </AdminSection>
  )
}

function eventJaegerCsvUrl(eventId: string, teamId?: string) {
  const params = new URLSearchParams({ eventId, format: 'csv' })
  if (teamId) params.set('teamId', teamId)
  return `/api/admin/player-characters?${params.toString()}`
}

function countUnresolvedEventJaegerAssignments(
  event: HammaEvent,
  assignments: EventPlayerCharacterAssignment[],
) {
  const requiredFactions = event.availableFactions.length ? event.availableFactions : (['TR', 'VS', 'NC'] as Faction[])

  return assignments.filter((assignment) => {
    const assignedFactions = new Set(assignment.assignments.map((character) => character.faction))
    return requiredFactions.some((faction) => !assignedFactions.has(faction))
  }).length
}

function PlayerRenameManager({
  busy,
  onRun,
  refreshKey,
}: {
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  refreshKey: number
}) {
  const [players, setPlayers] = useState<RegisteredParticipant[]>([])
  const [discordId, setDiscordId] = useState('')
  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState(false)
  const ready = useClientReady()

  useEffect(() => {
    if (!ready) return
    let active = true
    fetch('/api/admin/players')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load players.')
        return response.json() as Promise<{ players: RegisteredParticipant[] }>
      })
      .then((payload) => {
        if (!active) return
        setPlayers(payload.players)
        setDiscordId((current) =>
          current && payload.players.some((player) => player.discordId === current) ? current : '',
        )
        setName((current) => {
          const selectedPlayer = payload.players.find((player) => player.discordId === discordId)
          return selectedPlayer ? current || selectedPlayer.name : ''
        })
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })

    return () => {
      active = false
    }
  }, [ready, refreshKey])

  function choosePlayer(nextDiscordId: string) {
    setDiscordId(nextDiscordId)
    setName(players.find((player) => player.discordId === nextDiscordId)?.name ?? '')
  }

  async function renamePlayer() {
    const result = await postAdminJson('/api/admin/players', {
      discordId,
      name,
    }) as { players?: RegisteredParticipant[] }
    if (result.players) {
      setPlayers(result.players)
      setDiscordId('')
      setName('')
    }
    return result
  }

  return (
    <AdminSection
      id="admin-player-names"
      title="Player names"
      actions={
        <button
          type="button"
          disabled={!ready || busy === 'player-rename' || !discordId || !name.trim()}
          onClick={() => void onRun('player-rename', renamePlayer)}
        >
          Rename player
        </button>
      }
    >
      {!ready ? <div className="empty-inline">Loading players.</div> : null}
      <div className="rating-adjustment-grid">
        <label>
          Player
          <select
            value={discordId}
            disabled={!ready || !players.length}
            onChange={(event) => choosePlayer(event.currentTarget.value)}
          >
            {players.length ? (
              <>
                <option value="">Choose player</option>
                {players.map((player) => (
                  <option key={player.discordId} value={player.discordId}>
                    {player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name}
                  </option>
                ))}
              </>
            ) : (
              <option value="">{loaded ? 'No known players' : 'Loading players'}</option>
            )}
          </select>
        </label>
        <label>
          Display name
          <input value={name} disabled={!ready || !players.length} onChange={(event) => setName(event.currentTarget.value)} />
        </label>
      </div>
    </AdminSection>
  )
}

function PlayerJaegerManager({
  busy,
  onRun,
  refreshKey,
}: {
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  refreshKey: number
}) {
  const [players, setPlayers] = useState<AdminPlayerCharacterConfig[]>([])
  const [discordId, setDiscordId] = useState('')
  const [names, setNames] = useState<Record<Faction, string>>({ TR: '', VS: '', NC: '' })
  const [accountQuery, setAccountQuery] = useState('')
  const [accountSuggestions, setAccountSuggestions] = useState<HonuPsbAccountSuggestion[]>([])
  const [accountSearchFocused, setAccountSearchFocused] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const ready = useClientReady()

  useEffect(() => {
    if (!ready) return
    let active = true
    fetch('/api/admin/player-jaeger')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load player Jaeger characters.')
        return response.json() as Promise<{ players: AdminPlayerCharacterConfig[] }>
      })
      .then((payload) => {
        if (!active) return
        setPlayers(payload.players)
        setDiscordId((current) =>
          current && payload.players.some((player) => player.discordId === current) ? current : '',
        )
        setNames((current) => {
          const selectedPlayer = payload.players.find((player) => player.discordId === discordId)
          return selectedPlayer ? namesFromPlayer(selectedPlayer) : current
        })
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })

    return () => {
      active = false
    }
  }, [ready, refreshKey])

  useEffect(() => {
    if (!ready) return
    const query = accountQuery.trim()
    if (query.length < 2) {
      setAccountSuggestions([])
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      void fetch(`/api/admin/player-jaeger?accountSearch=${encodeURIComponent(query)}`)
        .then((response) => {
          if (!response.ok) throw new Error('Unable to search Honu accounts.')
          return response.json() as Promise<{
            accounts: HonuPsbAccountSuggestion[]
            updatedAt?: string
          }>
        })
        .then((payload) => {
          if (!active) return
          setAccountSuggestions(payload.accounts)
        })
        .catch(() => {
          if (active) setAccountSuggestions([])
        })
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [ready, accountQuery])

  function choosePlayer(nextDiscordId: string) {
    setDiscordId(nextDiscordId)
    setNames(namesFromPlayer(players.find((player) => player.discordId === nextDiscordId)))
  }

  function updateFaction(faction: Faction, value: string) {
    setNames((current) => ({ ...current, [faction]: value }))
  }

  function chooseHonuAccount(account: HonuPsbAccountSuggestion) {
    setAccountQuery(account.label)
    setAccountSearchFocused(false)
    setNames((current) => ({
      TR: account.characters.find((character) => character.faction === 'TR')?.characterName ?? current.TR,
      VS: account.characters.find((character) => character.faction === 'VS')?.characterName ?? current.VS,
      NC: account.characters.find((character) => character.faction === 'NC')?.characterName ?? current.NC,
    }))
  }

  async function saveCharacters() {
    const result = await postAdminJson('/api/admin/player-jaeger', {
      discordId,
      TR: names.TR,
      VS: names.VS,
      NC: names.NC,
    }) as { players?: AdminPlayerCharacterConfig[] }
    if (result.players) {
      setPlayers(result.players)
      setDiscordId('')
      setNames(namesFromPlayer())
    }
    return result
  }

  const selectedPlayer = players.find((player) => player.discordId === discordId)
  const selectedPlayerHasResolvedCharacters = Boolean(selectedPlayer?.characters.length)
  const showAccountSuggestions = accountSearchFocused && accountQuery.trim().length >= 2

  return (
    <AdminSection id="admin-jaeger-chars" title="Player Jaeger characters">
      {!ready ? <div className="empty-inline">Loading players.</div> : null}
      <div className="rating-adjustment-grid">
        <label>
          Player
          <select
            value={discordId}
            disabled={!ready || !players.length}
            onChange={(event) => choosePlayer(event.currentTarget.value)}
          >
            {players.length ? (
              <>
                <option value="">Choose player</option>
                {players.map((player) => (
                  <option key={player.discordId} value={player.discordId}>
                    {player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name}
                  </option>
                ))}
              </>
            ) : (
              <option value="">{loaded ? 'No known players' : 'Loading players'}</option>
            )}
          </select>
        </label>
        {(['TR', 'VS', 'NC'] as Faction[]).map((faction) => (
          <label key={faction}>
            {faction} character
            <input
              value={names[faction]}
              disabled={!ready || !players.length}
              onChange={(event) => updateFaction(faction, event.currentTarget.value)}
            />
          </label>
        ))}
        <div
          className="psb-account-combobox"
          onFocus={() => setAccountSearchFocused(true)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget
            if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
            setAccountSearchFocused(false)
          }}
        >
          <span>PSB Named Account</span>
          <input
            value={accountQuery}
            disabled={!ready}
            placeholder="Search tag, player, or character"
            onChange={(event) => setAccountQuery(event.currentTarget.value)}
          />
          {showAccountSuggestions ? (
            <div className="psb-account-results" role="listbox">
              {accountSuggestions.length ? accountSuggestions.map((account) => (
                <button
                  key={account.accountId}
                  type="button"
                  role="option"
                  onClick={() => chooseHonuAccount(account)}
                >
                  <strong>{account.label}</strong>
                  <span>{account.playerName}</span>
                </button>
              )) : (
                <div className="psb-account-empty">No matches</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <div className="resolved-list admin-assignment-list">
        {selectedPlayer && (selectedPlayer.noPersonalJaegerAccount || selectedPlayerHasResolvedCharacters) ? (
          <span>
            <strong>
              <PlayerName
                name={selectedPlayer.name}
                groupTag={selectedPlayer.groupTag}
                groupTagColor={selectedPlayer.groupTagColor}
              />
            </strong>
            {selectedPlayer.noPersonalJaegerAccount
              ? 'Currently marked as needing event-assigned Jaeger characters'
              : 'Uses configured Jaeger characters'}
          </span>
        ) : null}
        {selectedPlayer?.characters.map((character) => (
          <span key={character.faction}>
            <strong>{character.faction}</strong>
            {character.characterName} #{character.characterId}
          </span>
        ))}
      </div>
      <div className="admin-section-footer">
        <button
          type="button"
          disabled={!ready || busy === 'player-jaeger' || !discordId || !names.TR.trim() || !names.VS.trim() || !names.NC.trim()}
          onClick={() => void onRun('player-jaeger', saveCharacters)}
        >
          Resolve and save
        </button>
      </div>
    </AdminSection>
  )
}

function namesFromPlayer(player?: AdminPlayerCharacterConfig): Record<Faction, string> {
  return {
    TR: player?.characters.find((character) => character.faction === 'TR')?.characterName ?? '',
    VS: player?.characters.find((character) => character.faction === 'VS')?.characterName ?? '',
    NC: player?.characters.find((character) => character.faction === 'NC')?.characterName ?? '',
  }
}

function BadgeManager({
  busy,
  onRun,
  refreshKey,
}: {
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  refreshKey: number
}) {
  const [data, setData] = useState<AdminBadgeManagerData>({
    badges: [],
    players: [],
    assignments: [],
  })
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#e4b45e')
  const [badgeDrafts, setBadgeDrafts] = useState<Record<string, {
    name: string
    description: string
    color: string
  }>>({})
  const ready = useClientReady()

  useEffect(() => {
    if (!ready) return
    let active = true
    fetch('/api/admin/badges')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load badges.')
        return response.json() as Promise<AdminBadgeManagerData>
      })
      .then((payload) => {
        if (!active) return
        setData(payload)
        setBadgeDrafts(createBadgeDrafts(payload))
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })

    return () => {
      active = false
    }
  }, [ready, refreshKey])

  async function createBadge() {
    const result = await postAdminJson('/api/admin/badges', {
      action: 'create',
      name,
      description,
      color,
    }) as AdminBadgeManagerData & { message?: string }
    setData(result)
    setBadgeDrafts(createBadgeDrafts(result))
    setName('')
    setDescription('')
    setColor('#e4b45e')
    return result
  }

  async function deleteBadge(targetBadgeId: string) {
    const result = await postAdminJson('/api/admin/badges', {
      action: 'delete',
      badgeId: targetBadgeId,
    }) as AdminBadgeManagerData & { message?: string }
    setData(result)
    setBadgeDrafts(createBadgeDrafts(result))
    return result
  }

  const systemBadges = data.badges.filter((badge) => badge.source === 'system')
  const customBadges = data.badges.filter((badge) => badge.source === 'manual')
  const changedBadges = data.badges.filter((badge) => {
    const draft = badgeDrafts[badge.id]
    return (
      draft &&
      (draft.name !== badge.name ||
        draft.description !== badge.description ||
        draft.color !== badge.color)
    )
  })
  const canSaveBadgeChanges = changedBadges.every((badge) => {
    const draft = badgeDrafts[badge.id]
    return draft?.name.trim() && draft.description.trim()
  })

  async function saveBadgeChanges() {
    let result: AdminBadgeManagerData & { message?: string } = {
      ...data,
      message: 'No badge changes to save.',
    }

    for (const badge of changedBadges) {
      const draft = badgeDrafts[badge.id]
      result = await postAdminJson('/api/admin/badges', {
        action: 'update',
        badgeId: badge.id,
        name: draft?.name,
        description: draft?.description,
        color: draft?.color,
      }) as AdminBadgeManagerData & { message?: string }
    }

    setData(result)
    setBadgeDrafts(createBadgeDrafts(result))
    return {
      ...result,
      message: `${changedBadges.length} badge${changedBadges.length === 1 ? '' : 's'} saved.`,
    }
  }

  function renderBadgeEditor(badge: AdminBadgeManagerData['badges'][number]) {
    const draft = badgeDrafts[badge.id] ?? {
      name: badge.name,
      description: badge.description,
      color: badge.color,
    }

    return (
      <article className="badge-definition-card" key={`badge-${badge.id}`}>
        <strong style={{ '--badge-color': draft.color } as CSSProperties}>{badge.name}</strong>
        <div className="badge-definition-fields">
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => {
                const nextName = event.currentTarget.value
                setBadgeDrafts((current) => ({
                  ...current,
                  [badge.id]: { ...draft, name: nextName },
                }))
              }}
            />
          </label>
          <label>
            Description
            <input
              value={draft.description}
              onChange={(event) => {
                const nextDescription = event.currentTarget.value
                setBadgeDrafts((current) => ({
                  ...current,
                  [badge.id]: { ...draft, description: nextDescription },
                }))
              }}
            />
          </label>
          <label className="inline-color-field">
            Color
            <input
              type="color"
              value={draft.color}
              onChange={(event) => {
                const nextColor = event.currentTarget.value
                setBadgeDrafts((current) => ({
                  ...current,
                  [badge.id]: { ...draft, color: nextColor },
                }))
              }}
            />
          </label>
        </div>
        {badge.source === 'manual' ? (
          <div className="badge-definition-actions">
            <button
              type="button"
              className="text-button danger"
              disabled={busy === `badge-delete-${badge.id}`}
              onClick={() => void onRun(`badge-delete-${badge.id}`, () => deleteBadge(badge.id))}
            >
              Delete
            </button>
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <AdminSection id="admin-badges" title="Badges">
      <div className="badge-admin-grid">
        <div className="team-admin-card">
          <label>
            Badge name
            <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </label>
          <label>
            Description
            <input value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
          </label>
          <label>
            Color
            <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)} />
          </label>
          <button
            type="button"
            disabled={!ready || busy === 'badge-create' || !name.trim() || !description.trim()}
            onClick={() => void onRun('badge-create', createBadge)}
          >
            Create badge
          </button>
        </div>
      </div>

      <div className="badge-definition-list">
        {data.badges.length ? (
          <>
            <section className="badge-definition-group">
              <h3>System Badges</h3>
              <div className="badge-definition-cards">
                {systemBadges.length ? systemBadges.map(renderBadgeEditor) : (
                  <div className="empty-inline">No system badges created yet.</div>
                )}
              </div>
            </section>
            <section className="badge-definition-group">
              <h3>Custom Badges</h3>
              <div className="badge-definition-cards">
                {customBadges.length ? customBadges.map(renderBadgeEditor) : (
                  <div className="empty-inline">No custom badges created yet.</div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="empty-inline">{loaded ? 'No badges created yet.' : 'Loading badges.'}</div>
        )}
      </div>
      <div className="admin-section-footer">
        <button
          type="button"
          disabled={
            !ready ||
            busy === 'badge-definitions' ||
            !changedBadges.length ||
            !canSaveBadgeChanges
          }
          onClick={() => void onRun('badge-definitions', saveBadgeChanges)}
        >
          Save badge changes
        </button>
      </div>
    </AdminSection>
  )
}

function createBadgeDrafts(data: AdminBadgeManagerData) {
  return Object.fromEntries(
    data.badges.map((badge) => [
      badge.id,
      {
        name: badge.name,
        description: badge.description,
        color: badge.color,
      },
    ]),
  )
}

function CoinflipControls({
  event,
  busy,
  onRun,
  onEvent,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
}) {
  const factions: Faction[] = ['VS', 'NC', 'TR']
  const coinflip = event.coinflip
  const caller = event.teams.find((team) => team.id === coinflip?.callingTeamId)
  const winner = event.teams.find((team) => team.id === coinflip?.winningTeamId)
  const [availableFactions, setAvailableFactions] = useState<Faction[]>(
    event.availableFactions.length ? event.availableFactions : factions,
  )
  const [availableSides, setAvailableSides] = useState<StartingSide[]>(
    event.availableSides.length ? event.availableSides : ['north', 'south'],
  )
  const [sideInput, setSideInput] = useState('')
  const [call, setCall] = useState<'heads' | 'tails'>(coinflip?.call ?? 'heads')
  const [choiceType, setChoiceType] = useState<'faction' | 'side'>(
    coinflip?.choiceType ?? 'faction',
  )
  const [chosenFaction, setChosenFaction] = useState<Faction>(
    coinflip?.chosenFaction ?? event.availableFactions[0] ?? 'VS',
  )
  const [startingSide, setStartingSide] = useState<StartingSide>(
    coinflip?.chosenStartingSide ?? event.availableSides[0] ?? 'north',
  )
  const [assignments, setAssignments] = useState<Record<string, { faction: string; startingSide: string }>>(
    () => buildAssignmentState(event),
  )
  const completed = Boolean(coinflip?.result)
  const pending = Boolean(coinflip && !coinflip.result)
  const savedAvailableFactions = event.availableFactions.length ? event.availableFactions : factions
  const savedAvailableSides = event.availableSides.length ? event.availableSides : ['north', 'south']
  const optionsChanged =
    !completed &&
    (!sameStringList(availableFactions, savedAvailableFactions) ||
      !sameStringList(availableSides, savedAvailableSides))
  const choiceChanged =
    completed &&
    (choiceType !== (coinflip?.choiceType ?? 'faction') ||
      (choiceType === 'faction' &&
        chosenFaction !== (coinflip?.chosenFaction ?? savedAvailableFactions[0] ?? 'VS')) ||
      (choiceType === 'side' &&
        startingSide !== (coinflip?.chosenStartingSide ?? savedAvailableSides[0] ?? 'north')))
  const changedAssignments = completed ? getChangedCoinflipAssignments(event, assignments) : []
  const hasCoinflipSettingChanges =
    optionsChanged || choiceChanged || changedAssignments.length > 0

  useEffect(() => {
    const nextSides = event.availableSides.length ? event.availableSides : ['north', 'south']
    setAvailableFactions(event.availableFactions.length ? event.availableFactions : factions)
    setAvailableSides(nextSides)
    setSideInput('')
    setCall(coinflip?.call ?? 'heads')
    setChoiceType(coinflip?.choiceType ?? 'faction')
    setChosenFaction(coinflip?.chosenFaction ?? event.availableFactions[0] ?? 'VS')
    setStartingSide(coinflip?.chosenStartingSide ?? nextSides[0] ?? 'north')
    setAssignments(buildAssignmentState(event))
  }, [event, coinflip?.call, coinflip?.choiceType, coinflip?.chosenFaction, coinflip?.chosenStartingSide])

  function updateAvailableFaction(faction: Faction, checked: boolean) {
    setAvailableFactions((current) => {
      const next = checked
        ? [...current, faction]
        : current.filter((available) => available !== faction)
      return factions.filter((candidate) => next.includes(candidate))
    })
  }

  function addAvailableSide() {
    const nextSide = sideInput.trim()
    if (!nextSide) return

    setAvailableSides((current) => {
      if (current.some((side) => side.toLowerCase() === nextSide.toLowerCase())) return current
      return [...current, nextSide]
    })
    setStartingSide((current) => current || nextSide)
    setSideInput('')
  }

  function removeAvailableSide(side: StartingSide) {
    setAvailableSides((current) => {
      const next = current.filter((item) => item !== side)
      if (startingSide === side) setStartingSide(next[0] ?? '')
      return next
    })
  }

  async function runCoinflipAction(body: Record<string, unknown>) {
    const result = await postAdminJson('/api/admin/coinflip', { eventId: event.id, ...body })
    if (isEventResult(result)) onEvent(result.event)
    return result
  }

  function updateAssignment(teamId: string, key: 'faction' | 'startingSide', value: string) {
    setAssignments((current) => ({
      ...current,
      [teamId]: {
        faction: current[teamId]?.faction ?? '',
        startingSide: current[teamId]?.startingSide ?? '',
        [key]: value,
      },
    }))
  }

  async function saveCoinflipSettings() {
    let result: unknown = { ok: true, message: 'No coinflip settings to save.', event }

    if (optionsChanged) {
      result = await runCoinflipAction({ action: 'options', availableFactions, availableSides })
    }

    if (choiceChanged) {
      result = await runCoinflipAction({
        action: 'choice',
        choiceType,
        faction: chosenFaction,
        startingSide,
      })
    }

    if (changedAssignments.length) {
      result = await runCoinflipAction({
        action: 'assignments',
        assignments: event.teams.map((team) => ({
          teamId: team.id,
          faction: assignments[team.id]?.faction ?? '',
          startingSide: assignments[team.id]?.startingSide ?? '',
        })),
      })
    }

    if (isEventResult(result)) {
      return { ...result, message: 'Coinflip settings saved.' }
    }

    return result
  }

  return (
    <AdminSection id="admin-coinflip" title="Coinflip">
      <div className="coinflip-flow-panel">
        <div>
          <strong>
            {completed ? 'Coinflip complete' : pending ? 'Coinflip ready' : 'No caller selected'}
          </strong>
          <p>
            {completed && coinflip?.result
              ? `${coinflip.result.toUpperCase()} won. ${winner?.teamName ?? 'Winning team'} chooses.`
              : caller
                ? `${caller.teamName} calls the coin.`
                : 'Select a caller before flipping.'}
          </p>
        </div>
        <div className="coinflip-flow-actions">
          {!coinflip ? (
            <button
              type="button"
              disabled={busy === 'coinflip-caller'}
              onClick={() =>
                void onRun('coinflip-caller', () =>
                  runCoinflipAction({ action: 'select-caller' }),
                )
              }
            >
              Select caller
            </button>
          ) : null}
          {pending ? (
            <>
              <div className="segmented-control coinflip-call-control" aria-label="Coin call">
                <button
                  type="button"
                  className={call === 'heads' ? 'active' : ''}
                  onClick={() => setCall('heads')}
                >
                  Heads
                </button>
                <button
                  type="button"
                  className={call === 'tails' ? 'active' : ''}
                  onClick={() => setCall('tails')}
                >
                  Tails
                </button>
              </div>
              <button
                type="button"
                disabled={busy === 'coinflip'}
                onClick={() =>
                  void onRun('coinflip', () => runCoinflipAction({ action: 'flip', call }))
                }
              >
                Flip coin
              </button>
            </>
          ) : null}
          {coinflip ? (
            <button
              type="button"
              className="danger-button"
              disabled={busy === 'coinflip-reset'}
              onClick={() =>
                void onRun('coinflip-reset', () => runCoinflipAction({ action: 'reset' }))
              }
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="coinflip-settings-heading">
        <strong>Settings</strong>
      </div>
      <div className="coinflip-grid">
        <div className="coinflip-card">
          <strong>Available options</strong>
          <div className="check-row">
            {factions.map((faction) => (
              <label key={faction}>
                <input
                  type="checkbox"
                  checked={availableFactions.includes(faction)}
                  onChange={(event) => updateAvailableFaction(faction, event.currentTarget.checked)}
                />
                {faction}
              </label>
            ))}
          </div>
          <div className="coinflip-field">
            <span className="field-label">Sides</span>
            <div className="chip-input" aria-disabled={completed}>
              {availableSides.map((side) => (
                <span className="side-chip" key={side}>
                  {side}
                  <button
                    type="button"
                    aria-label={`Remove ${side}`}
                    disabled={completed}
                    onClick={() => removeAvailableSide(side)}
                  >
                    x
                  </button>
                </span>
              ))}
              <input
                value={sideInput}
                disabled={completed}
                onChange={(event) => setSideInput(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addAvailableSide()
                  }
                }}
                placeholder={availableSides.length ? 'Add side' : 'north, south, hill'}
              />
            </div>
          </div>
        </div>

        <div className="coinflip-card">
          <strong>Winner choice</strong>
          <div className="segmented-control">
            <button
              type="button"
              className={choiceType === 'faction' ? 'active' : ''}
              disabled={!completed}
              onClick={() => setChoiceType('faction')}
            >
              Faction
            </button>
            <button
              type="button"
              className={choiceType === 'side' ? 'active' : ''}
              disabled={!completed}
              onClick={() => setChoiceType('side')}
            >
              Side + pick
            </button>
          </div>
          {choiceType === 'faction' ? (
            <label>
              Faction
              <select
                value={chosenFaction}
                disabled={!completed}
                onChange={(event) => setChosenFaction(event.currentTarget.value as Faction)}
              >
                {availableFactions.map((faction) => (
                  <option key={faction} value={faction}>
                    {faction}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Starting side
              <select
                value={startingSide}
                disabled={!completed}
                onChange={(event) => setStartingSide(event.currentTarget.value as StartingSide)}
              >
                {availableSides.map((side) => (
                  <option key={side} value={side}>
                    {side}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {completed ? (
        <div className="assignment-panel">
          <div className="assignment-heading">
            <strong>Team assignments</strong>
          </div>
          <div className="assignment-grid">
            {event.teams.map((team) => {
              const currentFaction = assignments[team.id]?.faction ?? ''
              const currentSide = assignments[team.id]?.startingSide ?? ''
              const factionOptions = unclaimedAssignmentOptions(
                mergeOptions(availableFactions, team.faction),
                assignments,
                team.id,
                'faction',
              )
              const sideOptions = unclaimedAssignmentOptions(
                mergeOptions(availableSides, team.startingSide),
                assignments,
                team.id,
                'startingSide',
              )

              return (
                <article className="assignment-card" key={team.id}>
                  <strong>{team.teamName}</strong>
                  <label>
                    Faction
                    <select
                      value={currentFaction}
                      onChange={(event) => updateAssignment(team.id, 'faction', event.currentTarget.value)}
                    >
                      <option value="">TBD</option>
                      {factionOptions.map((faction) => (
                        <option value={faction} key={faction}>
                          {faction}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Side
                    <select
                      value={currentSide}
                      onChange={(event) => updateAssignment(team.id, 'startingSide', event.currentTarget.value)}
                    >
                      <option value="">TBD</option>
                      {sideOptions.map((side) => (
                        <option value={side} key={side}>
                          {side}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="admin-section-footer">
        <button
          type="button"
          disabled={
            busy === 'coinflip-settings' ||
            !hasCoinflipSettingChanges ||
            (optionsChanged && (!availableFactions.length || !availableSides.length))
          }
          onClick={() => void onRun('coinflip-settings', saveCoinflipSettings)}
        >
          Save coinflip settings
        </button>
      </div>
    </AdminSection>
  )
}

function RoundControls({
  event,
  busy,
  onRun,
  onEvent,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
}) {
  const [roundCount, setRoundCount] = useState(event.roundCount.toString())
  const [roundDurationMinutes, setRoundDurationMinutes] = useState(
    Math.max(1, Math.round(event.roundDurationSeconds / 60)).toString(),
  )
  const [roundResults, setRoundResults] = useState(() => buildRoundResultState(event))
  const [scoreTeamId, setScoreTeamId] = useState(event.teams[0]?.id ?? '')
  const [scoreDelta, setScoreDelta] = useState('1')
  const [winningTeamId, setWinningTeamId] = useState(getDefaultEventWinnerId(event))
  const draftLocked = event.rounds.length > 0
  const nextRoundNumber = event.rounds.length + 1
  const canStartRound = nextRoundNumber <= event.roundCount
  const changedRoundResults = getChangedRoundResults(event, roundResults)

  useEffect(() => {
    setRoundCount(event.roundCount.toString())
    setRoundDurationMinutes(Math.max(1, Math.round(event.roundDurationSeconds / 60)).toString())
    setRoundResults(buildRoundResultState(event))
    setScoreTeamId((current) =>
      event.teams.some((team) => team.id === current) ? current : event.teams[0]?.id ?? '',
    )
    setWinningTeamId((current) => {
      if (event.winningTeamId) return event.winningTeamId

      const suggestedWinnerId = getSuggestedEventWinnerId(event)
      if (suggestedWinnerId) return suggestedWinnerId

      return event.teams.some((team) => team.id === current) ? current : event.teams[0]?.id ?? ''
    })
  }, [event])

  async function postResult(body: Record<string, unknown>) {
    const result = await postAdminJson('/api/admin/result', { eventId: event.id, ...body })
    if (isEventResult(result) && result.event) onEvent(result.event)
    return result
  }

  async function saveRoundSettings() {
    return postResult({ roundCount, roundDurationMinutes })
  }

  async function startRound() {
    return postResult({ startRound: true })
  }

  async function adjustScore() {
    const result = await postResult({ teamId: scoreTeamId, delta: Number(scoreDelta) })
    setScoreTeamId(event.teams[0]?.id ?? '')
    setScoreDelta('1')
    return result
  }

  async function saveRoundResults() {
    let result: unknown = { ok: true, message: 'No round results to save.', event }

    for (const round of changedRoundResults) {
      result = await postResult({
        roundNumber: round.roundNumber,
        roundTeamScores: round.teamScores,
        roundResultNote: round.resultNote,
      })
    }

    if (isEventResult(result)) {
      return {
        ...result,
        message: `${changedRoundResults.length} round result${
          changedRoundResults.length === 1 ? '' : 's'
        } saved.`,
      }
    }

    return result
  }

  return (
    <AdminSection id="admin-rounds" title="Rounds">
      <div className="round-flow-panel">
        <div>
          <strong>
            {canStartRound ? `Round ${nextRoundNumber} ready` : 'All rounds started'}
          </strong>
          <p>
            {event.rounds.length
              ? `${event.rounds.length} of ${event.roundCount} rounds started.`
              : 'Starting round 1 locks the draft for captains and admins.'}
          </p>
        </div>
        <div className="round-flow-actions">
          <button
            type="button"
            disabled={busy === 'round-start' || !canStartRound}
            onClick={() => void onRun('round-start', startRound)}
          >
            {canStartRound ? `Start round ${nextRoundNumber}` : 'All rounds started'}
          </button>
        </div>
      </div>
      <div className="event-result-grid round-admin-grid">
        <div className="event-result-card">
          <strong>Round setup</strong>
          <label>
            Rounds
            <input
              type="number"
              min="1"
              max="20"
              step="1"
              value={roundCount}
              disabled={draftLocked}
              onChange={(event) => setRoundCount(event.currentTarget.value)}
            />
          </label>
          <label>
            Minutes per round
            <input
              type="number"
              min="1"
              max="240"
              step="1"
              value={roundDurationMinutes}
              disabled={draftLocked}
              onChange={(event) => setRoundDurationMinutes(event.currentTarget.value)}
            />
          </label>
          {draftLocked ? <small>Round setup is locked after round 1 starts.</small> : null}
        </div>

        <div className="event-result-card round-list-card">
          <strong>Round results</strong>
          {event.rounds.length ? (
            <div className="round-result-list">
              {event.rounds.map((round) => {
                const result = roundResults[round.roundNumber] ?? {
                  teamScores: createRoundTeamScoreState(round, event.teams),
                  resultNote: '',
                }
                return (
                  <div className="round-result-row" key={round.roundNumber}>
                    <span>Round {round.roundNumber}</span>
                    <div className="round-score-inputs">
                      {event.teams.map((team) => (
                        <label key={team.id}>
                          {team.teamName}
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={result.teamScores[team.id] ?? '0'}
                            onChange={(changeEvent) => {
                              const score = changeEvent.currentTarget.value
                              setRoundResults((current) => ({
                                ...current,
                                [round.roundNumber]: {
                                  ...result,
                                  teamScores: {
                                    ...result.teamScores,
                                    [team.id]: score,
                                  },
                                },
                              }))
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <input
                      value={result.resultNote}
                      placeholder="Result note"
                      onChange={(changeEvent) => {
                        const resultNote = changeEvent.currentTarget.value
                        setRoundResults((current) => ({
                          ...current,
                          [round.roundNumber]: {
                            ...result,
                            resultNote,
                          },
                        }))
                      }}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <small>No rounds have been started.</small>
          )}
        </div>

        <div className="event-result-card">
          <strong>Score adjustments</strong>
          <label>
            Team
            <select
              value={scoreTeamId}
              disabled={!event.teams.length}
              onChange={(event) => setScoreTeamId(event.currentTarget.value)}
            >
              {event.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.teamName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Adjustment
            <input
              type="number"
              value={scoreDelta}
              onChange={(event) => setScoreDelta(event.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy === 'score-adjust' || !scoreTeamId || Number(scoreDelta) === 0}
            onClick={() => void onRun('score-adjust', adjustScore)}
          >
            Apply score
          </button>
        </div>

        <div className="event-result-card">
          <strong>Completion</strong>
          <label>
            Winning team
            <select
              value={winningTeamId}
              disabled={!event.teams.length}
              onChange={(event) => setWinningTeamId(event.currentTarget.value)}
            >
              {event.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.teamName}
                </option>
              ))}
            </select>
          </label>
          <p>
            Marking complete records the selected winner and marks that team&apos;s captain and drafted players as event winners.
          </p>
          <button
            type="button"
            disabled={busy === 'event-complete' || !winningTeamId}
            onClick={() =>
              void onRun('event-complete', () =>
                postResult({ teamId: winningTeamId, winner: true }),
              )
            }
          >
            {event.phase === 'complete' ? 'Update winner' : 'Mark complete'}
          </button>
        </div>
      </div>
      <div className="admin-section-footer">
        <button
          type="button"
          disabled={busy === 'round-settings' || draftLocked}
          onClick={() => void onRun('round-settings', saveRoundSettings)}
        >
          Save round setup
        </button>
        <button
          type="button"
          disabled={busy === 'round-results' || !changedRoundResults.length}
          onClick={() => void onRun('round-results', saveRoundResults)}
        >
          Save round results
        </button>
      </div>
    </AdminSection>
  )
}

function buildRoundResultState(event: HammaEvent) {
  return Object.fromEntries(
    event.rounds.map((round) => [
      round.roundNumber,
      {
        teamScores: createRoundTeamScoreState(round, event.teams),
        resultNote: round.resultNote ?? '',
      },
    ]),
  )
}

function getChangedRoundResults(
  event: HammaEvent,
  roundResults: Record<number, { teamScores: Record<string, string>; resultNote: string }>,
) {
  return event.rounds.flatMap((round) => {
    const result = roundResults[round.roundNumber]
    if (!result) return []

    const teamScores = Object.fromEntries(
      event.teams.map((team) => [team.id, Number(result.teamScores[team.id] ?? 0)]),
    )
    const hadScores = hasRecordedRoundScores(round, event.teams)
    const changed =
      !hadScores ||
      event.teams.some((team) => teamScores[team.id] !== (round.teamScores[team.id] ?? 0)) ||
      result.resultNote !== (round.resultNote ?? '')

    return changed
      ? [
          {
            roundNumber: round.roundNumber,
            teamScores,
            resultNote: result.resultNote,
          },
        ]
      : []
  })
}

function createRoundTeamScoreState(round: HammaEvent['rounds'][number], teams: HammaEvent['teams']) {
  return Object.fromEntries(
    teams.map((team) => [team.id, String(round.teamScores[team.id] ?? 0)]),
  )
}

function hasRecordedRoundScores(round: HammaEvent['rounds'][number], teams: HammaEvent['teams']) {
  return teams.some((team) => team.id in round.teamScores)
}

function getDefaultEventWinnerId(event: HammaEvent) {
  return event.winningTeamId ?? getSuggestedEventWinnerId(event) ?? event.teams[0]?.id ?? ''
}

function getSuggestedEventWinnerId(event: HammaEvent) {
  const roundCount = Math.max(1, event.roundCount)
  const roundsByNumber = new Map(event.rounds.map((round) => [round.roundNumber, round]))
  const hasAllRoundScores = Array.from({ length: roundCount }, (_, index) => {
    const round = roundsByNumber.get(index + 1)
    return Boolean(round && hasRecordedRoundScores(round, event.teams))
  }).every(Boolean)

  if (!hasAllRoundScores) return ''

  const highestScore = Math.max(...event.teams.map((team) => team.score))
  const leaders = event.teams.filter((team) => team.score === highestScore)

  return leaders.length === 1 ? leaders[0].id : ''
}

function buildAssignmentState(event: HammaEvent) {
  return Object.fromEntries(
    event.teams.map((team) => [
      team.id,
      {
        faction: team.faction ?? '',
        startingSide: team.startingSide ?? '',
      },
    ]),
  )
}

function getChangedCoinflipAssignments(
  event: HammaEvent,
  assignments: Record<string, { faction: string; startingSide: string }>,
) {
  return event.teams.flatMap((team) => {
    const assignment = assignments[team.id]
    if (!assignment) return []

    const changed =
      assignment.faction !== (team.faction ?? '') ||
      assignment.startingSide !== (team.startingSide ?? '')

    return changed ? [{ team, assignment }] : []
  })
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

function unclaimedAssignmentOptions(
  options: string[],
  assignments: Record<string, { faction: string; startingSide: string }>,
  teamId: string,
  key: 'faction' | 'startingSide',
) {
  const currentValue = assignments[teamId]?.[key] ?? ''
  const claimedByOtherTeams = new Set(
    Object.entries(assignments)
      .filter(([assignmentTeamId]) => assignmentTeamId !== teamId)
      .map(([, assignment]) => assignment[key])
      .filter(Boolean),
  )

  return options.filter((option) => option === currentValue || !claimedByOtherTeams.has(option))
}

function RatingAdjustments({
  event,
  busy,
  onRun,
  onEvent,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
}) {
  const ratedPlayerIds = new Set(event.ratings.map((rating) => rating.fromPlayerId))
  const raters = event.players
    .filter((player) => ratedPlayerIds.has(player.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const [fromDiscordId, setFromDiscordId] = useState(raters[0]?.id ?? '')

  useEffect(() => {
    if (!raters.length) {
      if (fromDiscordId) setFromDiscordId('')
      return
    }

    if (!raters.some((player) => player.id === fromDiscordId)) {
      setFromDiscordId(raters[0].id)
    }
  }, [fromDiscordId, raters])

  async function resetSubmittedRatings() {
    const result = await postAdminJson('/api/admin/ratings/reset', {
      eventId: event.id,
      fromDiscordId,
    })
    if (isEventResult(result)) onEvent(result.event)
    return result
  }

  return (
    <AdminSection
      id="admin-ratings"
      title="Rating adjustments"
      actions={
        <button
          type="button"
          disabled={busy === 'ratings-reset' || !fromDiscordId}
          onClick={() => void onRun('ratings-reset', resetSubmittedRatings)}
        >
          Reset submitted ratings
        </button>
      }
    >
      <div className="rating-adjustment-grid">
        <label>
          Rater
          <select
            value={fromDiscordId}
            disabled={!raters.length}
            onChange={(event) => setFromDiscordId(event.currentTarget.value)}
          >
            {raters.length ? (
              raters.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name}
                </option>
              ))
            ) : (
              <option value="">No submitted ratings</option>
            )}
          </select>
        </label>
      </div>
      <p>Resetting removes every rating submitted by the selected participant for this event.</p>
    </AdminSection>
  )
}

function mergeOptions<T extends string>(options: T[], current?: T) {
  if (!current || options.includes(current)) return options
  return [...options, current]
}

function mergeEventOptions(options: HammaEvent[], event: HammaEvent) {
  const byId = new Map(options.map((option) => [option.id, option]))
  byId.set(event.id, event)
  return [...byId.values()].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
}

function TeamForm({
  team,
  players,
  draft,
  disabled,
  onDraft,
}: {
  team: Team
  players: Player[]
  draft?: TeamDraft
  disabled: boolean
  onDraft: (patch: Partial<TeamDraft>) => void
}) {
  const sortedPlayers = [...players].sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id),
  )
  const name = draft?.name ?? team.teamName
  const captainDiscordId = draft?.captainDiscordId ?? team.captainDiscordId
  const score = draft?.score ?? team.score.toString()

  return (
    <article className="team-admin-card">
      <label>
        Team name
        <input
          value={name}
          disabled={disabled}
          onChange={(event) => onDraft({ name: event.currentTarget.value })}
        />
      </label>
      <label>
        Team Captain
        <select
          value={captainDiscordId}
          disabled={disabled}
          onChange={(event) => onDraft({ captainDiscordId: event.currentTarget.value })}
        >
          <option value="">Unassigned</option>
          {sortedPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row compact">
        <label>
          Score
          <input
            type="number"
            value={score}
            disabled={disabled}
            onChange={(event) => onDraft({ score: event.currentTarget.value })}
          />
        </label>
      </div>
      {team.honuReportUrl ? (
        <a className="team-report-link" href={team.honuReportUrl} target="_blank" rel="noreferrer">
          <EventLinkIcon name="Users" />
          <span>Honu team report</span>
        </a>
      ) : null}
    </article>
  )
}

async function postAdminAction(url: string) {
  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) throw await adminRequestError(response)
  return response.json()
}

async function postAdminJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await adminRequestError(response)
  return response.json()
}

class AdminRequestError extends Error {
  details: unknown

  constructor(message: string, details: unknown) {
    super(message)
    this.name = 'AdminRequestError'
    this.details = details
  }
}

async function adminRequestError(response: Response) {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown }
    const message = typeof parsed.message === 'string'
      ? parsed.message
      : typeof parsed.error === 'string'
        ? parsed.error
        : text || 'Action failed.'
    return new AdminRequestError(message, parsed)
  } catch {
    return new AdminRequestError(text || 'Action failed.', text)
  }
}

function errorsFromAdminError(error: unknown): EventSetupErrors {
  if (!(error instanceof AdminRequestError)) return {}
  const details = error.details
  if (!details || typeof details !== 'object' || !('fieldErrors' in details)) return {}
  const rawErrors = (details as { fieldErrors?: unknown }).fieldErrors
  if (!rawErrors || typeof rawErrors !== 'object') return {}
  const errors: EventSetupErrors = {}
  for (const field of ['title', 'startsAt', 'durationMinutes', 'signupCloseMinutesBefore'] as const) {
    const message = (rawErrors as Partial<Record<EventSetupField, unknown>>)[field]
    if (typeof message === 'string') errors[field] = message
  }
  return errors
}

function isEventResult(result: unknown): result is { event: HammaEvent } {
  return Boolean(result && typeof result === 'object' && 'event' in result && (result as { event?: unknown }).event)
}

function isNullEventResult(result: unknown): result is { event: null } {
  return Boolean(result && typeof result === 'object' && 'event' in result && (result as { event?: unknown }).event === null)
}

function isCurrentEventsResult(result: unknown): result is { currentEvents: HammaEvent[] } {
  return Boolean(
    result &&
      typeof result === 'object' &&
      'currentEvents' in result &&
      Array.isArray((result as { currentEvents?: unknown }).currentEvents),
  )
}

function isNativeEventOpsResult(result: unknown): result is { eventOps: NativeEventOpsData } {
  return Boolean(result && typeof result === 'object' && 'eventOps' in result)
}

function isFailedAdminResult(result: unknown): result is { ok: false } {
  return Boolean(result && typeof result === 'object' && (result as { ok?: unknown }).ok === false)
}

function minutesBeforeEventStart(startsAt: string, closingTime?: string) {
  if (!closingTime) return undefined
  const delta = Date.parse(startsAt) - Date.parse(closingTime)
  if (!Number.isFinite(delta)) return undefined
  return Math.round(delta / 60_000)
}

function signupCloseTimeFromMinutes(startsAt: string, minutesBefore: string) {
  const startsAtMs = Date.parse(startsAt)
  const minutes = Number(minutesBefore)
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(minutes) || minutes < 0) return ''
  return new Date(startsAtMs - Math.round(minutes) * 60_000).toISOString()
}

function parseRealtimeAdminUpdate(eventMessage: MessageEvent): RealtimeAdminUpdate | null {
  try {
    const parsed = JSON.parse(eventMessage.data) as RealtimeAdminUpdate
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.type === 'string' &&
      typeof parsed.eventId === 'string'
    ) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

function summarizeResult(result: unknown) {
  if (!result || typeof result !== 'object') return 'Action completed.'
  const record = result as Record<string, unknown>
  if (typeof record.message === 'string') return record.message
  if (record.ok && typeof record.signups === 'number') {
    const base = `Raid Helper refreshed: ${record.signups} accepted signups.`
    const discordCheckIn = summarizeDiscordCheckIn(record.discordCheckIn)
    return discordCheckIn ? `${base} ${discordCheckIn}` : base
  }
  return 'Action completed.'
}

function summarizeDiscordCheckIn(result: unknown) {
  if (!result || typeof result !== 'object') return ''

  const record = result as Record<string, unknown>
  if (record.posted) {
    return record.messageId
      ? `Discord check-in posted (${record.messageId}).`
      : 'Discord check-in posted.'
  }

  return typeof record.reason === 'string'
    ? `Discord check-in not posted: ${record.reason}`
    : 'Discord check-in not posted.'
}
