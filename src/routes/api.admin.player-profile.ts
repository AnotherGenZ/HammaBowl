import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  assignPlayerManualBadge,
  getAdminPlayerProfileEditorData,
  renameParticipant,
  resetPlayerCatchphrase,
  unassignPlayerManualBadge,
} from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, syncParticipantNameOverrideToRaidHelper } from '../lib/services'

export const Route = createFileRoute('/api/admin/player-profile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAdminSession()
        const url = new URL(request.url)
        return Response.json(getAdminPlayerProfileEditorData(url.searchParams.get('discordId') ?? ''))
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as {
          action?: string
          discordId?: string
          badgeId?: string
          name?: string
        }
        const discordId = String(body.discordId ?? '')
        const badgeId = String(body.badgeId ?? '')

        if (body.action === 'rename') {
          const name = String(body.name ?? '').trim().slice(0, 80)
          renameParticipant(discordId, name)
          const raidHelperSync = await syncParticipantNameOverrideToRaidHelper(discordId, name)
          clearCurrentEventCache()
          publishEventUpdate('current', 'participant.renamed')
          return Response.json({
            ok: true,
            message: raidHelperSync.synced
              ? `Player renamed and synced to ${raidHelperSync.synced} Raid Helper event${raidHelperSync.synced === 1 ? '' : 's'}.`
              : 'Player renamed.',
            ...getAdminPlayerProfileEditorData(discordId),
          })
        }

        if (body.action === 'assign') {
          const result = {
            ok: true,
            message: 'Badge assigned.',
            ...assignPlayerManualBadge(discordId, badgeId),
          }
          publishEventUpdate('general', 'badges.updated')
          return Response.json(result)
        }

        if (body.action === 'unassign') {
          const result = {
            ok: true,
            message: 'Badge removed.',
            ...unassignPlayerManualBadge(discordId, badgeId),
          }
          publishEventUpdate('general', 'badges.updated')
          return Response.json(result)
        }

        if (body.action === 'reset-catchphrase') {
          const result = {
            ok: true,
            message: 'Catchphrase reset.',
            ...resetPlayerCatchphrase(discordId),
          }
          publishEventUpdate('general', 'player.profile.updated')
          return Response.json(result)
        }

        throw new Response('Unknown profile action.', { status: 400 })
      },
    },
  },
  component: () => null,
})
