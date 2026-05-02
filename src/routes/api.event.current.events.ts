import { createFileRoute } from '@tanstack/react-router'
import { getCurrentEvents } from '../lib/services'

export const Route = createFileRoute('/api/event/current/events')({
  server: {
    handlers: {
      GET: async () => Response.json(await getCurrentEvents()),
    },
  },
  component: () => null,
})
