import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  requireCurrentEvent,
  postTeamCompositionToDiscord,
} from '../lib/services'

export const Route = createFileRoute('/api/admin/raid-helper/post-composition')({
  server: {
    handlers: {
      POST: async () => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        const result = await postTeamCompositionToDiscord(event)

        return Response.json(result)
      },
    },
  },
  component: () => null,
})
