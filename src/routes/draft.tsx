import { createFileRoute } from '@tanstack/react-router'
import { DraftBoard } from '../components/DraftBoard'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import { getCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/draft')({
  loader: () => getCurrentEvent(),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData ? `${loaderData.name} Draft` : 'Draft',
      description: loaderData
        ? `Draft board for ${loaderData.name} with captain budgets, bids, and team picks.`
        : 'HammaBowl draft board for captain budgets, bids, and team picks.',
      path: '/draft',
    }),
  component: Draft,
})

function Draft() {
  const event = Route.useLoaderData()
  const { user } = useSession()

  const canBid =
    user?.roles.includes('captain') || user?.roles.includes('admin')

  return (
    <main className="wide-page">
      {event ? (
        <DraftBoard
          event={event}
          canBid={Boolean(canBid)}
          canManageAll={Boolean(user?.roles.includes('admin'))}
          userId={user?.id}
        />
      ) : (
        <section className="panel empty-state">
          <h1>No current event</h1>
          <p>The draft will be available once Raid Helper has a current HammaBowl event.</p>
        </section>
      )}
    </main>
  )
}
