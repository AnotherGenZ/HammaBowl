import { createFileRoute } from '@tanstack/react-router'
import { DraftBoard } from '../components/DraftBoard'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import { getCurrentEvent } from '../lib/services'

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
    <main className="wide-page draft-page min-w-0">
      {event ? (
        <DraftBoard
          event={event}
          canBid={Boolean(canBid)}
          canManageAll={Boolean(user?.roles.includes('admin'))}
          userId={user?.id}
          initialNow={loadedAt}
        />
      ) : (
        <section className="panel empty-state">
          <h1>No current event</h1>
          <p>The draft will be available once an active HammaBowl event is selected.</p>
        </section>
      )}
    </main>
  )
}
