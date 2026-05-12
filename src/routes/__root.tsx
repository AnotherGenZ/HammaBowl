/// <reference types="vite/client" />
import { useRef, useState, type FocusEvent, type MutableRefObject, type ReactNode } from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { pageMeta } from '../lib/meta'
import { SessionProvider, useSession, type InitialSessionState } from '../lib/SessionContext'
import { PlayerName } from '../components/PlayerName'
import appCss from '../styles.css?url'

const loadInitialSession = createServerFn({ method: 'GET' }).handler(async (): Promise<InitialSessionState> => {
  const [{ getDiscordSessionUser }, { getCurrentEvent }] = await Promise.all([
    import('../lib/discord.server'),
    import('../lib/services'),
  ])
  const [user, event] = await Promise.all([
    getDiscordSessionUser().catch(() => null),
    getCurrentEvent().catch(() => null),
  ])

  return {
    user,
    hasCurrentEvent: Boolean(event),
    canRateCurrentEvent: Boolean(
      event &&
      user?.profileComplete &&
      (
        user.roles.includes('admin') ||
        event.players.some((player) => player.id === user.id)
      ),
    ),
  }
})

export const Route = createRootRoute({
  loader: () => loadInitialSession(),
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
  const initialSession = Route.useLoaderData()
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
        <SessionProvider initialSession={initialSession}>
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
  const { user, hasCurrentEvent, canRateCurrentEvent } = useSession()
  const isAdmin = user?.roles.includes('admin')
  const [communityOpen, setCommunityOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const communityCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isCommunityRoute = pathname === '/players' ||
    pathname.startsWith('/players/') ||
    pathname === '/groups' ||
    pathname.startsWith('/groups/')

  function closeCommunityMenu() {
    clearMenuCloseTimer(communityCloseTimer)
    setCommunityOpen(false)
    setMobileNavOpen(false)
  }

  function closeUserMenu() {
    clearMenuCloseTimer(userMenuCloseTimer)
    setUserMenuOpen(false)
    setMobileNavOpen(false)
  }

  function openCommunityMenu() {
    clearMenuCloseTimer(communityCloseTimer)
    setCommunityOpen(true)
  }

  function openUserMenu() {
    clearMenuCloseTimer(userMenuCloseTimer)
    setUserMenuOpen(true)
  }

  function scheduleCommunityMenuClose() {
    scheduleMenuClose(communityCloseTimer, closeCommunityMenu)
  }

  function scheduleUserMenuClose() {
    scheduleMenuClose(userMenuCloseTimer, closeUserMenu)
  }

  function closeMenuOnBlur(
    event: FocusEvent<HTMLElement>,
    closeMenu: () => void,
  ) {
    const nextTarget = event.relatedTarget
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      closeMenu()
    }
  }

  function clearMenuCloseTimer(timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
    if (!timerRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = null
  }

  function scheduleMenuClose(
    timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
    closeMenu: () => void,
  ) {
    clearMenuCloseTimer(timerRef)
    timerRef.current = setTimeout(closeMenu, 180)
  }

  return (
    <header className={mobileNavOpen ? 'topbar mobile-open' : 'topbar'}>
      <Link to="/" className="brand" aria-label="HammaBowl home" onClick={() => setMobileNavOpen(false)}>
        <img className="brand-mark" src="/hammabowl.png" alt="" />
        <span>
          <strong>HammaBowl</strong>
        </span>
      </Link>
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-expanded={mobileNavOpen}
        aria-controls="primary-navigation"
        onClick={() => setMobileNavOpen((open) => !open)}
      >
        <span className="mobile-nav-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>Menu</span>
      </button>
      <nav id="primary-navigation" className="nav" aria-label="Main navigation">
        <Link to="/" activeProps={{ className: 'active' }} onClick={() => setMobileNavOpen(false)}>
          Event
        </Link>
        {hasCurrentEvent ? (
          <Link to="/draft" activeProps={{ className: 'active' }} onClick={() => setMobileNavOpen(false)}>
            Draft
          </Link>
        ) : null}
        {canRateCurrentEvent ? (
          <Link to="/ratings" activeProps={{ className: 'active' }} onClick={() => setMobileNavOpen(false)}>
            Ratings
          </Link>
        ) : null}
        <Link to="/hall-of-legends" activeProps={{ className: 'active' }} onClick={() => setMobileNavOpen(false)}>
          Hall of Legends
        </Link>
        <div
          className={communityOpen ? 'nav-menu open' : 'nav-menu'}
          onMouseEnter={openCommunityMenu}
          onMouseLeave={scheduleCommunityMenuClose}
          onFocus={openCommunityMenu}
          onBlur={(event) => closeMenuOnBlur(event, closeCommunityMenu)}
        >
          <button
            type="button"
            className={isCommunityRoute ? 'nav-menu-trigger active' : 'nav-menu-trigger'}
            aria-haspopup="true"
            aria-expanded={communityOpen}
            onClick={() => setCommunityOpen((open) => !open)}
          >
            Community
          </button>
          <div className="nav-dropdown">
            <Link
              to="/players"
              className="nav-dropdown-item"
              activeProps={{ className: 'nav-dropdown-item active' }}
              onClick={closeCommunityMenu}
            >
              Players
            </Link>
            <Link
              to="/groups"
              className="nav-dropdown-item"
              activeProps={{ className: 'nav-dropdown-item active' }}
              onClick={closeCommunityMenu}
            >
              Groups
            </Link>
          </div>
        </div>
      </nav>
      <div className="account-actions">
        <a
          className="discord-link"
          href="https://discord.gg/k3SfwE8rN4"
          target="_blank"
          rel="noreferrer"
          aria-label="Join the HammaBowl Discord"
          title="Join the HammaBowl Discord"
          onClick={() => setMobileNavOpen(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.32 4.37A19.83 19.83 0 0 0 15.36 2.83a13.79 13.79 0 0 0-.63 1.3 18.55 18.55 0 0 0-5.5 0 13.79 13.79 0 0 0-.64-1.3 19.74 19.74 0 0 0-4.96 1.54C.5 9.04-.35 13.59.08 18.07a19.94 19.94 0 0 0 6.08 3.08 14.8 14.8 0 0 0 1.3-2.11 12.9 12.9 0 0 1-2.05-.98c.17-.13.34-.26.5-.39a14.13 14.13 0 0 0 12.18 0c.16.13.33.26.5.39-.65.39-1.34.72-2.06.99.37.73.8 1.44 1.3 2.1a19.88 19.88 0 0 0 6.09-3.08c.5-5.19-.84-9.7-3.6-13.7ZM8.02 15.31c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.09 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.09 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Z" />
          </svg>
        </a>
        {isAdmin ? (
          <Link
            to="/admin"
            className="login"
            activeProps={{ className: 'login active' }}
            onClick={() => setMobileNavOpen(false)}
          >
            Admin
          </Link>
        ) : null}
        {user ? (
          <div
            className={userMenuOpen ? 'user-menu open' : 'user-menu'}
            onMouseEnter={openUserMenu}
            onMouseLeave={scheduleUserMenuClose}
            onFocus={openUserMenu}
            onBlur={(event) => closeMenuOnBlur(event, closeUserMenu)}
          >
            <Link
              to="/players/$discordId"
              params={{ discordId: user.id }}
              className="user-chip"
              activeProps={{ className: 'user-chip active' }}
              aria-label={`${user.name}'s profile`}
              onClick={closeUserMenu}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                <span aria-hidden="true">{user.name.slice(0, 1)}</span>
              )}
              <strong>
                <PlayerName name={user.name} groupTag={user.groupTag} groupTagColor={user.groupTagColor} />
              </strong>
            </Link>
            <div className="user-dropdown">
              <Link to="/settings" className="user-dropdown-item" onClick={closeUserMenu}>
                Settings
              </Link>
              <form action="/api/auth/logout" method="post" onSubmit={closeUserMenu}>
                <button className="user-dropdown-item user-dropdown-button" type="submit">
                  Logout
                </button>
              </form>
            </div>
          </div>
        ) : (
          <a className="login" href="/api/auth/discord" onClick={() => setMobileNavOpen(false)}>
            Login
          </a>
        )}
      </div>
    </header>
  )
}
