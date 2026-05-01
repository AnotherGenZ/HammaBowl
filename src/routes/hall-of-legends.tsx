import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { shortDate } from '../lib/format'
import { pageMeta } from '../lib/meta'

const loadHistoricalEvents = createServerFn({ method: 'GET' }).handler(async () => {
  const { getHistoricalEvents } = await import('../lib/db.server')
  return getHistoricalEvents()
})

export const Route = createFileRoute('/hall-of-legends')({
  loader: () => loadHistoricalEvents(),
  head: () =>
    pageMeta({
      title: 'Hall of Legends',
      description: 'Past HammaBowl events, teams, Twitch streams, VODs, and winners.',
      path: '/hall-of-legends',
    }),
  component: HallOfLegends,
})

function HallOfLegends() {
  const events = Route.useLoaderData()

  return (
    <main>
      <section className="event-hero compact-hero">
        <div>
          <h1>Hall of Legends</h1>
          <div className="meta-row">
            <span>{events.length} completed event{events.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      {events.length ? (
        <section className="history-list">
          {events.map((event) => (
            <article className="history-card" key={event.id}>
              <div className="history-card-header">
                <div>
                  <time dateTime={event.date}>{shortDate(event.date)}</time>
                  <h2>
                    <Link to="/hall-of-legends/$eventId" params={{ eventId: event.id }}>
                      {event.name}
                    </Link>
                  </h2>
                </div>
              </div>

              {event.lore ? (
                <div className="history-lore">
                  <span>Lore</span>
                  <p>{event.lore}</p>
                </div>
              ) : null}

              <div className="history-team-list">
                {event.teams.map((team) => (
                  <span
                    aria-label={team.winner ? `${team.name}, event winner` : team.name}
                    className={team.winner ? 'winner' : undefined}
                    key={team.id}
                  >
                    {team.name}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>No completed events yet</h2>
          <p>Completed HammaBowl events will appear here after admins record a winner.</p>
        </section>
      )}
    </main>
  )
}
