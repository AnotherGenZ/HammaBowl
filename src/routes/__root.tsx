/// <reference types="vite/client" />
import { useEffect, useState, type ReactNode } from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import appCss from '../styles.css?url'
import type { Role } from '../lib/types'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        name: 'description',
        content:
          'HammaBowl event operations, ratings, drafts, standings, and stream overlay.',
      },
      { title: 'HammaBowl' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/hammabowl.ico' },
      { rel: 'shortcut icon', href: '/hammabowl.ico' },
      { rel: 'apple-touch-icon', href: '/hammabowl.png' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<{ name: string; roles: Role[] } | null>(null)
  const [hasCurrentEvent, setHasCurrentEvent] = useState(false)

  useEffect(() => {
    let active = true

    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((payload: { user: { name: string; roles: Role[] } | null }) => {
        if (active) setUser(payload.user)
      })
      .catch(() => {
        if (active) setUser(null)
      })

    fetch('/api/event/current')
      .then((response) => (response.ok ? response.json() : null))
      .then((event) => {
        if (active) setHasCurrentEvent(Boolean(event))
      })
      .catch(() => {
        if (active) setHasCurrentEvent(false)
      })

    return () => {
      active = false
    }
  }, [])

  const isAdmin = user?.roles.includes('admin')

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="shell">
          <header className="topbar">
            <Link to="/" className="brand" aria-label="HammaBowl home">
              <img className="brand-mark" src="/hammabowl.png" alt="" />
              <span>
                <strong>HammaBowl</strong>
              </span>
            </Link>
            <nav className="nav">
              <Link to="/" activeProps={{ className: 'active' }}>
                Event
              </Link>
              {hasCurrentEvent ? (
                <Link to="/draft" activeProps={{ className: 'active' }}>
                  Draft
                </Link>
              ) : null}
              {hasCurrentEvent && user?.roles.some((role) => role === 'participant' || role === 'admin') ? (
                <Link to="/ratings" activeProps={{ className: 'active' }}>
                  Ratings
                </Link>
              ) : null}
              {isAdmin ? (
                <Link to="/admin" activeProps={{ className: 'active' }}>
                  Admin
                </Link>
              ) : null}
              <Link to="/hall-of-legends" activeProps={{ className: 'active' }}>
                Hall of Legends
              </Link>
            </nav>
            <a className="login" href="/api/auth/discord">
              {user ? user.name : 'Discord login'}
            </a>
          </header>
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  )
}
