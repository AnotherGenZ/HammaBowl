import { createFileRoute } from '@tanstack/react-router'
import { subscribeToEventUpdates } from '../lib/realtime.server'

const encoder = new TextEncoder()

export const Route = createFileRoute('/api/event/current/stream')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const eventId = url.searchParams.get('eventId')
        const stream = new ReadableStream({
          start(controller) {
            const send = (event: string, data: unknown) => {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              )
            }

            send('connected', { at: new Date().toISOString() })

            const unsubscribe = subscribeToEventUpdates((message) => {
              if (eventId && message.eventId !== eventId) return
              send('event-update', message)
            })
            const heartbeat = setInterval(() => {
              send('heartbeat', { at: new Date().toISOString() })
            }, 25_000)

            request.signal.addEventListener(
              'abort',
              () => {
                clearInterval(heartbeat)
                unsubscribe()
                controller.close()
              },
              { once: true },
            )
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
  component: () => null,
})
