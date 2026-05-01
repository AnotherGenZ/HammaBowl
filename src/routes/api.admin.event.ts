import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { getDbEvent, updateEventAdminSettings } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/admin/event')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const currentEvent = await requireCurrentEvent()
        const body = await request.json()
        const eventId = String(body.eventId || currentEvent.id)

        await updateEventAdminSettings(eventId, {
          nameOverride: 'nameOverride' in body ? String(body.nameOverride ?? '') : undefined,
          startsAt: 'startsAt' in body ? String(body.startsAt ?? '') : undefined,
          server: 'server' in body ? String(body.server ?? '') : undefined,
          lore: 'lore' in body ? String(body.lore ?? '') : undefined,
          twitchStreamUrl:
            'twitchStreamUrl' in body ? String(body.twitchStreamUrl ?? '') : undefined,
          twitchVodUrl: 'twitchVodUrl' in body ? String(body.twitchVodUrl ?? '') : undefined,
        })

        clearCurrentEventCache()
        const updated = await getDbEvent(eventId)
        publishEventUpdate(eventId, 'event.admin.updated')

        return Response.json({
          ok: true,
          message: 'Event settings saved.',
          event: updated,
        })
      },
    },
  },
  component: () => null,
})
