import { createFileRoute } from '@tanstack/react-router'
import { EventSummary } from '../components/EventSummary'
import { PlayerTable } from '../components/PlayerTable'
import { shortDate } from '../lib/format'
import { pageMeta } from '../lib/meta'
import { calculatePlayerRatingSummaries } from '../lib/rules'
import { getCurrentEvent, getSessionUser } from '../lib/services'
import { useRealtimeCurrentEvent } from '../lib/useRealtimeCurrentEvent'

export const Route = createFileRoute('/')({
  loader: async () => ({
    event: await getCurrentEvent(),
    user: await getSessionUser(),
    loadedAt: Date.now(),
  }),
  head: ({ loaderData }) => {
    const event = loaderData?.event
    if (!event) {
      return pageMeta({
        description:
          'HammaBowl event operations, ratings, drafts, standings, and stream overlay.',
      })
    }

    const signupSummary = `${event.players.length} accepted signup${
      event.players.length === 1 ? '' : 's'
    }`
    const closeSummary = event.closingTime
      ? ` Signups close ${shortDate(event.closingTime)}.`
      : ''

    return pageMeta({
      title: event.name,
      description: `${event.name} is scheduled for ${shortDate(
        event.startsAt,
      )} with ${signupSummary}.${closeSummary}`,
    })
  },
  component: Home,
})

function Home() {
  const { event: initialEvent, loadedAt } = Route.useLoaderData()
  const [event] = useRealtimeCurrentEvent(initialEvent)
  if (!event) {
    return (
      <main className="min-w-0">
        <section className="panel empty-state">
          <h1>No active event</h1>
          <p>There is not currently an event selected for the HammaBowl homepage.</p>
        </section>
      </main>
    )
  }

  const ratings = calculatePlayerRatingSummaries(event)
  const matchStarted = event.rounds.length > 0

  return (
    <main className="min-w-0">
      <EventSummary event={event} initialNow={loadedAt} />
      {!matchStarted ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Signups</h2>
            </div>
          </div>
          {event.players.length ? (
            <PlayerTable rows={ratings} />
          ) : (
            <div className="empty-inline">No accepted signups are available for this event yet.</div>
          )}
        </section>
      ) : null}
    </main>
  )
}
