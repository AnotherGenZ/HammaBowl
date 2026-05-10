import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import type {
  AdminBadgeManagerData,
  AdminPlayerCharacterConfig,
  AdminSignupManagerData,
  EventLink,
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
import { shortDate } from '../lib/format'
import { HONU_ALERT_ZONE_OPTIONS } from '../lib/honu'
import { undraftedDraftEligiblePlayers } from '../lib/rules'
import { EVENT_LINK_ICON_OPTIONS, EventLinkIcon } from './EventLinkIcons'
import { PlayerName } from './PlayerName'

const EVENT_TROPHY_OPTIONS: Array<{ id: EventTrophyId; label: string }> = [
  { id: 'hammo-bowl-cup', label: 'HammaBowl Cup' },
  { id: 'hamma-dome-biolab', label: 'Hamma Dome I - Bitol Bio' },
]

interface RealtimeAdminUpdate {
  type: string
  eventId: string
  at: string
}

export function AdminTools({
  event,
  currentEvents,
  onEventJaegerWarningCount,
}: {
  event: HammaEvent
  currentEvents: HammaEvent[]
  onEventJaegerWarningCount?: (count: number) => void
}) {
  const [currentEvent, setCurrentEvent] = useState(event)
  const [currentEventOptions, setCurrentEventOptions] = useState(currentEvents)
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0)
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const undraftedPlayers = undraftedDraftEligiblePlayers(currentEvent)
  const canSyncTeams = undraftedPlayers.length === 0
  const draftLocked = currentEvent.rounds.length > 0

  function setConfiguredEvent(event: HammaEvent) {
    setCurrentEvent(event)
    setCurrentEventOptions((options) => mergeEventOptions(options, event))
  }

  useEffect(() => {
    setCurrentEvent((current) => currentEvents.find((option) => option.id === current.id) ?? event)
    setCurrentEventOptions(currentEvents)
  }, [event, currentEvents])

  useEffect(() => {
    if (typeof EventSource === 'undefined') return

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
  }, [currentEvent.id])

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label)
    setMessage(undefined)
    try {
      const result = await action()
      const summary = summarizeResult(result)
      setMessage(summary)
      if (isEventResult(result)) {
        setCurrentEventOptions((options) => mergeEventOptions(options, result.event))
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
          <h1>Event controls</h1>
        </div>
        <EventTargetControls
          event={currentEvent}
          currentEvents={currentEventOptions}
          onEvent={setConfiguredEvent}
        />
      </div>

      {message ? <div className="admin-result">{message}</div> : null}

      <div className="admin-stack">
        <EventIdentityControls event={currentEvent} busy={busy} onRun={run} onEvent={setConfiguredEvent} />

        <SignupManager
          event={currentEvent}
          busy={busy}
          onRun={run}
          onEvent={setConfiguredEvent}
          refreshKey={realtimeRefreshKey}
        />

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
              Sync teams
            </button>
          }
        >
          <p>
            {canSyncTeams
              ? 'Updates the Raid Helper comp with the current persisted teams.'
              : `Finish the draft before syncing. ${undraftedPlayers.length} draft-eligible players remain undrafted.`}
          </p>
        </AdminSection>
      </div>
    </section>
  )
}

function EventTargetControls({
  event,
  currentEvents,
  onEvent,
}: {
  event: HammaEvent
  currentEvents: HammaEvent[]
  onEvent: (event: HammaEvent) => void
}) {
  const options = mergeEventOptions(currentEvents, event)

  return (
    <label className="admin-heading-control">
      Configure event
      <select
        value={event.id}
        onChange={(changeEvent) => {
          const nextEvent = options.find((option) => option.id === changeEvent.currentTarget.value)
          if (nextEvent) onEvent(nextEvent)
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} - {shortDate(option.startsAt)}
          </option>
        ))}
      </select>
    </label>
  )
}

function ActiveEventControls({
  event,
  currentEvents,
  busy,
  onRun,
  onEvent,
}: {
  event: HammaEvent
  currentEvents: HammaEvent[]
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
}) {
  const [activeEventId, setActiveEventId] = useState(event.id)
  const options = mergeEventOptions(currentEvents, event)

  useEffect(() => {
    setActiveEventId(event.id)
  }, [event.id])

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
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} - {shortDate(option.startsAt)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy === 'active-event' || activeEventId === event.id}
            onClick={() =>
              void onRun('active-event', async () => {
                const result = await postAdminJson('/api/admin/event', { activeEventId })
                if (isEventResult(result) && result.event) onEvent(result.event)
                return result
              })
            }
          >
            Set active event
          </button>
          <small>{options.length} current event{options.length === 1 ? '' : 's'} available</small>
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

  function setActiveEventSelection(event: HammaEvent) {
    setActiveEvent(event)
    setCurrentEventOptions((options) => mergeEventOptions(options, event))
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
        {activeEvent ? (
          <ActiveEventControls
            event={activeEvent}
            currentEvents={currentEventOptions}
            busy={busy}
            onRun={run}
            onEvent={setActiveEventSelection}
          />
        ) : null}

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

        <PlayerRenameManager busy={busy} onRun={run} refreshKey={realtimeRefreshKey} />
        <PlayerJaegerManager busy={busy} onRun={run} refreshKey={realtimeRefreshKey} />
        <BadgeManager busy={busy} onRun={run} refreshKey={realtimeRefreshKey} />
      </div>
    </section>
  )
}

function SignupManager({
  event,
  busy,
  onRun,
  onEvent,
  refreshKey,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
  refreshKey: number
}) {
  const [data, setData] = useState<AdminSignupManagerData>({
    players: [],
    signedUpPlayers: [],
  })
  const [addDiscordId, setAddDiscordId] = useState('')
  const [removeDiscordId, setRemoveDiscordId] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState('')
  const [loaded, setLoaded] = useState(false)
  const ready = useClientReady()

  useEffect(() => {
    if (!ready) return
    let active = true
    setLoaded(false)
    fetch(`/api/admin/signups?eventId=${encodeURIComponent(event.id)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load signups.')
        return response.json() as Promise<AdminSignupManagerData>
      })
      .then((payload) => {
        if (!active) return
        setData(payload)
        setAddDiscordId((current) =>
          current && payload.players.some((player) => player.discordId === current) ? current : '',
        )
        setRemoveDiscordId((current) =>
          current && payload.signedUpPlayers.some((player) => player.discordId === current)
            ? current
            : '',
        )
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })

    return () => {
      active = false
    }
  }, [event.id, ready, refreshKey])

  useEffect(() => {
    setRemoveDiscordId((current) =>
      current && event.players.some((player) => player.id === current) ? current : '',
    )
  }, [event.players])

  async function addSignup() {
    const result = await postAdminJson('/api/admin/signups', {
      action: 'add',
      eventId: event.id,
      discordId: addDiscordId,
    }) as AdminSignupManagerData & { event?: HammaEvent }
    if (result.event) onEvent(result.event)
    setData({
      players: result.players ?? data.players,
      signedUpPlayers: result.signedUpPlayers ?? data.signedUpPlayers,
    })
    setAddDiscordId('')
    return result
  }

  async function removeSignup() {
    const result = await postAdminJson('/api/admin/signups', {
      action: 'remove',
      eventId: event.id,
      discordId: confirmRemoveId,
    }) as AdminSignupManagerData & { event?: HammaEvent }
    if (result.event) onEvent(result.event)
    setData({
      players: result.players ?? data.players,
      signedUpPlayers: result.signedUpPlayers ?? data.signedUpPlayers,
    })
    setRemoveDiscordId('')
    setConfirmRemoveId('')
    return result
  }

  const playerToRemove = data.signedUpPlayers.find((player) => player.discordId === confirmRemoveId)

  return (
    <AdminSection id="admin-signups" title="Signups">
      {!ready ? <div className="empty-inline">Loading signups.</div> : null}
      <div className="event-result-grid">
        <div className="event-result-card">
          <strong>Add player</strong>
          <label>
            Player
            <select
              value={addDiscordId}
              disabled={!ready || !data.players.length}
              onChange={(event) => setAddDiscordId(event.currentTarget.value)}
            >
              {data.players.length ? (
                <>
                  <option value="">Choose player</option>
                  {data.players.map((player) => (
                    <option key={player.discordId} value={player.discordId}>
                      {formatParticipantLabel(player)}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">{loaded ? 'No known players' : 'Loading players'}</option>
              )}
            </select>
          </label>
          <button
            type="button"
            disabled={!ready || busy === 'signup-add' || !addDiscordId}
            onClick={() => void onRun('signup-add', addSignup)}
          >
            Add to signups
          </button>
        </div>

        <div className="event-result-card">
          <strong>Remove player</strong>
          <label>
            Signed up player
            <select
              value={removeDiscordId}
              disabled={!ready || !data.signedUpPlayers.length}
              onChange={(event) => setRemoveDiscordId(event.currentTarget.value)}
            >
              {data.signedUpPlayers.length ? (
                <>
                  <option value="">Choose player</option>
                  {data.signedUpPlayers.map((player) => (
                    <option key={player.discordId} value={player.discordId}>
                      {formatParticipantLabel(player)}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">{loaded ? 'No signed up players' : 'Loading signups'}</option>
              )}
            </select>
          </label>
          <button
            type="button"
            className="danger-button"
            disabled={!ready || busy === 'signup-remove' || !removeDiscordId}
            onClick={() => setConfirmRemoveId(removeDiscordId)}
          >
            Remove from signups
          </button>
        </div>
      </div>

      {confirmRemoveId ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmRemoveId('')}>
          <div
            className="modal-panel signup-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-remove-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <h3 id="signup-remove-title">Remove signup?</h3>
              <p>
                Remove {playerToRemove ? formatParticipantLabel(playerToRemove) : 'this player'} from {event.name}?
              </p>
            </div>
            <div className="admin-section-footer">
              <button type="button" className="secondary" onClick={() => setConfirmRemoveId('')}>
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy === 'signup-remove'}
                onClick={() => void onRun('signup-remove', removeSignup)}
              >
                Remove player
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminSection>
  )
}

function formatParticipantLabel(player: RegisteredParticipant) {
  return player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name
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
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function postAdminJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

function isEventResult(result: unknown): result is { event: HammaEvent } {
  return Boolean(result && typeof result === 'object' && 'event' in result)
}

function isCurrentEventsResult(result: unknown): result is { currentEvents: HammaEvent[] } {
  return Boolean(
    result &&
      typeof result === 'object' &&
      'currentEvents' in result &&
      Array.isArray((result as { currentEvents?: unknown }).currentEvents),
  )
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
