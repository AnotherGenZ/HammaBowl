import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { AdminNav } from './admin'
import { shortDate } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { HistoricalEvent, RegisteredParticipant } from '../lib/types'

const loadHistoricalAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdminSession } = await import('../lib/discord.server')
  const { getAdminHistoricalEvents } = await import('../lib/db.server')
  await requireAdminSession()
  return getAdminHistoricalEvents()
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

  useEffect(() => {
    setEvents(initial.events)
    setParticipants(initial.participants)
  }, [initial.events, initial.participants])

  async function run(body: Record<string, unknown>) {
    setBusy(true)
    setMessage(undefined)
    try {
      const response = await fetch('/api/admin/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(await response.text())
      const payload = (await response.json()) as {
        message?: string
        events: HistoricalEvent[]
        participants: RegisteredParticipant[]
      }
      setEvents(payload.events)
      setParticipants(payload.participants)
      setMessage(payload.message ?? 'Saved.')
      if (body.action === 'create-event') {
        setNewEvent({ name: '', startsAt: new Date().toISOString().slice(0, 16), server: 'Manual' })
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save historical event.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <AdminNav />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h1>Historical events</h1>
          </div>
        </div>
        {message ? <div className="admin-result">{message}</div> : null}

        <section className="admin-section">
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
  onRun: (body: Record<string, unknown>) => Promise<void>
}) {
  const [nameOverride, setNameOverride] = useState(event.nameOverride ?? event.name)
  const [startsAt, setStartsAt] = useState(toLocalDateTimeValue(event.date))
  const [server, setServer] = useState(event.server)
  const [streamUrl, setStreamUrl] = useState(event.twitchStreamUrl ?? '')
  const [vodUrl, setVodUrl] = useState(event.twitchVodUrl ?? '')
  const [lore, setLore] = useState(event.lore ?? '')
  const [newTeam, setNewTeam] = useState({ name: '', score: '0', captainDiscordId: '', captainName: '' })

  return (
    <article className="admin-section history-admin-event">
      <div className="admin-section-header no-toggle">
        <div>
          <h2>{event.name}</h2>
          <p>{shortDate(event.date)}</p>
        </div>
        <Link to="/hall-of-legends/$eventId" params={{ eventId: event.id }}>
          View
        </Link>
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
            Stream
            <input value={streamUrl} onChange={(event) => setStreamUrl(event.currentTarget.value)} />
          </label>
          <label>
            VOD
            <input value={vodUrl} onChange={(event) => setVodUrl(event.currentTarget.value)} />
          </label>
        </div>
        <label className="full-field">
          Lore
          <textarea value={lore} onChange={(event) => setLore(event.currentTarget.value)} />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onRun({
              action: 'update-event',
              eventId: event.id,
              nameOverride,
              startsAt,
              server,
              twitchStreamUrl: streamUrl,
              twitchVodUrl: vodUrl,
              lore,
            })
          }
        >
          Save event
        </button>

        <div className="history-team-grid">
          {event.teams.map((team) => (
            <HistoricalTeamEditor
              key={team.id}
              eventId={event.id}
              team={team}
              participants={participants}
              busy={busy}
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
            label="Captain"
          />
          <label>
            Captain name
            <input
              value={newTeam.captainName}
              onChange={(event) => {
                const captainName = event.currentTarget.value
                setNewTeam((current) => ({ ...current, captainName }))
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || !newTeam.name}
            onClick={() =>
              void onRun({
                action: 'upsert-team',
                eventId: event.id,
                name: newTeam.name,
                score: Number(newTeam.score),
                captainDiscordId: newTeam.captainDiscordId,
                captainName: newTeam.captainName,
              })
            }
          >
            Add team
          </button>
        </div>
      </div>
    </article>
  )
}

function HistoricalTeamEditor({
  eventId,
  team,
  participants,
  busy,
  onRun,
}: {
  eventId: string
  team: HistoricalEvent['teams'][number]
  participants: RegisteredParticipant[]
  busy: boolean
  onRun: (body: Record<string, unknown>) => Promise<void>
}) {
  const captain = participants.find((participant) => participant.name === team.captain)
  const [name, setName] = useState(team.name)
  const [score, setScore] = useState(team.score.toString())
  const [captainDiscordId, setCaptainDiscordId] = useState(captain?.discordId ?? '')
  const [captainName, setCaptainName] = useState(team.captain ?? '')
  const [memberDiscordId, setMemberDiscordId] = useState('')
  const [memberName, setMemberName] = useState('')

  return (
    <section className={`history-team${team.winner ? ' winner' : ''}`}>
      <div className="history-team-title">
        <h3>{team.name}</h3>
        {team.winner ? <span>Winner</span> : null}
      </div>
      <label>
        Team name
        <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
      </label>
      <label>
        Score
        <input type="number" value={score} onChange={(event) => setScore(event.currentTarget.value)} />
      </label>
      <ParticipantPicker
        participants={participants}
        value={captainDiscordId}
        onChange={setCaptainDiscordId}
        label="Captain"
      />
      <label>
        Captain name
        <input value={captainName} onChange={(event) => setCaptainName(event.currentTarget.value)} />
      </label>
      <div className="button-row left">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onRun({
              action: 'upsert-team',
              eventId,
              teamId: team.id,
              name,
              score: Number(score),
              captainDiscordId,
              captainName,
            })
          }
        >
          Save team
        </button>
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
          void onRun({
            action: 'add-member',
            eventId,
            teamId: team.id,
            discordId: memberDiscordId,
            name: memberName,
          })
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
            {participant.name}
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
