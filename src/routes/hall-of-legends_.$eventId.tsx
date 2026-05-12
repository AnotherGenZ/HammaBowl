import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { EventLinkIcon } from '../components/EventLinkIcons'
import { PlayerName } from '../components/PlayerName'
import { shortDateWithTimeZone } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { HistoricalEvent } from '../lib/types'
import {
  legendArchiveLinkPanelClass,
  legendBackLinkClass,
  legendDetailHeroClass,
  legendDetailMainClass,
  legendDetailScoreListClass,
  legendDetailScorePanelClass,
  legendDetailTrophyClass,
  legendRosterHeadingClass,
  legendRosterListClass,
  legendRosterMatchupClass,
  legendRosterPanelClass,
  legendRoundHistoryClass,
  legendRoundNodeClass,
  legendRoundTrackClass,
  legendTeamReportLinkClass,
  legendTeamRosterBlockClass,
  lorePanelClass,
} from '../lib/ui'
import { useDisplayTimeZone } from '../lib/useDisplayTimeZone'

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
  const displayTimeZone = useDisplayTimeZone()

  if (!event) {
    return (
    <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
          <h1>Event not found</h1>
          <Link to="/hall-of-legends" className="inline-flex min-h-9 w-fit max-w-full items-center rounded-full border border-white/[0.08] bg-white/[0.08] px-3 text-[#cbd5d3] transition-colors hover:bg-white/[0.12] hover:text-[#fff7e6]">
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
    <main className={legendDetailMainClass}>
      <section className={legendDetailHeroClass}>
        <div>
          <Link to="/hall-of-legends" className={legendBackLinkClass}>
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to Hall of Legends</span>
          </Link>
          <h1>{event.name}</h1>
          <div className="meta-row mt-[18px] flex flex-wrap items-center gap-2.5 [&_a]:rounded-full [&_a]:border [&_a]:border-[#e4b45e]/40 [&_a]:bg-white/[0.08] [&_a]:px-3 [&_a]:py-2 [&_a]:font-black [&_a]:text-[#f4d59a] [&_a]:transition-colors [&_a:hover]:bg-[#e4b45e]/[0.20] [&_span]:rounded-full [&_span]:border [&_span]:border-white/[0.08] [&_span]:bg-white/[0.08] [&_span]:px-3 [&_span]:py-2 [&_span]:text-[#d8dedc] max-[1023px]:max-w-full max-[720px]:[&_a]:w-fit max-[720px]:[&_span]:w-fit">
            <span>{shortDateWithTimeZone(event.date, { timeZone: displayTimeZone })}</span>
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
                className="honu-alert-badge !border-white/[0.08] !bg-white/[0.08] !font-normal !text-[#d8dedc] hover:!bg-white/[0.12] hover:!text-[#f4f0e8]"
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
        <section className={lorePanelClass}>
          <span>Lore</span>
          <p>{event.lore}</p>
        </section>
      ) : null}

      <section className={legendDetailScorePanelClass} aria-label={`${event.name} final scores`}>
        <div>
          <span>Final scores</span>
          <h2>{event.teams.map((team) => team.score).join(' - ')}</h2>
        </div>
        <div className={legendDetailScoreListClass}>
          {event.teams.map((team) => (
            <div className={team.winner ? 'winner' : undefined} key={team.id}>
              <span>{team.name}</span>
              <strong>{team.score}</strong>
            </div>
          ))}
        </div>
      </section>

      {event.rounds.length ? (
        <section className={legendRoundHistoryClass}>
          <h2>Rounds</h2>
          <div className={legendRoundTrackClass} aria-label={`${event.name} round score progression`}>
            {roundProgression.map((item) => (
              <article className={legendRoundNodeClass} key={item.round.roundNumber}>
                <span>Round {item.round.roundNumber}</span>
                <strong>{item.score}</strong>
                {item.round.resultNote ? <small>{item.round.resultNote}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={legendRosterMatchupClass} aria-label={`${event.name} rosters`}>
        {winningTeam ? (
          <LegendRoster team={winningTeam} title="Winning roster" variant="winner" />
        ) : (
          <article className={legendRosterPanelClass(true)}>
            <h2>Winning roster</h2>
            <p>No winning roster recorded.</p>
          </article>
        )}

        <article className={legendRosterPanelClass()}>
          <div className={legendRosterHeadingClass}>
            <span>Losing roster</span>
            <h2>{losingTeams.map((team) => team.name).join(' / ') || 'Opponent'}</h2>
          </div>
          {losingTeams.length ? (
            losingTeams.map((team) => (
              <div className={legendTeamRosterBlockClass} key={team.id}>
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

      <section className={legendArchiveLinkPanelClass}>
        <div>
          <span>Event archive</span>
          <h2>Draft replay and player ratings</h2>
        </div>
        <Link
          to="/hall-of-legends/$eventId/archive"
          params={{ eventId: event.id }}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e]/40 bg-[#e4b45e]/[0.10] px-3.5 font-extrabold text-[#f3d99d] transition-colors hover:border-[#f0c878]/70 hover:bg-[#e4b45e]/[0.20] disabled:cursor-not-allowed disabled:opacity-55"
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
    <div className={legendDetailTrophyClass(isBiolab)}>
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
    <article className={legendRosterPanelClass(variant === 'winner')}>
      <div className={legendRosterHeadingClass}>
        <span>{title}</span>
        <h2>{team.name}</h2>
      </div>
      <div className={legendTeamRosterBlockClass}>
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
      className={legendTeamReportLinkClass(compact)}
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
    <ul className={legendRosterListClass}>
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
