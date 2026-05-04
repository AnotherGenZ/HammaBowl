import { createFileRoute } from '@tanstack/react-router'
import { ensureHonuAlertRefresh, ensureHonuPsbAccountRefresh } from '../lib/honu.server'
import { getCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/event/current')({
  server: {
    handlers: {
      GET: async () => {
        ensureHonuAlertRefresh()
        ensureHonuPsbAccountRefresh()
        return Response.json(await getCurrentEvent())
      },
    },
  },
  component: () => null,
})
