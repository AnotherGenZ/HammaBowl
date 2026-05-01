import { createFileRoute } from '@tanstack/react-router'
import { EventSummary } from '../components/EventSummary'
import { PlayerTable } from '../components/PlayerTable'
import { calculatePlayerSalaries } from '../lib/rules'
import { getCurrentEvent, getSessionUser } from '../lib/services'
import { useRealtimeCurrentEvent } from '../lib/useRealtimeCurrentEvent'

export const Route = createFileRoute('/')({
  loader: async () => ({
    event: await getCurrentEvent(),
    user: await getSessionUser(),
  }),
  component: Home,
})

function Home() {
  const { event: initialEvent, user } = Route.useLoaderData()
  const [event] = useRealtimeCurrentEvent(initialEvent)
  if (!event) {
    return (
      <main>
        <section className="panel empty-state">
          <h1>No current event</h1>
          <p>Raid Helper does not currently have an event available for HammaBowl.</p>
        </section>
      </main>
    )
  }

  const ratings = calculatePlayerSalaries(event)

  return (
    <main>
      <EventSummary event={event} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Current signups</h2>
          </div>
        </div>
        {event.players.length ? (
          <PlayerTable rows={ratings} />
        ) : (
          <div className="empty-inline">No accepted signups are available for this event yet.</div>
        )}
      </section>
    </main>
  )
}
