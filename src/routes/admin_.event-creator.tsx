import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin_/event-creator')({
  loader: () => {
    throw redirect({ to: '/admin' })
  },
})
