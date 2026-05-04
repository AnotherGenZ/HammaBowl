import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ArrowLeft } from 'lucide-react'
import { HistoricalEventArchive } from '../components/HistoricalEventArchive'
import { shortDateWithTimeZone } from '../lib/format'
import { pageMeta } from '../lib/meta'

const loadHistoricalEventArchive = createServerFn({ method: 'GET' })
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const { getHistoricalEvent } = await import('../lib/db.server')
    return {
      event: await getHistoricalEvent(data.eventId),
    }
  })

export const Route = createFileRoute('/hall-of-legends_/$eventId_/archive')({
  loader: ({ params }) => loadHistoricalEventArchive({ data: { eventId: params.eventId } }),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData?.event ? `${loaderData.event.name} Archive` : 'Historical Event Archive',
      description: loaderData?.event
        ? `${loaderData.event.name} draft replay and player ratings archive.`
        : 'Historical HammaBowl event draft replay and player ratings archive.',
      path: loaderData?.event
        ? `/hall-of-legends/${loaderData.event.id}/archive`
        : '/hall-of-legends',
    }),
  component: HistoricalEventArchivePage,
})

function HistoricalEventArchivePage() {
  const { event } = Route.useLoaderData()

  if (!event) {
    return (
      <main>
        <section className="panel empty-state">
          <h1>Archive not found</h1>
          <Link to="/hall-of-legends" className="pill">
            Back to Hall of Legends
          </Link>
        </section>
      </main>
    )
  }

  const rateableRatingCount = event.playerRatings.filter(
    (rating) => !rating.isCaptain && !rating.disqualified,
  ).length

  return (
    <main className="legend-detail-main">
      <section className="event-hero compact-hero">
        <div>
          <Link
            to="/hall-of-legends/$eventId"
            params={{ eventId: event.id }}
            className="legend-back-link"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to event</span>
          </Link>
          <p className="eyebrow">Event archive</p>
          <h1>{event.name}</h1>
          <div className="meta-row">
            <span>{shortDateWithTimeZone(event.date)}</span>
            <span>{event.draftPicks.length} draft pick{event.draftPicks.length === 1 ? '' : 's'}</span>
            <span>{rateableRatingCount} rated participant{rateableRatingCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      <HistoricalEventArchive event={event} />
    </main>
  )
}
