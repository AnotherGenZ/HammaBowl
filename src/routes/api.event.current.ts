import { createFileRoute } from '@tanstack/react-router'
import { getCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/event/current')({
  server: {
    handlers: {
      GET: async () => Response.json(await getCurrentEvent()),
    },
  },
  component: () => null,
})
