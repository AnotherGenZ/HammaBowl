import { createFileRoute } from '@tanstack/react-router'
import { pageMeta } from '../lib/meta'
import { getCurrentEvent } from '../lib/services'
import { useRealtimeCurrentEvent } from '../lib/useRealtimeCurrentEvent'

export const Route = createFileRoute('/overlay')({
  loader: () => getCurrentEvent(),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData ? `${loaderData.name} Overlay` : 'Overlay',
      description: loaderData
        ? `Stream overlay for ${loaderData.name}.`
        : 'HammaBowl stream overlay.',
      path: '/overlay',
      noIndex: true,
    }),
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
          {(event?.teams ?? []).map((captain) => (
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
