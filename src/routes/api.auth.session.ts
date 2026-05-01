import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser } from '../lib/discord.server'

export const Route = createFileRoute('/api/auth/session')({
  server: {
    handlers: {
      GET: async () => Response.json({ user: await getDiscordSessionUser() }),
    },
  },
  component: () => null,
})
