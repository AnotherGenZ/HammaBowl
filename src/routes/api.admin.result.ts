import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireEventByIdOrCurrent } from '../lib/services'
import {
  adjustScore,
  getDbEvent,
  setWinningTeam,
  startNextRound,
  updateEventLinks,
  updateEventRoundSettings,
  updateRoundResult,
} from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/admin/result')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json()
        const event = await requireEventByIdOrCurrent(String(body.eventId ?? ''))
        const teamId = String(body.teamId ?? '')

        if (!teamId && (typeof body.delta === 'number' || body.winner)) {
          throw new Response('teamId is required', { status: 400 })
        }

        const messages: string[] = []
        if ('roundCount' in body || 'roundDurationMinutes' in body) {
          const result = await updateEventRoundSettings(event.id, {
            roundCount: String(body.roundCount ?? ''),
            roundDurationMinutes: String(body.roundDurationMinutes ?? ''),
          })
          messages.push(result.message)
        }
        if (body.startRound) {
          const result = await startNextRound(event.id)
          messages.push(result.message)
        }
        if ('roundNumber' in body && ('roundWinningTeamId' in body || 'roundResultNote' in body)) {
          const result = await updateRoundResult(event.id, Number(body.roundNumber), {
            winningTeamId: String(body.roundWinningTeamId ?? ''),
            resultNote: String(body.roundResultNote ?? ''),
          })
          messages.push(result.message)
        }
        if ('twitchStreamUrl' in body || 'twitchVodUrl' in body) {
          await updateEventLinks(event.id, {
            twitchStreamUrl: String(body.twitchStreamUrl ?? ''),
            twitchVodUrl: String(body.twitchVodUrl ?? ''),
          })
          messages.push('Twitch links saved.')
        }
        if (typeof body.delta === 'number' && body.delta !== 0) {
          const result = await adjustScore(event.id, teamId, body.delta)
          messages.push(`${result.team} score is now ${result.score}.`)
        }

        if (body.winner) {
          const result = await setWinningTeam(event.id, teamId)
          messages.push(
            `Winning team recorded with ${result.winnerCount} winning member${
              result.winnerCount === 1 ? '' : 's'
            }.`,
          )
        }

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(
          event.id,
          body.winner || body.startRound || 'roundNumber' in body
            ? 'event.result.recorded'
            : 'event.updated',
        )
        return Response.json({ ok: true, message: messages.join(' ') || 'Result saved.', event: updated })
      },
    },
  },
  component: () => null,
})
