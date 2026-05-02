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
        {isAdmin ? (
          <Link to="/admin" className="login" activeProps={{ className: 'login active' }}>
            Admin
          </Link>
        ) : null}
        {user ? (
          <>
            <Link to="/settings" className="login" activeProps={{ className: 'login active' }}>
              Settings
            </Link>
            <Link
              to="/players/$discordId"
              params={{ discordId: user.id }}
              className="login"
              activeProps={{ className: 'login active' }}
            >
              {user.name}
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="login logout-button" type="submit">
                Logout
              </button>
            </form>
          </>
        ) : (
          <a className="login" href="/api/auth/discord">
            Login
          </a>
        )}
      </div>
    </header>
  )
}
