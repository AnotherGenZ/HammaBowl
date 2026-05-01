import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { shortDate } from '../lib/format'
import { pageMeta } from '../lib/meta'

const loadHistoricalEvent = createServerFn({ method: 'GET' })
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const { getHistoricalEvent } = await import('../lib/db.server')
    return getHistoricalEvent(data.eventId)
  })

export const Route = createFileRoute('/hall-of-legends_/$eventId')({
  loader: ({ params }) => loadHistoricalEvent({ data: { eventId: params.eventId } }),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData?.name ?? 'Historical Event',
      description: loaderData
        ? `${loaderData.name} results, teams, VODs, and lore.`
        : 'Historical HammaBowl event.',
      path: loaderData ? `/hall-of-legends/${loaderData.id}` : '/hall-of-legends',
    }),
  component: HistoricalEventPage,
})

function HistoricalEventPage() {
  const event = Route.useLoaderData()

  if (!event) {
    return (
      <main>
        <section className="panel empty-state">
          <h1>Event not found</h1>
        </section>
      </main>
    )
  }

  return (
    <main>
      <section className="event-hero compact-hero">
        <div>
          <h1>{event.name}</h1>
          <div className="meta-row">
            <span>{shortDate(event.date)}</span>
            <span>{event.server}</span>
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
        </div>
      </section>

      {event.lore ? (
        <section className="lore-panel">
          <span>Lore</span>
          <p>{event.lore}</p>
        </section>
      ) : null}

      <section className="history-team-grid event-detail-teams">
        {event.teams.map((team) => (
          <article className={`history-team${team.winner ? ' winner' : ''}`} key={team.id}>
            <div className="history-team-title">
              <h2>{team.name}</h2>
              <div className="history-team-meta">
                {team.winner ? <span>Winner</span> : null}
                <strong className="score">{team.score}</strong>
              </div>
            </div>
            {team.captain ? <p>Captain: {team.captain}</p> : null}
            <p className="member-line">{team.members.length ? team.members.join(', ') : 'No members recorded.'}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
