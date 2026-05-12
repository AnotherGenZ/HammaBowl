import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ArrowLeft } from 'lucide-react'
import { HistoricalEventArchive } from '../components/HistoricalEventArchive'
import { shortDateWithTimeZone } from '../lib/format'
import { pageMeta } from '../lib/meta'
import { eventHeroClass, eyebrowClass, legendBackLinkClass, legendDetailMainClass } from '../lib/ui'
import { useDisplayTimeZone } from '../lib/useDisplayTimeZone'

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
  const displayTimeZone = useDisplayTimeZone()

  if (!event) {
    return (
      <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
          <h1>Archive not found</h1>
          <Link to="/hall-of-legends" className="inline-flex min-h-9 w-fit max-w-full items-center rounded-full border border-white/[0.08] bg-white/[0.08] px-3 text-[#cbd5d3] transition-colors hover:bg-white/[0.12] hover:text-[#fff7e6]">
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
    <main className={legendDetailMainClass}>
      <section className={`${eventHeroClass} compact-hero`}>
        <div>
          <Link
            to="/hall-of-legends/$eventId"
            params={{ eventId: event.id }}
            className={legendBackLinkClass}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to event</span>
          </Link>
          <p className={eyebrowClass}>Event archive</p>
          <h1>{event.name}</h1>
          <div className="meta-row mt-[18px] flex flex-wrap items-center gap-2.5 [&_a]:rounded-full [&_a]:border [&_a]:border-[#e4b45e]/40 [&_a]:bg-white/[0.08] [&_a]:px-3 [&_a]:py-2 [&_a]:font-black [&_a]:text-[#f4d59a] [&_a]:transition-colors [&_a:hover]:bg-[#e4b45e]/[0.20] [&_span]:rounded-full [&_span]:border [&_span]:border-white/[0.08] [&_span]:bg-white/[0.08] [&_span]:px-3 [&_span]:py-2 [&_span]:text-[#d8dedc] max-[1023px]:max-w-full max-[720px]:[&_a]:w-fit max-[720px]:[&_span]:w-fit">
            <span>{shortDateWithTimeZone(event.date, { timeZone: displayTimeZone })}</span>
            <span>{event.draftPicks.length} draft pick{event.draftPicks.length === 1 ? '' : 's'}</span>
            <span>{rateableRatingCount} rated participant{rateableRatingCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      <HistoricalEventArchive event={event} />
    </main>
  )
}
