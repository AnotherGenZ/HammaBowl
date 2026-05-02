import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { getDbEvent, setActiveEvent, updateEventAdminSettings } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, getCurrentEvent, getCurrentEvents, requireCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/admin/event')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAdminSession()
        const url = new URL(request.url)
        const eventId = url.searchParams.get('eventId')?.trim()
        const event = eventId ? await getDbEvent(eventId) : await getCurrentEvent()

        return Response.json({
          event,
          currentEvents: await getCurrentEvents(),
        })
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json()

        if ('activeEventId' in body) {
          const event = await setActiveEvent(String(body.activeEventId ?? ''))
          clearCurrentEventCache()
          publishEventUpdate(event.id, 'event.active.updated')
          return Response.json({
            ok: true,
            message: 'Active event updated.',
            event,
          })
        }

        const currentEvent = await requireCurrentEvent()
        const eventId = String(body.eventId || currentEvent.id)

        await updateEventAdminSettings(eventId, {
          nameOverride: 'nameOverride' in body ? String(body.nameOverride ?? '') : undefined,
          startsAt: 'startsAt' in body ? String(body.startsAt ?? '') : undefined,
          server: 'server' in body ? String(body.server ?? '') : undefined,
          lore: 'lore' in body ? String(body.lore ?? '') : undefined,
          twitchStreamUrl:
            'twitchStreamUrl' in body ? String(body.twitchStreamUrl ?? '') : undefined,
          twitchVodUrl: 'twitchVodUrl' in body ? String(body.twitchVodUrl ?? '') : undefined,
          draftStartMinutesBefore:
            'draftStartMinutesBefore' in body
              ? String(body.draftStartMinutesBefore ?? '')
              : undefined,
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
