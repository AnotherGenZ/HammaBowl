import { createFileRoute } from '@tanstack/react-router'
import { DraftBoard } from '../components/DraftBoard'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import { getCurrentEvent } from '../lib/services'
import { draftMainClass } from '../lib/ui'

export const Route = createFileRoute('/draft')({
  loader: async () => ({
    event: await getCurrentEvent(),
    loadedAt: Date.now(),
  }),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData?.event ? `${loaderData.event.name} Draft` : 'Draft',
      description: loaderData?.event
        ? `Draft board for ${loaderData.event.name} with captain budgets, bids, and team picks.`
        : 'HammaBowl draft board for captain budgets, bids, and team picks.',
      path: '/draft',
    }),
  component: Draft,
})

function Draft() {
  const { event, loadedAt } = Route.useLoaderData()
  const { user } = useSession()

  const canBid = Boolean(user)

  return (
    <main className={draftMainClass}>
      {event ? (
        <DraftBoard
          event={event}
          canBid={Boolean(canBid)}
          canManageAll={Boolean(user?.roles.includes('admin'))}
          userId={user?.id}
          initialNow={loadedAt}
        />
      ) : (
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
          <h1>No current event</h1>
          <p>The draft will be available once an active HammaBowl event is selected.</p>
        </section>
      )}
    </main>
  )
}
