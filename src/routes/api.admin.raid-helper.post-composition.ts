import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  requireEventByIdOrCurrent,
  syncTeamCompositionToRaidHelper,
} from '../lib/services'

export const Route = createFileRoute('/api/admin/raid-helper/post-composition')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json().catch(() => ({}))
        const event = await requireEventByIdOrCurrent(String(body.eventId ?? ''))
        const result = await syncTeamCompositionToRaidHelper(event)

        return Response.json(result)
      },
    },
  },
  component: () => null,
})
