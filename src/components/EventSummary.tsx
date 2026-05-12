import { Link } from '@tanstack/react-router'
import { CalendarClock, Swords, UserCheck, type LucideIcon } from 'lucide-react'
import { money, shortDateWithTimeZone } from '../lib/format'
import { buildTeamLedgers } from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import {
  eventDescriptionClass,
  eventHeroClass,
  eventLinkBadgesClass,
  eventSectionLabelClass,
  eventTimeBadgeClass,
  eyebrowClass,
  completedEventShowcaseClass,
  completedScoreClass,
  confettiClass,
  roundActiveDotClass,
  roundProgressClass,
  roundSegmentClass,
  statPillClass,
  summaryTeamHeadingClass,
  summaryTeamPanelWithFactionClass,
  teamFactionChipClass,
  teamBudgetCardClass,
  teamBudgetGridClass,
  teamGridClass,
  teamLiveScoreClass,
  teamRosterGridClass,
  teamRosterMemberClass,
  trophyImageClass,
  trophyStageClass,
  winnerDetailsClass,
  winnerRosterClass,
  winnerTrophyClass,
} from '../lib/ui'
import { useDisplayTimeZone } from '../lib/useDisplayTimeZone'
import { Countdown } from './Countdown'
import { EventLinkIcon } from './EventLinkIcons'
import { PlayerName } from './PlayerName'

export function EventSummary({ event, initialNow }: { event: HammaEvent; initialNow?: number }) {
  const displayTimeZone = useDisplayTimeZone()
  const ledgers = buildTeamLedgers(event)
  const drafted = ledgers.reduce((sum, ledger) => sum + ledger.picks.length, 0)
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
  const hasManualHonuReportLink = event.eventLinks.some((link) => isHonuReportUrl(link.url))
  const detailLinks = [
    ...event.eventLinks,
    ...(event.honuAlertId
      ? [{
          name: 'Honu alert',
          url: `https://wt.honu.pw/alert/${event.honuAlertId}`,
          icon: 'Siren',
        }]
      : []),
    ...event.teams.flatMap((team) =>
      !hasManualHonuReportLink && team.honuReportUrl
        ? [{
            name: `${team.teamName} report`,
            url: team.honuReportUrl,
            icon: 'Users',
          }]
        : [],
    ),
  ]

  return (
    <section className={eventHeroClass}>
      <div>
        <p className={eyebrowClass}>{isComplete ? 'Completed event' : 'Current event'}</p>
        <h1>{event.name}</h1>
        {event.eventDescription ? (
          <p className={eventDescriptionClass}>{event.eventDescription}</p>
        ) : null}
        <div className={eventLinkBadgesClass} aria-label="Event details and links">
          {visibleEventTimes.map((item) => {
            const Icon = item.icon
            const formattedTime = shortDateWithTimeZone(item.time, { timeZone: displayTimeZone })

            return (
              <span
                className={eventTimeBadgeClass(item.className)}
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
          <div className="meta-row mt-[18px] flex flex-wrap items-center gap-2.5 [&_a]:rounded-full [&_a]:border [&_a]:border-[#e4b45e]/40 [&_a]:bg-white/[0.08] [&_a]:px-3 [&_a]:py-2 [&_a]:font-black [&_a]:text-[#f4d59a] [&_a]:transition-colors [&_a:hover]:bg-[#e4b45e]/[0.20] [&_span]:rounded-full [&_span]:border [&_span]:border-white/[0.08] [&_span]:bg-white/[0.08] [&_span]:px-3 [&_span]:py-2 [&_span]:text-[#d8dedc] max-[1023px]:max-w-full max-[720px]:[&_a]:w-fit max-[720px]:[&_span]:w-fit">
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
          initialNow={initialNow}
        />
      )}

      {isComplete ? null : matchStarted ? (
        <div>
          <p className={eventSectionLabelClass}>Round progress</p>
          <RoundProgress event={event} />
        </div>
      ) : (
        <div className="stat-strip mt-[18px] grid grid-cols-4 gap-2.5 max-[860px]:grid-cols-2 max-[720px]:grid-cols-1">
          <StatPill label="Salary pool" value={money(event.salaryPool)} accent />
          <StatPill label="Signups" value={event.players.length.toString()} />
          <StatPill label="Pending" value={event.pendingPlayerCount.toString()} />
          <StatPill label="Drafted" value={`${drafted}/${event.players.length}`} />
        </div>
      )}

      {isComplete ? null : ledgers.length ? (
        <div className={teamGridClass}>
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

function isHonuReportUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === 'wt.honu.pw' && url.pathname.startsWith('/report/')
  } catch {
    return false
  }
}

type EventLedger = ReturnType<typeof buildTeamLedgers>[number]

/* ── Stat pill ───────────────────────────────────────────────── */

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={statPillClass(accent)}>
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
  members: Array<{ player: { id: string; name: string; groupTag?: string; groupTagColor?: string }; label?: string }>
  matchStarted: boolean
  budget: number
  bonusCap: number
}) {
  return (
    <article className={summaryTeamPanelWithFactionClass(team.faction)}>
      <div className={summaryTeamHeadingClass}>
        {team.faction ? <span className={teamFactionChipClass(team.faction)}>{team.faction}</span> : null}
        <h2>{team.teamName}</h2>
        {matchStarted ? <strong className={teamLiveScoreClass}>{team.score}</strong> : null}
      </div>
      {matchStarted ? (
        <div className={teamRosterGridClass}>
          {members.map((member) => (
            <div key={member.player.id} className={teamRosterMemberClass}>
              <Link to="/players/$discordId" params={{ discordId: member.player.id }}>
                <PlayerName
                  name={member.player.name}
                  groupTag={member.player.groupTag}
                  groupTagColor={member.player.groupTagColor}
                />
              </Link>
              {member.label ? <small>{member.label}</small> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={teamBudgetGridClass}>
          <div className={teamBudgetCardClass}>
            <span>Budget</span>
            <strong>{money(budget)}</strong>
          </div>
          <div className={teamBudgetCardClass}>
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
    <div className={completedEventShowcaseClass}>
      <div className={completedScoreClass}>
        <span>Final score</span>
        <strong>
          {ledger.team.score}–{losingScore}
        </strong>
      </div>
      <div className={trophyStageClass} aria-hidden="true">
        <span className={confettiClass(1)} />
        <span className={confettiClass(2)} />
        <span className={confettiClass(3)} />
        <span className={confettiClass(4)} />
        <span className={confettiClass(5)} />
        <span className={confettiClass(6)} />
        <EventTrophy event={event} />
      </div>
      <div className={winnerDetailsClass}>
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
      <ul className={winnerRosterClass} aria-label={`${ledger.team.teamName} roster`}>
        {members.map((member) => (
          <li key={member.player.id}>
            <Link to="/players/$discordId" params={{ discordId: member.player.id }}>
              <PlayerName
                name={member.player.name}
                groupTag={member.player.groupTag}
                groupTagColor={member.player.groupTagColor}
              />
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
    <div className={winnerTrophyClass('biolab')}>
      <img
        className={trophyImageClass}
        src="/trophies/hamma-dome-i.png"
        alt="Hamma Dome I champion trophy"
      />
    </div>
  )
}

function HammoBowlTrophy() {
  return (
    <div className={winnerTrophyClass('hamma-bowl')}>
      <img
        className={trophyImageClass}
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
      className={roundProgressClass}
      style={{ gridTemplateColumns: `repeat(${roundCount}, minmax(140px, 1fr))` }}
      aria-label="Round progress"
    >
      {Array.from({ length: roundCount }, (_, index) => {
        const roundNumber = index + 1
        const round = roundsByNumber.get(roundNumber)
        const leader = round?.winningTeamId ? teamsById.get(round.winningTeamId) : undefined
        const hasScores = Boolean(round && event.teams.some((team) => team.id in round.teamScores))
        const state = hasScores ? 'complete' : round ? 'active' : 'future'
        const faction = leader?.faction
        const label = round
          ? hasScores
            ? formatRoundScore(round, event.teams)
            : 'In progress'
          : 'Upcoming'

        return (
          <div className={roundSegmentClass(state, faction)} key={roundNumber}>
            <span>Round {roundNumber}</span>
            <strong>{label}</strong>
            {state === 'active' ? <span className={roundActiveDotClass} /> : null}
          </div>
        )
      })}
    </div>
  )
}

function formatRoundScore(round: HammaEvent['rounds'][number], teams: HammaEvent['teams']) {
  return teams.map((team) => round.teamScores[team.id] ?? 0).join('-')
}
