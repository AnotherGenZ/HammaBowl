import { createFileRoute } from '@tanstack/react-router'
import { getCurrentEvent } from '../lib/services'
import { useRealtimeCurrentEvent } from '../lib/useRealtimeCurrentEvent'

export const Route = createFileRoute('/overlay')({
  loader: () => getCurrentEvent(),
  component: Overlay,
})

function Overlay() {
  const initialEvent = Route.useLoaderData()
  const [event] = useRealtimeCurrentEvent(initialEvent)

  return (
    <main className="overlay-page">
      <section className="overlay">
        <div>
          <p>{event?.name ?? 'No current event'}</p>
          <h1>HammaBowl</h1>
        </div>
        <div className="overlay-score">
          {(event?.captains ?? []).map((captain) => (
            <article key={captain.id}>
              <span>{captain.teamName}</span>
              <strong>{captain.score}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
