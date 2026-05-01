import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser, requireAdminSession } from '../lib/discord.server'
import { bumpDraftBid, cancelActiveDraftBid, forfeitDraftBid, getDbEvent, openDraftBid } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { nextDraftSide } from '../lib/rules'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/draft/bid')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })
        if (!user.roles.includes('captain') && !user.roles.includes('admin')) {
          throw new Response('Captain Discord role required', { status: 403 })
        }

        const event = await requireCurrentEvent()
        const body = await request.json()
        const action = String(body.action ?? 'open')
        const teamId = String(body.teamId ?? '')
        const team = event.captains.find((captain) => captain.id === teamId)
        const isAdmin = user.roles.includes('admin')

        if (!team) throw new Response('Team not found', { status: 404 })
        if (!isAdmin && team.playerId !== user.id) {
          throw new Response('You can only bid for your assigned team.', { status: 403 })
        }
        if (action === 'open' && nextDraftSide(event)?.captain.id !== teamId) {
          throw new Response("It is not your team's pick turn.", { status: 403 })
        }

        let message = 'Bid updated.'
        if (action === 'open') {
          const result = await openDraftBid(event, teamId, String(body.playerDiscordId ?? ''))
          message = `${result.team} opened bidding on ${result.player}.`
        } else if (action === 'bump') {
          const result = await bumpDraftBid(event, String(body.bidId ?? ''), teamId)
          message = `${result.team} raised the bid on ${result.player}.`
        } else if (action === 'forfeit') {
          const result = await forfeitDraftBid(event, String(body.bidId ?? ''), teamId)
          message = `${result.player} added to ${result.team}.`
        } else {
          throw new Response('Unknown bid action', { status: 400 })
        }

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, `draft.bid.${action}`)

        return Response.json({ ok: true, message, event: updated })
      },
      DELETE: async () => {
        await requireAdminSession()
        const event = await requireCurrentEvent()

        await cancelActiveDraftBid(event.id)
        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'draft.bid.cancelled')

        return Response.json({ ok: true, message: 'Active bid cancelled.', event: updated })
      },
    },
  },
  component: () => null,
})
