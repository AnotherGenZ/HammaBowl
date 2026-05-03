import { Link } from '@tanstack/react-router'
import { CalendarClock, Swords, UserCheck, type LucideIcon } from 'lucide-react'
import { money, percent, shortDateWithTimeZone } from '../lib/format'
import { buildTeamLedgers } from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import { Countdown } from './Countdown'
import { EventLinkIcon } from './EventLinkIcons'

export function EventSummary({ event }: { event: HammaEvent }) {
  const ledgers = buildTeamLedgers(event)
  const drafted = event.draftPicks.length
  const latestRound = [...event.rounds].sort((a, b) => b.roundNumber - a.roundNumber)[0]
  const matchStarted = Boolean(latestRound)
  const completedLedger = event.winningTeamId
    ? ledgers.find((ledger) => ledger.team.id === event.winningTeamId)
    : undefined
  const isComplete = event.phase === 'complete' && Boolean(completedLedger)
  const eventTimes = buildEventTimes(event)
  const visibleEventTimes = isComplete
    ? eventTimes.filter((item) => item.label === 'Event start')
    : eventTimes

  return (
    <section className="event-hero">
      <div>
        <h1>{event.name}</h1>
        {event.eventDescription ? (
          <p className="event-description">{event.eventDescription}</p>
        ) : null}
        <div className="event-link-badges" aria-label="Event details and links">
          {visibleEventTimes.map((item) => {
            const Icon = item.icon
            const formattedTime = shortDateWithTimeZone(item.time)

            return (
              <span
                className={`event-time-badge ${item.className}`}
                key={item.label}
                title={`${item.label}: ${formattedTime}`}
                aria-label={`${item.label}: ${formattedTime}`}
              >
                <Icon size={16} aria-hidden="true" />
                <strong>{formattedTime}</strong>
              </span>
            )
          })}
          {isComplete
            ? null
            : event.eventLinks.map((link) => (
                <a key={`${link.url}-${link.name}`} href={link.url} target="_blank" rel="noreferrer">
                  <EventLinkIcon name={link.icon} />
                  <span>{link.name}</span>
                </a>
              ))}
        </div>
        {!isComplete && (event.twitchStreamUrl || event.twitchVodUrl) ? (
          <div className="meta-row">
            {event.twitchStreamUrl ? (
              <a href={event.twitchStreamUrl} target="_blank" rel="noreferrer">
                Stream
              </a>
            ) : null}
            {event.twitchVodUrl ? (
              <a href={event.twitchVodUrl} target="_blank" rel="noreferrer">
                VOD
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      {isComplete && completedLedger ? (
        <CompletedEventShowcase event={event} ledger={completedLedger} />
      ) : (
        <Countdown
          closingTime={event.closingTime}
          startsAt={event.startsAt}
          draftStartMinutesBefore={event.draftStartMinutesBefore}
          roundStartedAt={latestRound?.startedAt}
          roundDurationSeconds={latestRound?.durationSeconds}
          roundNumber={latestRound?.roundNumber}
        />
      )}
      {isComplete ? null : matchStarted ? (
        <RoundProgress event={event} />
      ) : (
        <div className="stat-strip">
          <Metric label="Salary pool" value={money(event.salaryPool)} />
          <Metric label="Signups" value={event.players.length.toString()} />
          <Metric label="Pending Players" value={event.pendingPlayerCount.toString()} />
          <Metric label="Drafted" value={`${drafted}/${event.players.length}`} />
        </div>
      )}
      {isComplete ? null : ledgers.length ? (
        <div className={`team-grid${matchStarted ? ' live-team-grid' : ''}`}>
          {ledgers.map((ledger) => {
            const memberCount = ledger.picks.length + (ledger.captainPlayer ? 1 : 0)
            const members = [
              ...(ledger.captainPlayer ? [{ player: ledger.captainPlayer, label: 'Captain' }] : []),
              ...ledger.picks.map((pick) => ({ player: pick.player, label: undefined })),
            ]
            return (
          <article className="team-panel summary-team-panel" key={ledger.team.id}>
            <div className="summary-team-heading">
              <h2>{ledger.team.teamName}</h2>
              {matchStarted ? <strong className="score">{ledger.team.score}</strong> : null}
            </div>
            {matchStarted ? (
              <ul className="public-team-roster">
                {members.map((member) => (
                  <li key={member.player.id}>
                    <Link to="/players/$discordId" params={{ discordId: member.player.id }}>
                      {member.player.name}
                    </Link>
                    {member.label ? <small>{member.label}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <dl>
                <div>
                  <dt>Members</dt>
                  <dd>{memberCount}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>{money(ledger.budgetRemaining)}</dd>
                </div>
                <div>
                  <dt>Bonus cap</dt>
                  <dd>{money(ledger.bonusRemaining)}</dd>
                </div>
                <div>
                  <dt>Committed</dt>
                  <dd>{percent(ledger.salarySpent / ledger.team.budget)}</dd>
                </div>
              </dl>
            )}
          </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

type EventLedger = ReturnType<typeof buildTeamLedgers>[number]

function CompletedEventShowcase({ event, ledger }: { event: HammaEvent; ledger: EventLedger }) {
  const losingScore = Math.max(
    0,
    ...event.teams.filter((team) => team.id !== ledger.team.id).map((team) => team.score),
  )
  const members = [
    ...(ledger.captainPlayer ? [{ player: ledger.captainPlayer, label: 'Leader' }] : []),
    ...ledger.picks.map((pick) => ({ player: pick.player, label: undefined })),
  ]

  return (
    <div className="completed-event-showcase">
      <div className="completed-score">
        <span>Final score</span>
        <strong>
          {ledger.team.score}-{losingScore}
        </strong>
      </div>
      <div className="trophy-stage" aria-hidden="true">
        <span className="confetti confetti-1" />
        <span className="confetti confetti-2" />
        <span className="confetti confetti-3" />
        <span className="confetti confetti-4" />
        <span className="confetti confetti-5" />
        <span className="confetti confetti-6" />
        <EventTrophy event={event} />
      </div>
      <div className="winner-details">
        <span>Event winner</span>
        <h2>{ledger.team.teamName}</h2>
        {ledger.captainPlayer ? (
          <p>
            Led by <strong>{ledger.captainPlayer.name}</strong>
          </p>
        ) : null}
      </div>
      <ul className="winner-roster" aria-label={`${ledger.team.teamName} roster`}>
        {members.map((member) => (
          <li key={member.player.id}>
            <Link to="/players/$discordId" params={{ discordId: member.player.id }}>
              {member.player.name}
            </Link>
            {member.label ? <small>{member.label}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function EventTrophy({ event }: { event: HammaEvent }) {
  if (event.trophyId === 'hamma-dome-biolab') {
    return <HammaDomeBiolabTrophy />
  }

  return <HammoBowlTrophy />
}

function HammaDomeBiolabTrophy() {
  return (
    <div className="winner-trophy biolab-trophy">
      <img
        className="biolab-trophy-image"
        src="/trophies/hamma-dome-i.png"
        alt="Hamma Dome I champion trophy"
      />
    </div>
  )
}

function HammoBowlTrophy() {
  return (
    <div className="winner-trophy hamma-bowl-trophy">
      <img
        className="hamma-bowl-trophy-image"
        src="/trophies/hamma-bowl.png"
        alt="Hamma Bowl champion trophy"
      />
    </div>
  )
}

type EventTime = {
  label: string
  time: string
  className: string
  icon: LucideIcon
}

function buildEventTimes(event: HammaEvent) {
  const times: EventTime[] = []

  if (event.closingTime) {
    times.push({
      label: 'Signups close',
      time: event.closingTime,
      className: 'event-time-badge-signups',
      icon: UserCheck,
    })
  }

  if (typeof event.draftStartMinutesBefore === 'number') {
    const startTime = Date.parse(event.startsAt)

    if (Number.isFinite(startTime)) {
      times.push({
        label: 'Draft start',
        time: new Date(startTime - event.draftStartMinutesBefore * 60_000).toISOString(),
        className: 'event-time-badge-draft',
        icon: Swords,
      })
    }
  }

  times.push({
    label: 'Event start',
    time: event.startsAt,
    className: 'event-time-badge-start',
    icon: CalendarClock,
  })

  return times
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RoundProgress({ event }: { event: HammaEvent }) {
  const teamsById = new Map(event.teams.map((team) => [team.id, team]))
  const roundsByNumber = new Map(event.rounds.map((round) => [round.roundNumber, round]))
  const roundCount = Math.max(1, event.roundCount)

  return (
    <div
      className="round-progress"
      style={{ gridTemplateColumns: `repeat(${roundCount}, minmax(140px, 1fr))` }}
      aria-label="Round progress"
    >
      {Array.from({ length: roundCount }, (_, index) => {
        const roundNumber = index + 1
        const round = roundsByNumber.get(roundNumber)
        const winner = round?.winningTeamId ? teamsById.get(round.winningTeamId) : undefined
        const state = winner ? 'complete' : round ? 'active' : 'future'
        const factionClass = winner?.faction ? ` round-segment-${winner.faction.toLowerCase()}` : ''

        return (
          <div className={`round-segment round-segment-${state}${factionClass}`} key={roundNumber}>
            <span>Round {roundNumber}</span>
            <strong>{winner?.teamName ?? (state === 'active' ? 'In progress' : 'Upcoming')}</strong>
          </div>
        )
      })}
    </div>
  )
}
