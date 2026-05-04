import { Link } from '@tanstack/react-router'
import { CalendarClock, Swords, UserCheck, type LucideIcon } from 'lucide-react'
import { money, shortDateWithTimeZone } from '../lib/format'
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
  const detailLinks = [
    ...(isComplete ? [] : event.eventLinks),
    ...(event.honuAlertId
      ? [{
          name: 'Honu alert',
          url: `https://wt.honu.pw/alert/${event.honuAlertId}`,
          icon: 'Siren',
        }]
      : []),
    ...event.teams.flatMap((team) =>
      team.honuReportUrl
        ? [{
            name: `${team.teamName} report`,
            url: team.honuReportUrl,
            icon: 'Users',
          }]
        : [],
    ),
  ]

  return (
    <section className="event-hero">
      <div>
        <p className="eyebrow">{isComplete ? 'Completed event' : 'Current event'}</p>
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
          {detailLinks.map((link) => (
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
        <div>
          <p className="event-section-label">Round progress</p>
          <RoundProgress event={event} />
        </div>
      ) : (
        <div className="stat-strip">
          <StatPill label="Salary pool" value={money(event.salaryPool)} accent />
          <StatPill label="Signups" value={event.players.length.toString()} />
          <StatPill label="Pending" value={event.pendingPlayerCount.toString()} />
          <StatPill label="Drafted" value={`${drafted}/${event.players.length}`} />
        </div>
      )}

      {isComplete ? null : ledgers.length ? (
        <div className="team-grid">
          {ledgers.map((ledger) => {
            const members = [
              ...(ledger.captainPlayer ? [{ player: ledger.captainPlayer, label: 'Captain' }] : []),
              ...ledger.picks.map((pick) => ({ player: pick.player, label: undefined })),
            ]
            return (
              <TeamPanel
                key={ledger.team.id}
                team={ledger.team}
                members={members}
                matchStarted={matchStarted}
                budget={ledger.budgetRemaining}
                bonusCap={ledger.bonusRemaining}
              />
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

type EventLedger = ReturnType<typeof buildTeamLedgers>[number]

/* ── Stat pill ───────────────────────────────────────────────── */

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`stat-pill${accent ? ' stat-pill-accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/* ── Team panel ──────────────────────────────────────────────── */

function TeamPanel({
  team,
  members,
  matchStarted,
  budget,
  bonusCap,
}: {
  team: HammaEvent['teams'][number]
  members: Array<{ player: { id: string; name: string }; label?: string }>
  matchStarted: boolean
  budget: number
  bonusCap: number
}) {
  const factionClass = team.faction ? `team-panel-${team.faction.toLowerCase()}` : ''

  return (
    <article className={`team-panel summary-team-panel ${factionClass}`}>
      <div className="summary-team-heading">
        {team.faction ? <span className={`team-faction-chip faction-${team.faction.toLowerCase()}`}>{team.faction}</span> : null}
        <h2>{team.teamName}</h2>
        {matchStarted ? <strong className="team-live-score">{team.score}</strong> : null}
      </div>
      {matchStarted ? (
        <div className="team-roster-grid">
          {members.map((member) => (
            <div key={member.player.id} className="team-roster-member">
              <Link to="/players/$discordId" params={{ discordId: member.player.id }}>
                {member.player.name}
              </Link>
              {member.label ? <small>{member.label}</small> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="team-budget-grid">
          <div className="team-budget-card">
            <span>Budget</span>
            <strong>{money(budget)}</strong>
          </div>
          <div className="team-budget-card">
            <span>Bonus cap</span>
            <strong>{money(bonusCap)}</strong>
          </div>
        </div>
      )}
    </article>
  )
}

/* ── Completed showcase ──────────────────────────────────────── */

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
          {ledger.team.score}–{losingScore}
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
            Defeated{' '}
            <strong>
              {event.teams.find((t) => t.id !== ledger.team.id)?.teamName ?? 'the opponent'}
            </strong>
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

/* ── Event time helpers ──────────────────────────────────────── */

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

/* ── Round progress ──────────────────────────────────────────── */

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
            {state === 'active' ? <span className="round-active-dot" /> : null}
          </div>
        )
      })}
    </div>
  )
}
