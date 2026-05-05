import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { EventLinkIcon } from '../components/EventLinkIcons'
import { PlayerName } from '../components/PlayerName'
import { shortDateWithTimeZone } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { HistoricalEvent } from '../lib/types'

const loadHistoricalEvent = createServerFn({ method: 'GET' })
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const { getHistoricalEvent } = await import('../lib/db.server')
    return {
      event: await getHistoricalEvent(data.eventId),
    }
  })

export const Route = createFileRoute('/hall-of-legends_/$eventId')({
  loader: ({ params }) => loadHistoricalEvent({ data: { eventId: params.eventId } }),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData?.event?.name ?? 'Historical Event',
      description: loaderData?.event
        ? `${loaderData.event.name} results, teams, VODs, and lore.`
        : 'Historical HammaBowl event.',
      path: loaderData?.event ? `/hall-of-legends/${loaderData.event.id}` : '/hall-of-legends',
    }),
  component: HistoricalEventPage,
})

function HistoricalEventPage() {
  const { event } = Route.useLoaderData()

  if (!event) {
    return (
      <main>
        <section className="panel empty-state">
          <h1>Event not found</h1>
          <Link to="/hall-of-legends" className="pill">
            Back to Hall of Legends
          </Link>
        </section>
      </main>
    )
  }

  const winningTeam = event.teams.find((team) => team.winner)
  const losingTeams = event.teams.filter((team) => !team.winner)
  const roundProgression = buildRoundProgression(event)

  return (
    <main className="legend-detail-main">
      <section className="event-hero compact-hero legend-detail-hero">
        <div>
          <Link to="/hall-of-legends" className="legend-back-link">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to Hall of Legends</span>
          </Link>
          <h1>{event.name}</h1>
          <div className="meta-row">
            <span>{shortDateWithTimeZone(event.date)}</span>
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
            {event.honuAlertId ? (
              <a
                className="honu-alert-badge"
                href={`https://wt.honu.pw/alert/${event.honuAlertId}`}
                target="_blank"
                rel="noreferrer"
              >
                <EventLinkIcon name="Siren" />
                Alert
              </a>
            ) : null}
          </div>
        </div>
        <LegendDetailTrophy event={event} />
      </section>

      {event.lore ? (
        <section className="lore-panel">
          <span>Lore</span>
          <p>{event.lore}</p>
        </section>
      ) : null}

      <section className="legend-detail-score-panel" aria-label={`${event.name} final scores`}>
        <div>
          <span>Final scores</span>
          <h2>{event.teams.map((team) => team.score).join(' - ')}</h2>
        </div>
        <div className="legend-detail-score-list">
          {event.teams.map((team) => (
            <div className={team.winner ? 'winner' : undefined} key={team.id}>
              <span>{team.name}</span>
              <strong>{team.score}</strong>
            </div>
          ))}
        </div>
      </section>

      {event.rounds.length ? (
        <section className="legend-round-history">
          <h2>Rounds</h2>
          <div className="legend-round-track" aria-label={`${event.name} round score progression`}>
            {roundProgression.map((item) => (
              <article className="legend-round-node" key={item.round.roundNumber}>
                <span>Round {item.round.roundNumber}</span>
                <strong>{item.score}</strong>
                {item.round.resultNote ? <small>{item.round.resultNote}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="legend-roster-matchup" aria-label={`${event.name} rosters`}>
        {winningTeam ? (
          <LegendRoster team={winningTeam} title="Winning roster" variant="winner" />
        ) : (
          <article className="legend-roster-panel winner">
            <h2>Winning roster</h2>
            <p>No winning roster recorded.</p>
          </article>
        )}

        <article className="legend-roster-panel">
          <div className="legend-roster-heading">
            <span>Losing roster</span>
            <h2>{losingTeams.map((team) => team.name).join(' / ') || 'Opponent'}</h2>
          </div>
          {losingTeams.length ? (
            losingTeams.map((team) => (
              <div className="legend-team-roster-block" key={team.id}>
                {losingTeams.length > 1 ? <h3>{team.name}</h3> : null}
                <LegendTeamReportLink team={team} />
                <LegendRosterList team={team} />
              </div>
            ))
          ) : (
            <p>No losing roster recorded.</p>
          )}
        </article>
      </section>

      <section className="legend-archive-link-panel">
        <div>
          <span>Event archive</span>
          <h2>Draft replay and player ratings</h2>
        </div>
        <Link
          to="/hall-of-legends/$eventId/archive"
          params={{ eventId: event.id }}
          className="button-link secondary"
        >
          <BookOpen size={16} aria-hidden="true" />
          Open archive
        </Link>
      </section>
    </main>
  )
}

function LegendDetailTrophy({ event }: { event: Pick<HistoricalEvent, 'name' | 'trophyId'> }) {
  const isBiolab = event.trophyId === 'hamma-dome-biolab'

  return (
    <div className={`legend-detail-trophy ${isBiolab ? 'legend-detail-trophy-biolab' : ''}`}>
      <img
        src={isBiolab ? '/trophies/hamma-dome-i.png' : '/trophies/hamma-bowl.png'}
        alt={`${event.name} trophy`}
      />
    </div>
  )
}

function LegendRoster({
  team,
  title,
  variant,
}: {
  team: HistoricalEvent['teams'][number]
  title: string
  variant?: 'winner'
}) {
  return (
    <article className={`legend-roster-panel${variant === 'winner' ? ' winner' : ''}`}>
      <div className="legend-roster-heading">
        <span>{title}</span>
        <h2>{team.name}</h2>
      </div>
      <div className="legend-team-roster-block">
        <LegendTeamReportLink team={team} />
        <LegendRosterList team={team} />
      </div>
    </article>
  )
}

function LegendTeamReportLink({
  team,
  compact = false,
}: {
  team: HistoricalEvent['teams'][number]
  compact?: boolean
}) {
  if (!team.honuReportUrl) return null

  return (
    <a
      className={compact ? 'legend-team-report-link compact' : 'legend-team-report-link'}
      href={team.honuReportUrl}
      target="_blank"
      rel="noreferrer"
    >
      <EventLinkIcon name="ChartColumnIncreasingIcon" />
      <span>Report</span>
    </a>
  )
}

function LegendRosterList({ team }: { team: HistoricalEvent['teams'][number] }) {
  if (!team.memberProfiles.length) {
    return <p>No members recorded.</p>
  }

  const members = [...team.memberProfiles].sort((a, b) => {
    if (a.discordId === team.captainDiscordId) return -1
    if (b.discordId === team.captainDiscordId) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <ul className="legend-roster-list">
      {members.map((member) => (
        <li key={`${team.id}-${member.discordId}`}>
          <Link to="/players/$discordId" params={{ discordId: member.discordId }}>
            <PlayerName name={member.name} groupTag={member.groupTag} groupTagColor={member.groupTagColor} />
          </Link>
          {member.discordId === team.captainDiscordId ? <small>Captain</small> : null}
        </li>
      ))}
    </ul>
  )
}

function buildRoundProgression(event: HistoricalEvent) {
  const scores = new Map(event.teams.map((team) => [team.id, 0]))

  return event.rounds.map((round) => {
    for (const team of event.teams) {
      scores.set(team.id, (scores.get(team.id) ?? 0) + (round.teamScores[team.id] ?? 0))
    }

    return {
      round,
      score: event.teams
        .map((team) => {
          const gained = round.teamScores[team.id] ?? 0
          return `${scores.get(team.id) ?? 0} (+${gained})`
        })
        .join(' - '),
    }
  })
}
