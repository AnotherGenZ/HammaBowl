import { type ReactNode, useEffect, useState } from 'react'
import type { Captain, Faction, HammaEvent, Player, StartingSide } from '../lib/types'

export function AdminTools({ event }: { event: HammaEvent }) {
  const [currentEvent, setCurrentEvent] = useState(event)
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState<string>()

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label)
    setMessage(undefined)
    try {
      const result = await action()
      const summary = summarizeResult(result)
      setMessage(summary)
      if (isEventResult(result)) setCurrentEvent(result.event)
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
      </div>

      {message ? <div className="admin-result">{message}</div> : null}

      <div className="admin-stack">
        <EventIdentityControls event={currentEvent} busy={busy} onRun={run} onEvent={setCurrentEvent} />

        <AdminSection
          title="Event sync"
          actions={
            <button
              type="button"
              disabled={busy === 'refresh'}
              onClick={() =>
                void run('refresh', async () => {
                  const result = await postAdminAction('/api/admin/raid-helper/refresh')
                  window.location.reload()
                  return result
                })
              }
            >
              {busy === 'refresh' ? 'Refreshing' : 'Force refresh'}
            </button>
          }
        >
          <p>Pull the current event, closing time, and accepted signups from Raid Helper.</p>
        </AdminSection>

        <TeamEditor
          event={currentEvent}
          busy={busy}
          onRun={run}
          onEvent={setCurrentEvent}
        />

        <CoinflipControls event={currentEvent} busy={busy} onRun={run} onEvent={setCurrentEvent} />

        <RatingAdjustments
          event={currentEvent}
          busy={busy}
          onRun={run}
          onEvent={setCurrentEvent}
        />

        <EventResultControls
          event={currentEvent}
          busy={busy}
          onRun={run}
          onEvent={setCurrentEvent}
        />

        <AdminSection
          title="Team composition"
          actions={
            <button
              type="button"
              disabled={busy === 'post'}
              onClick={() =>
                void run('post', () =>
                  postAdminAction('/api/admin/raid-helper/post-composition'),
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

  useEffect(() => {
    setNameOverride(event.nameOverride ?? '')
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
                const result = await postAdminJson('/api/admin/event', { nameOverride })
                if (isEventResult(result) && result.event) onEvent(result.event)
                return result
              })
            }
          >
            Save name
          </button>
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
              const result = await postAdminAction('/api/admin/teams/ensure')
              window.location.reload()
              return result
            })
          }
        >
          {event.captains.length ? 'Ensure teams' : 'Create teams'}
        </button>
      }
    >

      {event.captains.length ? (
        <div className="team-admin-grid">
          {event.captains.map((team) => (
            <TeamForm
              key={team.id}
              team={team}
              players={event.players}
              busy={busy === team.id}
              onSaved={onEvent}
            />
          ))}
        </div>
      ) : (
        <p>Create teams, then assign captains and names here.</p>
      )}
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
  const caller = event.captains.find((team) => team.id === coinflip?.callingCaptainId)
  const winner = event.captains.find((team) => team.id === coinflip?.winningCaptainId)
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
    const result = await postAdminJson('/api/admin/coinflip', body)
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
                    assignments: event.captains.map((team) => ({
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
            {event.captains.map((team) => {
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
  const [scoreTeamId, setScoreTeamId] = useState(event.captains[0]?.id ?? '')
  const [scoreDelta, setScoreDelta] = useState('1')
  const [winningTeamId, setWinningTeamId] = useState(event.winningCaptainId ?? event.captains[0]?.id ?? '')

  useEffect(() => {
    setStreamUrl(event.twitchStreamUrl ?? '')
    setVodUrl(event.twitchVodUrl ?? '')
    if (!event.captains.some((team) => team.id === scoreTeamId)) {
      setScoreTeamId(event.captains[0]?.id ?? '')
    }
    if (!event.captains.some((team) => team.id === winningTeamId)) {
      setWinningTeamId(event.winningCaptainId ?? event.captains[0]?.id ?? '')
    }
  }, [event, scoreTeamId, winningTeamId])

  async function postResult(body: Record<string, unknown>) {
    const result = await postAdminJson('/api/admin/result', body)
    if (isEventResult(result) && result.event) onEvent(result.event)
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
              disabled={!event.captains.length}
              onChange={(event) => setScoreTeamId(event.currentTarget.value)}
            >
              {event.captains.map((team) => (
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
            onClick={() =>
              void onRun('score-adjust', () =>
                postResult({ teamId: scoreTeamId, delta: Number(scoreDelta) }),
              )
            }
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
              disabled={!event.captains.length}
              onChange={(event) => setWinningTeamId(event.currentTarget.value)}
            >
              {event.captains.map((team) => (
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
    event.captains.map((team) => [
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
    const result = await postAdminJson('/api/admin/ratings/reset', { fromDiscordId })
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

function TeamForm({
  team,
  players,
  busy,
  onSaved,
}: {
  team: Captain
  players: Player[]
  busy: boolean
  onSaved: (event: HammaEvent) => void
}) {
  const [name, setName] = useState(team.teamName)
  const [captainDiscordId, setCaptainDiscordId] = useState(team.playerId)
  const [score, setScore] = useState(team.score.toString())
  const [message, setMessage] = useState<string>()

  async function save() {
    setMessage(undefined)
    const result = await postAdminJson('/api/admin/team/update', {
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
        Captain
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

function summarizeResult(result: unknown) {
  if (!result || typeof result !== 'object') return 'Action completed.'
  const record = result as Record<string, unknown>
  if (typeof record.message === 'string') return record.message
  if (record.ok && record.signups) return `Raid Helper refreshed: ${record.signups} accepted signups.`
  return 'Action completed.'
}
