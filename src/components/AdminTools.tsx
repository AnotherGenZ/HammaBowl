import { type ReactNode, useEffect, useState } from 'react'
import type {
  AdminBadgeManagerData,
  AdminPlayerCharacterConfig,
  Team,
  EventPlayerCharacterAssignment,
  Faction,
  HammaEvent,
  Player,
  RegisteredParticipant,
  StartingSide,
} from '../lib/types'
import { shortDate } from '../lib/format'

interface RealtimeAdminUpdate {
  type: string
  eventId: string
  at: string
}

export function AdminTools({
  event,
  currentEvents,
}: {
  event: HammaEvent
  currentEvents: HammaEvent[]
}) {
  const [currentEvent, setCurrentEvent] = useState(event)
  const [currentEventOptions, setCurrentEventOptions] = useState(currentEvents)
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0)
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState<string>()

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

        <TeamEditor
          event={currentEvent}
          busy={busy}
          onRun={run}
          onEvent={setConfiguredEvent}
        />

        <EventJaegerAssignments
          event={currentEvent}
          busy={busy}
          onRun={run}
          refreshKey={realtimeRefreshKey}
        />

        <CoinflipControls event={currentEvent} busy={busy} onRun={run} onEvent={setConfiguredEvent} />

        <RatingAdjustments
          event={currentEvent}
          busy={busy}
          onRun={run}
          onEvent={setConfiguredEvent}
        />

        <EventResultControls
          event={currentEvent}
          busy={busy}
          onRun={run}
          onEvent={setConfiguredEvent}
        />

        <AdminSection
          title="Team composition"
          actions={
            <button
              type="button"
              disabled={busy === 'post'}
              onClick={() =>
                void run('post', () =>
                  postAdminJson('/api/admin/raid-helper/post-composition', {
                    eventId: currentEvent.id,
                  }),
                )
              }
            >
              Post teams
            </button>
          }
        >
          <p>Posts the current persisted teams to Raid Helper/Discord.</p>
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
    <AdminSection title="Active event">
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
  const [draftStartMinutesBefore, setDraftStartMinutesBefore] = useState(
    event.draftStartMinutesBefore?.toString() ?? '',
  )
  const [salaryPool, setSalaryPool] = useState(event.salaryPool.toString())
  const [bonusPool, setBonusPool] = useState(event.bonusPool.toString())
  const [maxPlayerBonus, setMaxPlayerBonus] = useState(event.maxPlayerBonus.toString())
  const [bidIncrement, setBidIncrement] = useState(event.bidIncrement.toString())

  useEffect(() => {
    setNameOverride(event.nameOverride ?? '')
    setDraftStartMinutesBefore(event.draftStartMinutesBefore?.toString() ?? '')
    setSalaryPool(formatWholeDollarInput(event.salaryPool))
    setBonusPool(formatWholeDollarInput(event.bonusPool))
    setMaxPlayerBonus(formatWholeDollarInput(event.maxPlayerBonus))
    setBidIncrement(formatWholeDollarInput(event.bidIncrement))
  }, [event])

  return (
    <AdminSection title="Event identity">
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
          <button
            type="button"
            disabled={busy === 'event-name'}
            onClick={() =>
              void onRun('event-name', async () => {
                const result = await postAdminJson('/api/admin/event', {
                  eventId: event.id,
                  nameOverride,
                })
                if (isEventResult(result) && result.event) onEvent(result.event)
                return result
              })
            }
          >
            Save name
          </button>
        </div>

        <div className="event-result-card">
          <strong>Draft budgets</strong>
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
          <button
            type="button"
            disabled={busy === 'draft-settings'}
            onClick={() =>
              void onRun('draft-settings', async () => {
                const result = await postAdminJson('/api/admin/event', {
                  eventId: event.id,
                  salaryPool: parseWholeDollarText(salaryPool),
                  bonusPool: parseWholeDollarText(bonusPool),
                  maxPlayerBonus: parseWholeDollarText(maxPlayerBonus),
                  bidIncrement: parseWholeDollarText(bidIncrement),
                })
                if (isEventResult(result) && result.event) onEvent(result.event)
                return result
              })
            }
          >
            Save draft settings
          </button>
        </div>

        <div className="event-result-card">
          <strong>Draft timing</strong>
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
          <button
            type="button"
            disabled={busy === 'draft-start'}
            onClick={() =>
              void onRun('draft-start', async () => {
                const result = await postAdminJson('/api/admin/event', {
                  eventId: event.id,
                  draftStartMinutesBefore,
                })
                if (isEventResult(result) && result.event) onEvent(result.event)
                return result
              })
            }
          >
            Save draft timing
          </button>
          <small>Leave blank to count down to the event start after signups close.</small>
        </div>
      </div>
    </AdminSection>
  )
}

function AdminSection({
  title,
  actions,
  children,
  defaultOpen = true,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`admin-section${open ? '' : ' is-collapsed'}`}>
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
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  onEvent: (event: HammaEvent) => void
}) {
  return (
    <AdminSection
      title="Captains and team setup"
      actions={
        <button
          type="button"
          disabled={busy === 'teams'}
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

      {event.teams.length ? (
        <div className="team-admin-grid">
          {event.teams.map((team) => (
            <TeamForm
              key={team.id}
              eventId={event.id}
              team={team}
              players={event.players}
              busy={busy === team.id}
              onSaved={onEvent}
            />
          ))}
        </div>
      ) : (
        <p>Create teams, then assign teams and names here.</p>
      )}
    </AdminSection>
  )
}

function EventJaegerAssignments({
  event,
  busy,
  onRun,
  refreshKey,
}: {
  event: HammaEvent
  busy?: string
  onRun: (label: string, action: () => Promise<unknown>) => Promise<void>
  refreshKey: number
}) {
  const [assignments, setAssignments] = useState<EventPlayerCharacterAssignment[]>([])
  const [selectedDiscordId, setSelectedDiscordId] = useState('')
  const [faction, setFaction] = useState<Faction>('TR')
  const [characterName, setCharacterName] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setLoaded(false)
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
  }, [event.id, refreshKey])

  useEffect(() => {
    if (selectedDiscordId && assignments.some((assignment) => assignment.discordId === selectedDiscordId)) return
    setSelectedDiscordId(assignments[0]?.discordId ?? '')
  }, [assignments, selectedDiscordId])

  async function assignCharacter() {
    const result = await postAdminJson('/api/admin/player-characters', {
      eventId: event.id,
      discordId: selectedDiscordId,
      faction,
      characterName,
    }) as { assignments?: EventPlayerCharacterAssignment[] }
    if (result.assignments) {
      setAssignments(result.assignments)
      setSelectedDiscordId(result.assignments[0]?.discordId ?? '')
    }
    setFaction('TR')
    setCharacterName('')
    return result
  }

  return (
    <AdminSection
      title="Event Jaeger assignments"
      actions={
        <button
          type="button"
          disabled={busy === 'event-jaeger' || !selectedDiscordId || !characterName.trim()}
          onClick={() => void onRun('event-jaeger', assignCharacter)}
        >
          Resolve and assign
        </button>
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
                  {assignment.playerName}
                </option>
              ))
            ) : (
              <option value="">{loaded ? 'No players need assignments' : 'Loading players'}</option>
            )}
          </select>
        </label>
        <label>
          Faction
          <select value={faction} onChange={(event) => setFaction(event.currentTarget.value as Faction)}>
            <option value="TR">TR</option>
            <option value="VS">VS</option>
            <option value="NC">NC</option>
          </select>
        </label>
        <label>
          Character
          <input
            value={characterName}
            disabled={!assignments.length}
            onChange={(event) => setCharacterName(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="resolved-list admin-assignment-list">
        {assignments.map((assignment) => (
          <span key={assignment.discordId}>
            <strong>{assignment.playerName}</strong>
            {assignment.assignment
              ? `${assignment.assignment.faction} ${assignment.assignment.characterName} #${assignment.assignment.characterId}`
              : 'Needs an event character'}
          </span>
        ))}
      </div>
    </AdminSection>
  )
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
                    {player.name}
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

  function choosePlayer(nextDiscordId: string) {
    setDiscordId(nextDiscordId)
    setNames(namesFromPlayer(players.find((player) => player.discordId === nextDiscordId)))
  }

  function updateFaction(faction: Faction, value: string) {
    setNames((current) => ({ ...current, [faction]: value }))
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

  return (
    <AdminSection
      title="Player Jaeger characters"
      actions={
        <button
          type="button"
          disabled={!ready || busy === 'player-jaeger' || !discordId || !names.TR.trim() || !names.VS.trim() || !names.NC.trim()}
          onClick={() => void onRun('player-jaeger', saveCharacters)}
        >
          Resolve and save
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
                    {player.name}
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
      </div>
      <div className="resolved-list admin-assignment-list">
        {selectedPlayer ? (
          <span>
            <strong>{selectedPlayer.name}</strong>
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
  const [badgeColors, setBadgeColors] = useState<Record<string, string>>({})
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
        setBadgeColors(Object.fromEntries(payload.badges.map((badge) => [badge.id, badge.color])))
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
    setBadgeColors(Object.fromEntries(result.badges.map((badge) => [badge.id, badge.color])))
    setName('')
    setDescription('')
    setColor('#e4b45e')
    return result
  }

  async function updateBadgeColor(targetBadgeId: string) {
    const result = await postAdminJson('/api/admin/badges', {
      action: 'update-color',
      badgeId: targetBadgeId,
      color: badgeColors[targetBadgeId],
    }) as AdminBadgeManagerData & { message?: string }
    setData(result)
    setBadgeColors(Object.fromEntries(result.badges.map((badge) => [badge.id, badge.color])))
    return result
  }

  return (
    <AdminSection title="Badges">
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

      <div className="resolved-list badge-definition-list">
        {data.badges.length ? (
          data.badges.map((badge) => (
            <span key={`badge-color-${badge.id}`}>
              <strong>{badge.name}</strong>
              <label className="inline-color-field">
                Color
                <input
                  type="color"
                  value={badgeColors[badge.id] ?? badge.color}
                  disabled={badge.source !== 'manual'}
                  onChange={(event) => {
                    const nextColor = event.currentTarget.value
                    setBadgeColors((current) => ({ ...current, [badge.id]: nextColor }))
                  }}
                />
              </label>
              <button
                type="button"
                disabled={
                  badge.source !== 'manual' ||
                  busy === `badge-color-${badge.id}` ||
                  (badgeColors[badge.id] ?? badge.color) === badge.color
                }
                onClick={() => void onRun(`badge-color-${badge.id}`, () => updateBadgeColor(badge.id))}
              >
                Save color
              </button>
            </span>
          ))
        ) : (
          <div className="empty-inline">{loaded ? 'No manual badges created yet.' : 'Loading badges.'}</div>
        )}
      </div>
    </AdminSection>
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

  return (
    <AdminSection
      title="Coinflip"
      actions={
        <div className="button-row">
          <button
            type="button"
            disabled={busy === 'coinflip-caller' || Boolean(coinflip)}
            onClick={() =>
              void onRun('coinflip-caller', () =>
                runCoinflipAction({ action: 'select-caller' }),
              )
            }
          >
            Select caller
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={busy === 'coinflip-reset' || !coinflip}
            onClick={() =>
              void onRun('coinflip-reset', () => runCoinflipAction({ action: 'reset' }))
            }
          >
            Reset
          </button>
        </div>
      }
    >

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
          <button
            type="button"
            disabled={busy === 'coinflip-options' || completed || !availableSides.length}
            onClick={() =>
              void onRun('coinflip-options', () =>
                runCoinflipAction({ action: 'options', availableFactions, availableSides }),
              )
            }
          >
            Save options
          </button>
        </div>

        <div className="coinflip-card">
          <strong>Call</strong>
          <p>{caller ? `${caller.teamName} calls the coin.` : 'Select a caller first.'}</p>
          <div className="segmented-control">
            <button
              type="button"
              className={call === 'heads' ? 'active' : ''}
              disabled={!pending}
              onClick={() => setCall('heads')}
            >
              Heads
            </button>
            <button
              type="button"
              className={call === 'tails' ? 'active' : ''}
              disabled={!pending}
              onClick={() => setCall('tails')}
            >
              Tails
            </button>
          </div>
          <button
            type="button"
            disabled={busy === 'coinflip' || !pending}
            onClick={() =>
              void onRun('coinflip', () => runCoinflipAction({ action: 'flip', call }))
            }
          >
            Flip coin
          </button>
          {coinflip?.result ? (
            <small>
              {coinflip.result.toUpperCase()} won. {winner?.teamName ?? 'Winning team'} chooses.
            </small>
          ) : null}
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
          <button
            type="button"
            disabled={busy === 'coinflip-choice' || !completed}
            onClick={() =>
              void onRun('coinflip-choice', () =>
                runCoinflipAction({
                  action: 'choice',
                  choiceType,
                  faction: chosenFaction,
                  startingSide,
                }),
              )
            }
          >
            Save choice
          </button>
        </div>
      </div>

      {completed ? (
        <div className="assignment-panel">
          <div className="assignment-heading">
            <strong>Team assignments</strong>
            <button
              type="button"
              disabled={busy === 'coinflip-assignments'}
              onClick={() =>
                void onRun('coinflip-assignments', () =>
                  runCoinflipAction({
                    action: 'assignments',
                    assignments: event.teams.map((team) => ({
                      teamId: team.id,
                      faction: assignments[team.id]?.faction ?? '',
                      startingSide: assignments[team.id]?.startingSide ?? '',
                    })),
                  }),
                )
              }
            >
              Save assignments
            </button>
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
    </AdminSection>
  )
}

function EventResultControls({
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
  const [streamUrl, setStreamUrl] = useState(event.twitchStreamUrl ?? '')
  const [vodUrl, setVodUrl] = useState(event.twitchVodUrl ?? '')
  const [scoreTeamId, setScoreTeamId] = useState(event.teams[0]?.id ?? '')
  const [scoreDelta, setScoreDelta] = useState('1')
  const [winningTeamId, setWinningTeamId] = useState(event.winningTeamId ?? event.teams[0]?.id ?? '')

  useEffect(() => {
    setStreamUrl(event.twitchStreamUrl ?? '')
    setVodUrl(event.twitchVodUrl ?? '')
    if (!event.teams.some((team) => team.id === scoreTeamId)) {
      setScoreTeamId(event.teams[0]?.id ?? '')
    }
    if (!event.teams.some((team) => team.id === winningTeamId)) {
      setWinningTeamId(event.winningTeamId ?? event.teams[0]?.id ?? '')
    }
  }, [event, scoreTeamId, winningTeamId])

  async function postResult(body: Record<string, unknown>) {
    const result = await postAdminJson('/api/admin/result', { eventId: event.id, ...body })
    if (isEventResult(result) && result.event) onEvent(result.event)
    return result
  }

  async function adjustScore() {
    const result = await postResult({ teamId: scoreTeamId, delta: Number(scoreDelta) })
    setScoreTeamId(event.teams[0]?.id ?? '')
    setScoreDelta('1')
    return result
  }

  return (
    <AdminSection title="Streams and results">
      <div className="event-result-grid">
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
          <button
            type="button"
            disabled={busy === 'event-links'}
            onClick={() =>
              void onRun('event-links', () =>
                postResult({ twitchStreamUrl: streamUrl, twitchVodUrl: vodUrl }),
              )
            }
          >
            Save links
          </button>
        </div>

        <div className="event-result-card">
          <strong>Score</strong>
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
            Marking complete records the winner and marks that team&apos;s captain and drafted players as event winners.
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
    </AdminSection>
  )
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
                  {player.name}
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
  eventId,
  team,
  players,
  busy,
  onSaved,
}: {
  eventId: string
  team: Team
  players: Player[]
  busy: boolean
  onSaved: (event: HammaEvent) => void
}) {
  const [name, setName] = useState(team.teamName)
  const [captainDiscordId, setCaptainDiscordId] = useState(team.captainDiscordId)
  const [score, setScore] = useState(team.score.toString())
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    setName(team.teamName)
    setCaptainDiscordId(team.captainDiscordId)
    setScore(team.score.toString())
    setMessage(undefined)
  }, [team])

  async function save() {
    setMessage(undefined)
    const result = await postAdminJson('/api/admin/team/update', {
      eventId,
      teamId: team.id,
      name,
      captainDiscordId,
      score: Number(score),
    })
    if (isEventResult(result)) onSaved(result.event)
    setMessage(summarizeResult(result))
  }

  return (
    <article className="team-admin-card">
      <label>
        Team name
        <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
      </label>
      <label>
        Team
        <select
          value={captainDiscordId}
          onChange={(event) => setCaptainDiscordId(event.currentTarget.value)}
        >
          <option value="">Unassigned</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
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
            onChange={(event) => setScore(event.currentTarget.value)}
          />
        </label>
      </div>
      <button type="button" disabled={busy} onClick={() => void save()}>
        Save team
      </button>
      {message ? <small>{message}</small> : null}
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
  if (record.ok && record.signups) return `Raid Helper refreshed: ${record.signups} accepted signups.`
  return 'Action completed.'
}
