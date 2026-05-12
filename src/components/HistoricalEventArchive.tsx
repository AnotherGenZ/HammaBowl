import { Link } from '@tanstack/react-router'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { compactMoney, money } from '../lib/format'
import type { HistoricalEvent } from '../lib/types'
import {
  legendDataSectionClass,
  legendDraftControlsClass,
  legendDraftCurrentClass,
  legendDraftPickCardClass,
  legendDraftProcessClass,
  legendDraftReplayClass,
  legendDraftStateClass,
  legendDraftTeamHeadingClass,
  legendDraftTimelineButtonClass,
  legendDraftTimelineClass,
  legendMutedClass,
  legendRatingEmptyClass,
  legendRatingSpecsClass,
  legendRatingTableClass,
  legendRatingTableWrapClass,
  legendSectionHeadingClass,
  playersClearButtonClass,
  playersCountPillClass,
  playersFilterSelectClass,
  playersSortArrowClass,
  playersSortButtonClass,
  playersToolbarClass,
} from '../lib/ui'
import { PlayerName } from './PlayerName'

type RatingSortKey = 'name' | 'rating' | 'salary' | 'team'
type SortDirection = 'asc' | 'desc'

export function HistoricalEventArchive({ event }: { event: HistoricalEvent }) {
  return (
    <>
      <LegendDraftReplay event={event} />
      <LegendRatingSummary event={event} />
    </>
  )
}

function LegendDraftReplay({ event }: { event: HistoricalEvent }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const selectedPick = event.draftPicks[selectedIndex]
  const replayTeams = buildDraftReplayTeams(event, selectedPick?.order ?? 0)

  useEffect(() => {
    setSelectedIndex(0)
    setPlaying(false)
  }, [event.id])

  useEffect(() => {
    if (!playing || event.draftPicks.length <= 1) return

    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        if (current >= event.draftPicks.length - 1) {
          window.clearInterval(timer)
          setPlaying(false)
          return current
        }

        return current + 1
      })
    }, 1500)

    return () => window.clearInterval(timer)
  }, [event.draftPicks.length, playing])

  if (!event.draftPicks.length) {
    return (
      <section className={legendDataSectionClass}>
        <div className={legendSectionHeadingClass}>
          <span>Draft replay</span>
          <h2>No draft picks recorded</h2>
        </div>
      </section>
    )
  }

  return (
    <section className={legendDataSectionClass} aria-label={`${event.name} draft replay`}>
      <div className={legendSectionHeadingClass}>
        <span>Draft replay</span>
        <h2>{event.draftPicks.length} selection{event.draftPicks.length === 1 ? '' : 's'}</h2>
      </div>

      <div className={legendDraftReplayClass}>
        <div className={legendDraftControlsClass}>
          <button
            type="button"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e]/40 bg-[#e4b45e]/[0.10] px-3.5 font-extrabold text-[#f3d99d] transition-colors hover:border-[#f0c878]/70 hover:bg-[#e4b45e]/[0.20] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={selectedIndex === 0}
            onClick={() => {
              setPlaying(false)
              setSelectedIndex(0)
            }}
            title="Jump to first pick"
          >
            <SkipBack size={16} aria-hidden="true" />
          </button>
          <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
            type="button"
            onClick={() => setPlaying((current) => !current)}
            title={playing ? 'Pause replay' : 'Play replay'}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e]/40 bg-[#e4b45e]/[0.10] px-3.5 font-extrabold text-[#f3d99d] transition-colors hover:border-[#f0c878]/70 hover:bg-[#e4b45e]/[0.20] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={selectedIndex >= event.draftPicks.length - 1}
            onClick={() => {
              setPlaying(false)
              setSelectedIndex((current) => Math.min(event.draftPicks.length - 1, current + 1))
            }}
            title="Next pick"
          >
            <SkipForward size={16} aria-hidden="true" />
          </button>
          <span>
            Pick {selectedPick.order} of {event.draftPicks.length}
          </span>
        </div>

        <div className={legendDraftTimelineClass} aria-label="Draft selection timeline">
          {event.draftPicks.map((pick, index) => (
            <button
              key={pick.id}
              type="button"
              className={legendDraftTimelineButtonClass(index === selectedIndex)}
              onClick={() => {
                setPlaying(false)
                setSelectedIndex(index)
              }}
              aria-label={`Show pick ${pick.order}: ${pick.player.name} to ${pick.team.name}`}
            >
              <span>{pick.order}</span>
            </button>
          ))}
        </div>

        <article className={legendDraftCurrentClass}>
          <div className={legendDraftPickCardClass}>
            <span>Current selection</span>
            <h3>
              <Link to="/players/$discordId" params={{ discordId: selectedPick.player.discordId }}>
                <PlayerName
                  name={selectedPick.player.name}
                  groupTag={selectedPick.player.groupTag}
                  groupTagColor={selectedPick.player.groupTagColor}
                />
              </Link>
            </h3>
            <dl>
              <div>
                <dt>Team</dt>
                <dd>{selectedPick.team.name}</dd>
              </div>
              <div>
                <dt>Salary</dt>
                <dd>{money(selectedPick.salary)}</dd>
              </div>
              <div>
                <dt>Bonus</dt>
                <dd>{money(selectedPick.bonusSpent)}</dd>
              </div>
            </dl>
          </div>

          <ol className={legendDraftProcessClass}>
            {buildDraftProcessSteps(selectedPick).map((step) => (
              <li key={step.label}>
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </article>

        <div className={legendDraftStateClass} aria-label={`Rosters after pick ${selectedPick.order}`}>
          {replayTeams.map((team) => (
            <article key={team.id}>
              <div className={legendDraftTeamHeadingClass}>
                <h3>{team.name}</h3>
                <span>{team.members.length} player{team.members.length === 1 ? '' : 's'}</span>
              </div>
              <dl>
                <div>
                  <dt>Budget left</dt>
                  <dd>{compactMoney(team.budgetRemaining)}</dd>
                </div>
                <div>
                  <dt>Bonus left</dt>
                  <dd>{compactMoney(team.bonusRemaining)}</dd>
                </div>
              </dl>
              <ul>
                {team.members.map((member) => (
                  <li key={`${team.id}-${member.discordId}`}>
                    <Link to="/players/$discordId" params={{ discordId: member.discordId }}>
                      <PlayerName name={member.name} groupTag={member.groupTag} groupTagColor={member.groupTagColor} />
                    </Link>
                    {member.note ? <small>{member.note}</small> : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function LegendRatingSummary({ event }: { event: HistoricalEvent }) {
  const [sortKey, setSortKey] = useState<RatingSortKey>('rating')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [teamFilter, setTeamFilter] = useState('all')
  const [specFilter, setSpecFilter] = useState('all')
  const rateablePlayers = useMemo(
    () => event.playerRatings.filter((rating) => !rating.isCaptain && !rating.disqualified),
    [event.playerRatings],
  )
  const teamOptions = useMemo(() => buildRatingTeamOptions(rateablePlayers), [rateablePlayers])
  const specOptions = useMemo(() => buildRatingSpecOptions(rateablePlayers), [rateablePlayers])
  const filteredRatings = useMemo(
    () =>
      rateablePlayers.filter((rating) => {
        const teamName = rating.teamName ?? 'Undrafted'
        const matchesTeam = teamFilter === 'all' || teamName === teamFilter
        const matchesSpec = specFilter === 'all' || rating.specs.includes(specFilter)
        return matchesTeam && matchesSpec
      }),
    [rateablePlayers, specFilter, teamFilter],
  )
  const visibleRatings = useMemo(
    () =>
      [...filteredRatings].sort((a, b) => compareRatings(a, b, sortKey, sortDirection)),
    [filteredRatings, sortDirection, sortKey],
  )
  const hasActiveFilters = teamFilter !== 'all' || specFilter !== 'all'

  if (!rateablePlayers.length) {
    return (
      <section className={legendDataSectionClass}>
        <div className={legendSectionHeadingClass}>
          <span>Player ratings</span>
          <h2>No player ratings recorded</h2>
        </div>
      </section>
    )
  }

  return (
    <section className={legendDataSectionClass} aria-label={`${event.name} player ratings`}>
      <div className={legendSectionHeadingClass}>
        <span>Player ratings</span>
        <h2>{visibleRatings.length} of {rateablePlayers.length} player{rateablePlayers.length === 1 ? '' : 's'}</h2>
      </div>
      <div className={playersToolbarClass}>
        <label className={playersFilterSelectClass}>
          Team
          <select value={teamFilter} onChange={(event) => setTeamFilter(event.currentTarget.value)}>
            <option value="all">Any team</option>
            {teamOptions.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>
        <label className={playersFilterSelectClass}>
          Class
          <select value={specFilter} onChange={(event) => setSpecFilter(event.currentTarget.value)}>
            <option value="all">Any Class</option>
            {specOptions.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </label>
        {hasActiveFilters ? (
          <button
            type="button"
            className={playersClearButtonClass}
            onClick={() => {
              setTeamFilter('all')
              setSpecFilter('all')
            }}
          >
            Clear
          </button>
        ) : null}
        <span className={playersCountPillClass}>
          {visibleRatings.length} player{visibleRatings.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className={legendRatingTableWrapClass}>
        <table className={legendRatingTableClass}>
          <thead>
            <tr>
              <th>
                <RatingSortButton
                  label="Player"
                  sortKey="name"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onToggle={(key) => updateRatingSort(key, sortKey, sortDirection, setSortKey, setSortDirection)}
                />
              </th>
              <th>
                <RatingSortButton
                  label="Rating"
                  sortKey="rating"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onToggle={(key) => updateRatingSort(key, sortKey, sortDirection, setSortKey, setSortDirection)}
                />
              </th>
              <th>
                <RatingSortButton
                  label="Salary"
                  sortKey="salary"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onToggle={(key) => updateRatingSort(key, sortKey, sortDirection, setSortKey, setSortDirection)}
                />
              </th>
              <th>
                <RatingSortButton
                  label="Team"
                  sortKey="team"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onToggle={(key) => updateRatingSort(key, sortKey, sortDirection, setSortKey, setSortDirection)}
                />
              </th>
              <th>Classes</th>
            </tr>
          </thead>
          <tbody>
            {visibleRatings.map((rating) => (
              <tr key={rating.discordId}>
                <td>
                  <Link to="/players/$discordId" params={{ discordId: rating.discordId }}>
                    <PlayerName name={rating.name} groupTag={rating.groupTag} groupTagColor={rating.groupTagColor} />
                  </Link>
                  {rating.isCaptain ? <small>Captain</small> : null}
                  {rating.disqualified ? <small>Disqualified</small> : null}
                </td>
                <td>
                  <strong>{rating.averageRating === null ? 'Unrated' : rating.averageRating.toFixed(2)}</strong>
                  <small>{rating.ratingCount} rating{rating.ratingCount === 1 ? '' : 's'}</small>
                </td>
                <td>{rating.salary === null ? 'N/A' : money(rating.salary)}</td>
                <td>{rating.teamName ?? 'Undrafted'}</td>
                <td>
                  {rating.specs.length ? (
                    <div className={legendRatingSpecsClass}>
                      {rating.specs.map((spec) => (
                        <span key={`${rating.discordId}-${spec}`}>{spec}</span>
                      ))}
                    </div>
                  ) : (
                    <span className={legendMutedClass}>None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleRatings.length ? (
          <div className={legendRatingEmptyClass}>No players match the selected filters.</div>
        ) : null}
      </div>
    </section>
  )
}

function RatingSortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onToggle,
}: {
  label: string
  sortKey: RatingSortKey
  activeKey: RatingSortKey
  direction: SortDirection
  onToggle: (key: RatingSortKey) => void
}) {
  const active = activeKey === sortKey
  return (
    <button
      type="button"
      className={playersSortButtonClass(active)}
      onClick={() => onToggle(sortKey)}
    >
      {label}
      {active ? <span className={playersSortArrowClass}>{direction === 'asc' ? '▲' : '▼'}</span> : null}
    </button>
  )
}

function updateRatingSort(
  key: RatingSortKey,
  currentKey: RatingSortKey,
  currentDirection: SortDirection,
  setSortKey: (key: RatingSortKey) => void,
  setSortDirection: (direction: SortDirection) => void,
) {
  if (key === currentKey) {
    setSortDirection(currentDirection === 'asc' ? 'desc' : 'asc')
    return
  }

  setSortKey(key)
  setSortDirection(key === 'rating' || key === 'salary' ? 'desc' : 'asc')
}

function buildRatingTeamOptions(ratings: HistoricalEvent['playerRatings']) {
  return Array.from(
    new Set(
      ratings.map((rating) => rating.teamName ?? 'Undrafted'),
    ),
  ).sort((a, b) => {
    if (a === 'Undrafted') return 1
    if (b === 'Undrafted') return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
}

function buildRatingSpecOptions(ratings: HistoricalEvent['playerRatings']) {
  return Array.from(new Set(ratings.flatMap((rating) => rating.specs)))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function compareRatings(
  a: HistoricalEvent['playerRatings'][number],
  b: HistoricalEvent['playerRatings'][number],
  sortKey: RatingSortKey,
  direction: SortDirection,
) {
  const directionMultiplier = direction === 'asc' ? 1 : -1
  const nameComparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  let comparison = 0

  if (sortKey === 'name') {
    comparison = nameComparison
  } else if (sortKey === 'rating') {
    comparison = compareNullableNumbers(a.averageRating, b.averageRating, direction)
  } else if (sortKey === 'salary') {
    comparison = compareNullableNumbers(a.salary, b.salary, direction)
  } else {
    const aTeam = a.teamName ?? 'Undrafted'
    const bTeam = b.teamName ?? 'Undrafted'
    comparison = aTeam.localeCompare(bTeam, undefined, { sensitivity: 'base' })
  }

  return comparison ? (sortKey === 'rating' || sortKey === 'salary' ? comparison : comparison * directionMultiplier) : nameComparison
}

function compareNullableNumbers(a: number | null, b: number | null, direction: SortDirection) {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return direction === 'asc' ? a - b : b - a
}

function buildDraftProcessSteps(pick: HistoricalEvent['draftPicks'][number]) {
  const openedBy = pick.openedByTeam?.name ?? pick.team.name
  const steps = [
    {
      label: 'Opened',
      detail: `${openedBy} selected ${pick.player.name} for bidding.`,
    },
  ]

  if (pick.contestedByTeam) {
    steps.push({
      label: 'Contested',
      detail: pick.bonusSpent
        ? `${pick.contestedByTeam.name} forced the final cost to include ${money(pick.bonusSpent)} bonus.`
        : `${pick.contestedByTeam.name} contested, and budget reach resolved the pick without extra bonus.`,
    })
  } else {
    steps.push({
      label: 'Clear',
      detail: 'No opposing team contested the selection.',
    })
  }

  steps.push({
    label: 'Awarded',
    detail: `${pick.team.name} rostered ${pick.player.name} for ${money(pick.salary)} salary${
      pick.bonusSpent ? ` plus ${money(pick.bonusSpent)} bonus` : ''
    }.`,
  })

  return steps
}

function buildDraftReplayTeams(event: HistoricalEvent, throughOrder: number) {
  const picksByTeam = new Map<string, HistoricalEvent['draftPicks']>()

  for (const pick of event.draftPicks) {
    if (pick.order > throughOrder) continue
    const picks = picksByTeam.get(pick.team.id) ?? []
    picks.push(pick)
    picksByTeam.set(pick.team.id, picks)
  }

  return event.teams.map((team) => {
    const picks = picksByTeam.get(team.id) ?? []
    const salaryBudget = event.salaryPool / Math.max(1, event.teams.length)
    const bonusBudget = event.bonusPool / Math.max(1, event.teams.length)
    const salarySpent = picks.reduce((sum, pick) => sum + pick.salary, 0)
    const bonusSpent = picks.reduce((sum, pick) => sum + pick.bonusSpent, 0)
    const members = [
      ...(team.captainDiscordId
        ? [{
            discordId: team.captainDiscordId,
            name: team.captain ?? team.captainDiscordId,
            groupTag: team.memberProfiles.find((member) => member.discordId === team.captainDiscordId)?.groupTag,
            groupTagColor: team.memberProfiles.find((member) => member.discordId === team.captainDiscordId)?.groupTagColor,
            note: 'Captain',
          }]
        : []),
      ...picks.map((pick) => ({
        discordId: pick.player.discordId,
        name: pick.player.name,
        groupTag: pick.player.groupTag,
        groupTagColor: pick.player.groupTagColor,
        note: pick.bonusSpent ? `${money(pick.salary)} + ${money(pick.bonusSpent)}` : money(pick.salary),
      })),
    ]

    return {
      id: team.id,
      name: team.name,
      members,
      budgetRemaining: Math.max(0, salaryBudget - salarySpent),
      bonusRemaining: Math.max(0, bonusBudget - bonusSpent),
    }
  })
}
