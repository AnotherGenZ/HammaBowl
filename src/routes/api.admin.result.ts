import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireEventByIdOrCurrent } from '../lib/services'
import {
  adjustScore,
  getDbEvent,
  saveDueHonuTeamReports,
  setWinningTeam,
  startNextRound,
  updateEventLinks,
  updateEventRoundSettings,
  updateRoundResult,
} from '../lib/db.server'
import { ensureHonuAlertForEvent } from '../lib/honu.server'
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
        if ('roundNumber' in body && ('roundTeamScores' in body || 'roundResultNote' in body)) {
          const result = await updateRoundResult(event.id, Number(body.roundNumber), {
            teamScores: body.roundTeamScores,
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
        let updated = await getDbEvent(event.id)
        if (updated) {
          const honuReports = await saveDueHonuTeamReports(updated)
          if (honuReports.reportCount) {
            messages.push(
              `${honuReports.reportCount} Honu team report${honuReports.reportCount === 1 ? '' : 's'} saved.`,
            )
            clearCurrentEventCache()
            updated = await getDbEvent(event.id)
          }
        }
        if (updated) {
          try {
            const honuAlert = await ensureHonuAlertForEvent(updated)
            if (honuAlert) {
              messages.push(honuAlert.message)
              clearCurrentEventCache()
              updated = await getDbEvent(event.id)
            }
          } catch (error) {
            messages.push(
              `Honu alert was not created: ${error instanceof Error ? error.message : 'Unknown error.'}`,
            )
          }
        }
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
