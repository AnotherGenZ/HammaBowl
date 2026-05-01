import { createFileRoute } from '@tanstack/react-router'
import { getHammaSession } from '../lib/discord.server'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        const session = await getHammaSession()
        await session.clear()

        return Response.json({ ok: true })
      },
    },
  },
  component: () => null,
})
