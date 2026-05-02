/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { pageMeta } from '../lib/meta'
import { SessionProvider, useSession } from '../lib/SessionContext'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => {
    const defaultMeta = pageMeta()

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        ...defaultMeta.meta,
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/hammabowl.ico' },
        { rel: 'icon', type: 'image/png', href: '/hammabowl.png' },
        { rel: 'shortcut icon', href: '/hammabowl.ico' },
        { rel: 'apple-touch-icon', href: '/hammabowl.png' },
        ...defaultMeta.links,
      ],
    }
  },
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
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isOverlayRoute = pathname === '/overlay'
  const isRatingsRoute = pathname === '/ratings'
  const isDraftRoute = pathname === '/draft'
  const bodyClassName = isOverlayRoute
    ? 'overlay-document'
    : isRatingsRoute || isDraftRoute
      ? 'fixed-document'
      : undefined

  return (
    <html lang="en" className={isOverlayRoute ? 'overlay-document' : undefined}>
      <head>
        <HeadContent />
      </head>
      <body className={bodyClassName}>
        <SessionProvider>
          <div className={isOverlayRoute ? 'shell overlay-shell' : 'shell'}>
            {isOverlayRoute ? null : <TopBar />}
            {children}
          </div>
        </SessionProvider>
        <Scripts />
      </body>
    </html>
  )
}

function TopBar() {
  const { user, hasCurrentEvent } = useSession()
  const isAdmin = user?.roles.includes('admin')

  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="HammaBowl home">
        <img className="brand-mark" src="/hammabowl.png" alt="" />
        <span>
          <strong>HammaBowl</strong>
        </span>
      </Link>
      <nav className="nav" aria-label="Main navigation">
        <Link to="/" activeProps={{ className: 'active' }}>
          Event
        </Link>
        {hasCurrentEvent ? (
          <Link to="/draft" activeProps={{ className: 'active' }}>
            Draft
          </Link>
        ) : null}
        {hasCurrentEvent &&
        user?.profileComplete &&
        user.roles.some((role) => role === 'participant' || role === 'admin') ? (
          <Link to="/ratings" activeProps={{ className: 'active' }}>
            Ratings
          </Link>
        ) : null}
        <Link to="/hall-of-legends" activeProps={{ className: 'active' }}>
          Hall of Legends
        </Link>
        <Link to="/players" activeProps={{ className: 'active' }}>
          Players
        </Link>
      </nav>
      <div className="account-actions">
        <a
          className="discord-link"
          href="https://discord.gg/k3SfwE8rN4"
          target="_blank"
          rel="noreferrer"
          aria-label="Join the HammaBowl Discord"
          title="Join the HammaBowl Discord"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.32 4.37A19.83 19.83 0 0 0 15.36 2.83a13.79 13.79 0 0 0-.63 1.3 18.55 18.55 0 0 0-5.5 0 13.79 13.79 0 0 0-.64-1.3 19.74 19.74 0 0 0-4.96 1.54C.5 9.04-.35 13.59.08 18.07a19.94 19.94 0 0 0 6.08 3.08 14.8 14.8 0 0 0 1.3-2.11 12.9 12.9 0 0 1-2.05-.98c.17-.13.34-.26.5-.39a14.13 14.13 0 0 0 12.18 0c.16.13.33.26.5.39-.65.39-1.34.72-2.06.99.37.73.8 1.44 1.3 2.1a19.88 19.88 0 0 0 6.09-3.08c.5-5.19-.84-9.7-3.6-13.7ZM8.02 15.31c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.09 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.09 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Z" />
          </svg>
        </a>
        {isAdmin ? (
          <Link to="/admin" className="login" activeProps={{ className: 'login active' }}>
            Admin
          </Link>
        ) : null}
        {user ? (
          <div className="user-menu">
            <Link
              to="/players/$discordId"
              params={{ discordId: user.id }}
              className="user-chip"
              activeProps={{ className: 'user-chip active' }}
              aria-label={`${user.name}'s profile`}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                <span aria-hidden="true">{user.name.slice(0, 1)}</span>
              )}
              <strong>{user.name}</strong>
            </Link>
            <div className="user-dropdown">
              <Link to="/settings" className="user-dropdown-item">
                Settings
              </Link>
              <form action="/api/auth/logout" method="post">
                <button className="user-dropdown-item user-dropdown-button" type="submit">
                  Logout
                </button>
              </form>
            </div>
          </div>
        ) : (
          <a className="login" href="/api/auth/discord">
            Login
          </a>
        )}
      </div>
    </header>
  )
}
