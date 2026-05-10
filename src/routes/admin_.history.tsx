import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { AdminLayout, type AdminSidebarSection } from '../components/AdminSidebar'
import { shortDate } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { EventTrophyId, HistoricalEvent, RegisteredParticipant } from '../lib/types'

const EVENT_TROPHY_OPTIONS: Array<{ id: EventTrophyId; label: string }> = [
  { id: 'hammo-bowl-cup', label: 'HammaBowl Cup' },
  { id: 'hamma-dome-biolab', label: 'Hamma Dome I - Bitol Bio' },
]

type HistoricalAdminAction = Record<string, unknown>

const loadHistoricalAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDiscordSessionUser } = await import('../lib/discord.server')
  const { getAdminHistoricalEvents } = await import('../lib/db.server')
  const user = await getDiscordSessionUser()
  if (!user?.roles.includes('admin')) {
    return {
      authorized: false as const,
      events: [],
      participants: [],
    }
  }

  const data = await getAdminHistoricalEvents()
  return {
    authorized: true as const,
    events: data.events,
    participants: data.participants,
  }
})

export const Route = createFileRoute('/admin_/history')({
  loader: () => loadHistoricalAdmin(),
  head: () =>
    pageMeta({
      title: 'Historical Events Admin',
      description: 'Backfill and edit completed HammaBowl events.',
      path: '/admin/history',
      noIndex: true,
    }),
  component: HistoricalAdmin,
})

function HistoricalAdmin() {
  const initial = Route.useLoaderData()
  const [events, setEvents] = useState(initial.events)
  const [participants, setParticipants] = useState(initial.participants)
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [newEvent, setNewEvent] = useState({
    name: '',
    startsAt: new Date().toISOString().slice(0, 16),
    server: 'Manual',
  })
  const historySections = useMemo<AdminSidebarSection[]>(
    () => [
      { id: 'admin-history-backfill', label: 'Backfill Event', status: 'pending' },
      ...events.map((event) => ({
        id: historyEventSectionId(event.id),
        label: event.nameOverride ?? event.name,
        status: 'ok' as const,
        badge: shortDate(event.date),
      })),
    ],
    [events],
  )

  useEffect(() => {
    setEvents(initial.events)
    setParticipants(initial.participants)
  }, [initial.events, initial.participants])

  async function run(body: HistoricalAdminAction | HistoricalAdminAction[]) {
    setBusy(true)
    setMessage(undefined)
    const actions = Array.isArray(body) ? body : [body]
    try {
      let payload: {
        message?: string
        events: HistoricalEvent[]
        participants: RegisteredParticipant[]
      } | undefined

      for (const action of actions) {
        const response = await fetch('/api/admin/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action),
        })
        if (!response.ok) throw new Error(await response.text())
        payload = (await response.json()) as {
          message?: string
          events: HistoricalEvent[]
          participants: RegisteredParticipant[]
        }
        setEvents(payload.events)
        setParticipants(payload.participants)
      }

      setMessage(actions.length > 1 ? `${actions.length} changes saved.` : payload?.message ?? 'Saved.')
      if (actions.some((action) => action.action === 'create-event')) {
        setNewEvent({ name: '', startsAt: new Date().toISOString().slice(0, 16), server: 'Manual' })
      }
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save historical event.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-main">
      {!initial.authorized ? (
        <section className="panel empty-state">
          <h1>Admin access required</h1>
          <p>Sign in with Discord to use HammaBowl historical controls.</p>
        </section>
      ) : null}
      {initial.authorized ? (
      <>
      <AdminLayout sections={historySections}>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h1>Historical events</h1>
          </div>
        </div>
        {message ? <div className="admin-result">{message}</div> : null}

        <section className="admin-section" id="admin-history-backfill">
          <div className="admin-section-header no-toggle">
            <h2>Backfill event</h2>
          </div>
          <div className="admin-section-body">
            <div className="history-admin-grid">
              <label>
                Event name
                <input
                  value={newEvent.name}
                  onChange={(event) => {
                    const name = event.currentTarget.value
                    setNewEvent((current) => ({ ...current, name }))
                  }}
                />
              </label>
              <label>
                Time
                <input
                  type="datetime-local"
                  value={newEvent.startsAt}
                  onChange={(event) => {
                    const startsAt = event.currentTarget.value
                    setNewEvent((current) => ({ ...current, startsAt }))
                  }}
                />
              </label>
              <label>
                Server
                <input
                  value={newEvent.server}
                  onChange={(event) => {
                    const server = event.currentTarget.value
                    setNewEvent((current) => ({ ...current, server }))
                  }}
                />
              </label>
              <button
                type="button"
                disabled={busy || !newEvent.name}
                onClick={() => void run({ action: 'create-event', ...newEvent })}
              >
                Create event
              </button>
            </div>
          </div>
        </section>

        <div className="admin-stack">
          {events.map((event) => (
            <HistoricalEventEditor
              key={event.id}
              event={event}
              participants={participants}
              busy={busy}
              onRun={run}
            />
          ))}
        </div>
      </section>
      </AdminLayout>
      </>
      ) : null}
    </main>
  )
}

function HistoricalEventEditor({
  event,
  participants,
  busy,
  onRun,
}: {
  event: HistoricalEvent
  participants: RegisteredParticipant[]
  busy: boolean
  onRun: (body: HistoricalAdminAction | HistoricalAdminAction[]) => Promise<boolean>
}) {
  const [nameOverride, setNameOverride] = useState(event.nameOverride ?? event.name)
  const [startsAt, setStartsAt] = useState(toLocalDateTimeValue(event.date))
  const [server, setServer] = useState(event.server)
  const [trophyId, setTrophyId] = useState<EventTrophyId>(event.trophyId)
  const [streamUrl, setStreamUrl] = useState(event.twitchStreamUrl ?? '')
  const [vodUrl, setVodUrl] = useState(event.twitchVodUrl ?? '')
  const [lore, setLore] = useState(event.lore ?? '')
  const [honuAlertId, setHonuAlertId] = useState(event.honuAlertId?.toString() ?? '')
  const [newTeam, setNewTeam] = useState({
    name: '',
    score: '0',
    captainDiscordId: '',
    captainName: '',
    honuReportUrl: '',
  })
  const [teamDrafts, setTeamDrafts] = useState<Record<string, HistoricalTeamDraft>>(() =>
    createHistoricalTeamDrafts(event.teams, participants),
  )
  const eventDetailsChanged =
    nameOverride !== (event.nameOverride ?? event.name) ||
    startsAt !== toLocalDateTimeValue(event.date) ||
    server !== event.server ||
    trophyId !== event.trophyId ||
    streamUrl !== (event.twitchStreamUrl ?? '') ||
    vodUrl !== (event.twitchVodUrl ?? '') ||
    honuAlertId !== (event.honuAlertId?.toString() ?? '') ||
    lore !== (event.lore ?? '')
  const changedTeams = getChangedHistoricalTeamDrafts(event.teams, teamDrafts, participants)

  useEffect(() => {
    setNameOverride(event.nameOverride ?? event.name)
    setStartsAt(toLocalDateTimeValue(event.date))
    setServer(event.server)
    setTrophyId(event.trophyId)
    setStreamUrl(event.twitchStreamUrl ?? '')
    setVodUrl(event.twitchVodUrl ?? '')
    setHonuAlertId(event.honuAlertId?.toString() ?? '')
    setLore(event.lore ?? '')
    setTeamDrafts(createHistoricalTeamDrafts(event.teams, participants))
  }, [event, participants])

  function updateTeamDraft(teamId: string, patch: Partial<HistoricalTeamDraft>) {
    setTeamDrafts((current) => {
      const team = event.teams.find((candidate) => candidate.id === teamId)
      const draft = current[teamId] ?? createHistoricalTeamDraft(team, participants)
      return {
        ...current,
        [teamId]: { ...draft, ...patch },
      }
    })
  }

  function saveEventChanges() {
    const actions: HistoricalAdminAction[] = []

    if (eventDetailsChanged) {
      actions.push({
        action: 'update-event',
        eventId: event.id,
        nameOverride,
        startsAt,
        server,
        trophyId,
        twitchStreamUrl: streamUrl,
        twitchVodUrl: vodUrl,
        honuAlertId,
        lore,
      })
    }

    for (const { team, draft } of changedTeams) {
      actions.push({
        action: 'upsert-team',
        eventId: event.id,
        teamId: team.id,
        name: draft.name,
        score: Number(draft.score),
        captainDiscordId: draft.captainDiscordId,
        captainName: draft.captainName,
        honuReportUrl: draft.honuReportUrl,
      })
    }

    return onRun(actions)
  }

  return (
    <article className="admin-section history-admin-event" id={historyEventSectionId(event.id)}>
      <div className="admin-section-header no-toggle">
        <div>
          <h2>{event.name}</h2>
          <p>{shortDate(event.date)}</p>
        </div>
        <div className="button-row">
          <Link to="/hall-of-legends/$eventId" params={{ eventId: event.id }}>
            View
          </Link>
        </div>
      </div>
      <div className="admin-section-body">
        <div className="history-admin-grid">
          <label>
            Display name
            <input value={nameOverride} onChange={(event) => setNameOverride(event.currentTarget.value)} />
          </label>
          <label>
            Time
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.currentTarget.value)} />
          </label>
          <label>
            Server
            <input value={server} onChange={(event) => setServer(event.currentTarget.value)} />
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
          <label>
            Stream
            <input value={streamUrl} onChange={(event) => setStreamUrl(event.currentTarget.value)} />
          </label>
          <label>
            VOD
            <input value={vodUrl} onChange={(event) => setVodUrl(event.currentTarget.value)} />
          </label>
          <label>
            Honu alert
            <input
              value={honuAlertId}
              placeholder="Alert ID or URL"
              onChange={(event) => setHonuAlertId(event.currentTarget.value)}
            />
            {honuAlertUrl(honuAlertId) ? (
              <a className="history-field-link" href={honuAlertUrl(honuAlertId)} target="_blank" rel="noreferrer">
                Open alert
              </a>
            ) : null}
          </label>
          <div className="history-field-action">
            <span>Honu links</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRun({ action: 'reset-honu', eventId: event.id })}
            >
              Reset Honu links
            </button>
          </div>
        </div>
        <label className="full-field">
          Lore
          <textarea value={lore} onChange={(event) => setLore(event.currentTarget.value)} />
        </label>

        <div className="history-team-grid">
          {event.teams.map((team) => (
            <HistoricalTeamEditor
              key={team.id}
              eventId={event.id}
              team={team}
              participants={participants}
              busy={busy}
              draft={teamDrafts[team.id]}
              onDraft={(patch) => updateTeamDraft(team.id, patch)}
              onRun={onRun}
            />
          ))}
        </div>

        <div className="history-admin-grid add-team-row">
          <label>
            New team
            <input
              value={newTeam.name}
              onChange={(event) => {
                const name = event.currentTarget.value
                setNewTeam((current) => ({ ...current, name }))
              }}
            />
          </label>
          <label>
            Score
            <input
              type="number"
              value={newTeam.score}
              onChange={(event) => {
                const score = event.currentTarget.value
                setNewTeam((current) => ({ ...current, score }))
              }}
            />
          </label>
          <ParticipantPicker
            participants={participants}
            value={newTeam.captainDiscordId}
            onChange={(captainDiscordId) => setNewTeam((current) => ({ ...current, captainDiscordId }))}
            label="Team"
          />
          <label>
            Team name
            <input
              value={newTeam.captainName}
              onChange={(event) => {
                const captainName = event.currentTarget.value
                setNewTeam((current) => ({ ...current, captainName }))
              }}
            />
          </label>
          <label>
            Honu report
            <input
              value={newTeam.honuReportUrl}
              placeholder="https://wt.honu.pw/report/..."
              onChange={(event) => {
                const honuReportUrl = event.currentTarget.value
                setNewTeam((current) => ({ ...current, honuReportUrl }))
              }}
            />
            {optionalExternalUrl(newTeam.honuReportUrl) ? (
              <a className="history-field-link" href={optionalExternalUrl(newTeam.honuReportUrl)} target="_blank" rel="noreferrer">
                Open report
              </a>
            ) : null}
          </label>
          <button
            type="button"
            disabled={busy || !newTeam.name}
            onClick={() =>
              void (async () => {
                const saved = await onRun({
                  action: 'upsert-team',
                  eventId: event.id,
                  name: newTeam.name,
                  score: Number(newTeam.score),
                  captainDiscordId: newTeam.captainDiscordId,
                  captainName: newTeam.captainName,
                  honuReportUrl: newTeam.honuReportUrl,
                })
            if (saved) {
              setNewTeam({
                name: '',
                score: '0',
                captainDiscordId: '',
                captainName: '',
                honuReportUrl: '',
              })
            }
              })()
            }
          >
            Add team
          </button>
        </div>
        <div className="admin-section-footer">
          <button
            type="button"
            disabled={busy || (!eventDetailsChanged && !changedTeams.length)}
            onClick={() => void saveEventChanges()}
          >
            Save event changes
          </button>
        </div>
      </div>
    </article>
  )
}

function historyEventSectionId(eventId: string) {
  return `admin-history-event-${eventId}`
}

interface HistoricalTeamDraft {
  name: string
  score: string
  captainDiscordId: string
  captainName: string
  honuReportUrl: string
}

function createHistoricalTeamDraft(
  team: HistoricalEvent['teams'][number] | undefined,
  participants: RegisteredParticipant[],
): HistoricalTeamDraft {
  return {
    name: team?.name ?? '',
    score: team?.score.toString() ?? '0',
    captainDiscordId: team ? getHistoricalCaptainDiscordId(team, participants) : '',
    captainName: team?.captain ?? '',
    honuReportUrl: team?.honuReportUrl ?? '',
  }
}

function createHistoricalTeamDrafts(
  teams: HistoricalEvent['teams'],
  participants: RegisteredParticipant[],
) {
  return Object.fromEntries(
    teams.map((team) => [team.id, createHistoricalTeamDraft(team, participants)]),
  )
}

function getChangedHistoricalTeamDrafts(
  teams: HistoricalEvent['teams'],
  drafts: Record<string, HistoricalTeamDraft>,
  participants: RegisteredParticipant[],
) {
  return teams.flatMap((team) => {
    const draft = drafts[team.id]
    if (!draft) return []

    const changed =
      draft.name !== team.name ||
      Number(draft.score) !== team.score ||
      draft.captainDiscordId !== getHistoricalCaptainDiscordId(team, participants) ||
      draft.captainName !== (team.captain ?? '') ||
      draft.honuReportUrl !== (team.honuReportUrl ?? '')

    return changed ? [{ team, draft }] : []
  })
}

function getHistoricalCaptainDiscordId(
  team: HistoricalEvent['teams'][number],
  participants: RegisteredParticipant[],
) {
  return participants.find((participant) => participant.name === team.captain)?.discordId ?? ''
}

function HistoricalTeamEditor({
  eventId,
  team,
  participants,
  busy,
  draft,
  onDraft,
  onRun,
}: {
  eventId: string
  team: HistoricalEvent['teams'][number]
  participants: RegisteredParticipant[]
  busy: boolean
  draft?: HistoricalTeamDraft
  onDraft: (patch: Partial<HistoricalTeamDraft>) => void
  onRun: (body: HistoricalAdminAction | HistoricalAdminAction[]) => Promise<boolean>
}) {
  const [memberDiscordId, setMemberDiscordId] = useState('')
  const [memberName, setMemberName] = useState('')
  const name = draft?.name ?? team.name
  const score = draft?.score ?? team.score.toString()
  const captainDiscordId = draft?.captainDiscordId ?? getHistoricalCaptainDiscordId(team, participants)
  const captainName = draft?.captainName ?? team.captain ?? ''
  const honuReportUrl = draft?.honuReportUrl ?? team.honuReportUrl ?? ''

  return (
    <section className={`history-team${team.winner ? ' winner' : ''}`}>
      <div className="history-team-title">
        <h3>{team.name}</h3>
        {team.winner ? <span>Winner</span> : null}
      </div>
      <label>
        Team name
        <input value={name} disabled={busy} onChange={(event) => onDraft({ name: event.currentTarget.value })} />
      </label>
      <label>
        Score
        <input
          type="number"
          value={score}
          disabled={busy}
          onChange={(event) => onDraft({ score: event.currentTarget.value })}
        />
      </label>
      <ParticipantPicker
        participants={participants}
        value={captainDiscordId}
        onChange={(captainDiscordId) => onDraft({ captainDiscordId })}
        label="Team"
      />
      <label>
        Team name
        <input
          value={captainName}
          disabled={busy}
          onChange={(event) => onDraft({ captainName: event.currentTarget.value })}
        />
      </label>
      <label>
        Honu report
        <input
          value={honuReportUrl}
          disabled={busy}
          placeholder="https://wt.honu.pw/report/..."
          onChange={(event) => onDraft({ honuReportUrl: event.currentTarget.value })}
        />
        {optionalExternalUrl(honuReportUrl) ? (
          <a className="history-field-link" href={optionalExternalUrl(honuReportUrl)} target="_blank" rel="noreferrer">
            Open report
          </a>
        ) : null}
      </label>
      <div className="button-row left">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRun({ action: 'winner', eventId, teamId: team.id })}
        >
          Winner
        </button>
      </div>
      <p className="member-line">{team.members.length ? team.members.join(', ') : 'No members recorded.'}</p>
      <ParticipantPicker
        participants={participants}
        value={memberDiscordId}
        onChange={setMemberDiscordId}
        label="Add member"
      />
      <label>
        New participant name
        <input value={memberName} onChange={(event) => setMemberName(event.currentTarget.value)} />
      </label>
      <button
        type="button"
        disabled={busy || !memberDiscordId}
        onClick={() =>
          void (async () => {
            const saved = await onRun({
              action: 'add-member',
              eventId,
              teamId: team.id,
              discordId: memberDiscordId,
              name: memberName,
            })
            if (saved) {
              setMemberDiscordId('')
              setMemberName('')
            }
          })()
        }
      >
        Add member
      </button>
    </section>
  )
}

function ParticipantPicker({
  participants,
  value,
  onChange,
  label,
}: {
  participants: RegisteredParticipant[]
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <label>
      {label}
      <input
        list={`${label.replace(/\s+/g, '-').toLowerCase()}-participants`}
        value={value}
        placeholder="Discord ID"
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <datalist id={`${label.replace(/\s+/g, '-').toLowerCase()}-participants`}>
        {participants.map((participant) => (
          <option key={participant.discordId} value={participant.discordId}>
            {participant.groupTag ? `[${participant.groupTag}] ${participant.name}` : participant.name}
          </option>
        ))}
      </datalist>
    </label>
  )
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function honuAlertUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const id = trimmed.match(/(?:^|\/)alert\/(\d+)(?:$|[/?#])/)?.[1] ?? trimmed
  return /^\d+$/.test(id) ? `https://wt.honu.pw/alert/${id}` : undefined
}

function optionalExternalUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
