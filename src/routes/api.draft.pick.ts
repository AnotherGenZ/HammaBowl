import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser, requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'
import { getDbEvent, pickDraftPlayer, resetDraftPick } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { nextDraftSide } from '../lib/rules'

export const Route = createFileRoute('/api/draft/pick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })
        const event = await requireCurrentEvent()
        const body = await request.json()
        const teamId = String(body.teamId ?? '')
        const team = event.teams.find((captain) => captain.id === teamId)

        if (!team) throw new Response('Team not found', { status: 404 })
        if (team.captainDiscordId !== user.id) {
          throw new Response('You can only pick for your assigned team.', { status: 403 })
        }
        if (nextDraftSide(event)?.team.id !== teamId) {
          throw new Response("It is not your team's pick turn.", { status: 403 })
        }

        const result = await pickDraftPlayer(
          event,
          teamId,
          String(body.playerDiscordId ?? ''),
        )

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'draft.pick.selected')

        return Response.json({
          ok: true,
          message: 'directAward' in result && result.directAward
            ? `${result.player} automatically awarded to ${result.team}.`
            : `${result.team} opened bidding on ${result.player}.`,
          event: updated,
        })
      },
      DELETE: async ({ request }) => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        const body = await request.json()
        const result = await resetDraftPick(event.id, String(body.pickId ?? ''))

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'draft.pick.reset')

        return Response.json({
          ok: true,
          message: `${result.player} returned to the signup pool.`,
          event: updated,
        })
      },
    },
  },
  component: () => null,
})
