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
      <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
          <h1>No active event</h1>
          <p>There is not currently an event selected for the HammaBowl homepage.</p>
        </section>
      </main>
    )
  }

  const ratings = calculatePlayerRatingSummaries(event)
  const matchStarted = event.rounds.length > 0

  return (
    <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
      <EventSummary event={event} initialNow={loadedAt} />
      {!matchStarted ? (
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)] ">
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <div>
              <h2>Signups</h2>
            </div>
          </div>
          {event.players.length ? (
            <PlayerTable rows={ratings} />
          ) : (
            <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">No accepted signups are available for this event yet.</div>
          )}
        </section>
      ) : null}
    </main>
  )
}
