import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  addHistoricalTeamMember,
  createManualHistoricalEvent,
  getAdminHistoricalEvents,
  resetHonuReportState,
  setWinningTeam,
  updateEventAdminSettings,
  upsertHistoricalTeam,
} from '../lib/db.server'
import { generateHonuLinksForEvent } from '../lib/honu.server'

export const Route = createFileRoute('/api/admin/history')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json().catch(() => ({}))
        const action = String(body.action ?? '')
        let message = 'Historical event saved.'

        if (action === 'create-event') {
          await createManualHistoricalEvent({
            name: String(body.name ?? ''),
            startsAt: String(body.startsAt ?? ''),
            server: String(body.server ?? ''),
          })
        } else if (action === 'update-event') {
          await updateEventAdminSettings(String(body.eventId ?? ''), {
            nameOverride: String(body.nameOverride ?? ''),
            startsAt: String(body.startsAt ?? ''),
            server: String(body.server ?? ''),
            trophyId: 'trophyId' in body ? String(body.trophyId ?? '') : undefined,
            lore: String(body.lore ?? ''),
            twitchStreamUrl: String(body.twitchStreamUrl ?? ''),
            twitchVodUrl: String(body.twitchVodUrl ?? ''),
            honuAlertId: 'honuAlertId' in body ? String(body.honuAlertId ?? '') : undefined,
          })
        } else if (action === 'upsert-team') {
          await upsertHistoricalTeam({
            eventId: String(body.eventId ?? ''),
            teamId: String(body.teamId ?? '') || undefined,
            name: String(body.name ?? ''),
            score: Number(body.score),
            captainDiscordId: String(body.captainDiscordId ?? ''),
            captainName: String(body.captainName ?? ''),
            honuReportUrl: String(body.honuReportUrl ?? ''),
          })
        } else if (action === 'add-member') {
          await addHistoricalTeamMember({
            eventId: String(body.eventId ?? ''),
            teamId: String(body.teamId ?? ''),
            discordId: String(body.discordId ?? ''),
            name: String(body.name ?? ''),
          })
        } else if (action === 'winner') {
          await setWinningTeam(String(body.eventId ?? ''), String(body.teamId ?? ''))
        } else if (action === 'reset-honu') {
          const result = await resetHonuReportState(String(body.eventId ?? ''))
          message = result.message
        } else if (action === 'generate-honu') {
          const result = await generateHonuLinksForEvent(String(body.eventId ?? ''))
          message = result.message
        } else {
          throw new Response('Unknown historical admin action', { status: 400 })
        }

        return Response.json({
          ok: true,
          message,
          ...(await getAdminHistoricalEvents()),
        })
      },
    },
  },
  component: () => null,
})
