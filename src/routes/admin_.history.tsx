import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { AdminLayout, type AdminSidebarSection } from '../components/AdminSidebar'
import { DateTimeLocalInput } from '../components/DateTimeLocalInput'
import { localDatetimeToIso, nowDatetimeLocalValue, shortDate, toDatetimeLocalValue } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { EventTrophyId, HistoricalEvent, RegisteredParticipant } from '../lib/types'
import {
  adminSectionBodyClass,
  adminSectionClass,
  adminSectionFooterClass,
  adminSectionHeaderNoToggleClass,
  adminStackClass,
  adminMainClass,
  emptyStatePanelClass,
  historyAddTeamRowClass,
  historyAdminEventClass,
  historyAdminGridClass,
  historyFieldActionClass,
  historyFieldLinkClass,
  historyFullFieldClass,
  historyTeamClass,
  historyTeamGridClass,
  historyTeamTitleClass,
  memberLineClass,
} from '../lib/ui'
import { useDisplayTimeZone } from '../lib/useDisplayTimeZone'

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
  const displayTimeZone = useDisplayTimeZone()
  const [newEvent, setNewEvent] = useState({
    name: '',
    startsAt: nowDatetimeLocalValue(),
    server: 'Manual',
  })
  const historySections = useMemo<AdminSidebarSection[]>(
    () => [
      { id: 'admin-history-backfill', label: 'Backfill Event', status: 'pending' },
      ...events.map((event) => ({
        id: historyEventSectionId(event.id),
        label: event.nameOverride ?? event.name,
        status: 'ok' as const,
        badge: shortDate(event.date, { timeZone: displayTimeZone }),
      })),
    ],
    [events, displayTimeZone],
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
        setNewEvent({ name: '', startsAt: nowDatetimeLocalValue(), server: 'Manual' })
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
    <main className={adminMainClass}>
      {!initial.authorized ? (
        <section className={emptyStatePanelClass}>
          <h1>Admin access required</h1>
          <p>Sign in with Discord to use HammaBowl historical controls.</p>
        </section>
      ) : null}
      {initial.authorized ? (
      <>
      <AdminLayout sections={historySections}>
      <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)] ">
        <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
          <div>
            <h1>Historical events</h1>
          </div>
        </div>
        {message ? <div className="mb-4 rounded-lg border border-white/[0.10] bg-white/[0.06] px-3.5 py-3 text-[#d8dedc]">{message}</div> : null}

        <section className={adminSectionClass} id="admin-history-backfill">
          <div className={adminSectionHeaderNoToggleClass}>
            <h2>Backfill event</h2>
          </div>
          <div className={adminSectionBodyClass}>
            <div className={historyAdminGridClass}>
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
                <DateTimeLocalInput
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
              <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={busy || !newEvent.name}
                onClick={() =>
                  void run({
                    action: 'create-event',
                    ...newEvent,
                    startsAt: localDatetimeToIso(newEvent.startsAt),
                  })
                }
              >
                Create event
              </button>
            </div>
          </div>
        </section>

        <div className={adminStackClass}>
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
  const [startsAt, setStartsAt] = useState(toDatetimeLocalValue(event.date))
  const [server, setServer] = useState(event.server)
  const displayTimeZone = useDisplayTimeZone()
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
    startsAt !== toDatetimeLocalValue(event.date) ||
    server !== event.server ||
    trophyId !== event.trophyId ||
    streamUrl !== (event.twitchStreamUrl ?? '') ||
    vodUrl !== (event.twitchVodUrl ?? '') ||
    honuAlertId !== (event.honuAlertId?.toString() ?? '') ||
    lore !== (event.lore ?? '')
  const changedTeams = getChangedHistoricalTeamDrafts(event.teams, teamDrafts, participants)

  useEffect(() => {
    setNameOverride(event.nameOverride ?? event.name)
    setStartsAt(toDatetimeLocalValue(event.date))
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
        startsAt: localDatetimeToIso(startsAt),
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
    <article className={historyAdminEventClass} id={historyEventSectionId(event.id)}>
      <div className={adminSectionHeaderNoToggleClass}>
        <div>
          <h2>{event.name}</h2>
          <p>{shortDate(event.date, { timeZone: displayTimeZone })}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/hall-of-legends/$eventId" params={{ eventId: event.id }}>
            View
          </Link>
        </div>
      </div>
      <div className={adminSectionBodyClass}>
        <div className={historyAdminGridClass}>
          <label>
            Display name
            <input value={nameOverride} onChange={(event) => setNameOverride(event.currentTarget.value)} />
          </label>
          <label>
            Time
            <DateTimeLocalInput value={startsAt} onChange={(event) => setStartsAt(event.currentTarget.value)} />
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
              <a className={historyFieldLinkClass} href={honuAlertUrl(honuAlertId)} target="_blank" rel="noreferrer">
                Open alert
              </a>
            ) : null}
          </label>
          <div className={historyFieldActionClass}>
            <span>Honu links</span>
            <div className="flex flex-wrap justify-start gap-2">
              <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={busy}
                onClick={() => void onRun({ action: 'generate-honu', eventId: event.id })}
              >
                Generate Honu links
              </button>
              <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={busy}
                onClick={() => void onRun({ action: 'reset-honu', eventId: event.id })}
              >
                Reset Honu links
              </button>
            </div>
          </div>
        </div>
        <label className={historyFullFieldClass}>
          Lore
          <textarea value={lore} onChange={(event) => setLore(event.currentTarget.value)} />
        </label>

        <div className={historyTeamGridClass}>
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

        <div className={historyAddTeamRowClass}>
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
              <a className={historyFieldLinkClass} href={optionalExternalUrl(newTeam.honuReportUrl)} target="_blank" rel="noreferrer">
                Open report
              </a>
            ) : null}
          </label>
          <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
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
        <div className={adminSectionFooterClass}>
          <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
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
    <section className={historyTeamClass(team.winner)}>
      <div className={historyTeamTitleClass}>
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
          <a className={historyFieldLinkClass} href={optionalExternalUrl(honuReportUrl)} target="_blank" rel="noreferrer">
            Open report
          </a>
        ) : null}
      </label>
      <div className="flex flex-wrap justify-start gap-2">
        <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
          type="button"
          disabled={busy}
          onClick={() => void onRun({ action: 'winner', eventId, teamId: team.id })}
        >
          Winner
        </button>
      </div>
      <p className={memberLineClass}>{team.members.length ? team.members.join(', ') : 'No members recorded.'}</p>
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
      <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
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
