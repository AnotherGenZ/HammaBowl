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

const navLinkClass =
  'inline-flex min-h-9 items-center rounded-full px-3 text-[#cbd5d3] transition-colors hover:bg-white/[0.08] hover:text-[#fff7e6]'
const navLinkActiveClass = `${navLinkClass} bg-white/[0.08] text-[#fff7e6]`
const dropdownItemClass =
  'flex min-h-[38px] items-center justify-start rounded-md px-2.5 font-extrabold text-[#cbd5d3] transition-colors hover:bg-white/[0.08] hover:text-[#fff7e6]'
const dropdownItemActiveClass = `${dropdownItemClass} bg-[#e4b45e]/[0.14] text-[#f3d99d]`
const loginClass = navLinkClass
const loginActiveClass = navLinkActiveClass

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
          <div
            className={
              isOverlayRoute
                ? 'overlay-shell grid min-h-dvh w-full bg-transparent'
                : 'shell min-h-dvh'
            }
          >
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
    <header
      className={`topbar sticky top-0 z-10 grid grid-cols-[auto_auto] items-center gap-3 border-b border-white/[0.08] bg-[#121417]/[0.86] px-[clamp(14px,4vw,28px)] py-3 backdrop-blur-2xl lg:min-h-[77px] lg:grid-cols-[auto_1fr_auto] lg:gap-5 lg:px-[clamp(16px,4vw,44px)] lg:py-[18px] ${mobileNavOpen ? 'mobile-open' : ''}`}
    >
      <Link
        to="/"
        className="brand flex items-center gap-2.5"
        aria-label="HammaBowl home"
        onClick={() => setMobileNavOpen(false)}
      >
        <img className="brand-mark w-9 rounded-md object-contain lg:w-[42px]" src="/hammabowl.png" alt="" />
        <span>
          <strong>HammaBowl</strong>
        </span>
      </Link>
      <button
        type="button"
        className="mobile-nav-toggle inline-grid min-h-[38px] grid-cols-[18px_auto] items-center gap-2 justify-self-end rounded-md border border-[#e4b45e]/[0.38] bg-[#e4b45e]/[0.10] px-3 font-extrabold text-[#f3d99d] lg:hidden"
        aria-expanded={mobileNavOpen}
        aria-controls="primary-navigation"
        onClick={() => setMobileNavOpen((open) => !open)}
      >
        <span className="mobile-nav-bars grid gap-1" aria-hidden="true">
          <span className="block h-0.5 w-[18px] rounded-full bg-current" />
          <span className="block h-0.5 w-[18px] rounded-full bg-current" />
          <span className="block h-0.5 w-[18px] rounded-full bg-current" />
        </span>
        <span>Menu</span>
      </button>
            <nav
              id="primary-navigation"
              className={`${mobileNavOpen ? 'flex' : 'hidden'} nav col-span-full w-full flex-col items-stretch gap-2 rounded-lg border border-white/[0.10] bg-white/[0.045] p-2 [&>a]:w-full [&>a]:justify-center lg:col-auto lg:flex lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:justify-center lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0 lg:[&>a]:w-auto`}
              aria-label="Main navigation"
            >
        <Link
          to="/"
          className={navLinkClass}
          activeProps={{ className: navLinkActiveClass }}
          onClick={() => setMobileNavOpen(false)}
        >
          Event
        </Link>
        {hasCurrentEvent ? (
          <Link
            to="/draft"
            className={navLinkClass}
            activeProps={{ className: navLinkActiveClass }}
            onClick={() => setMobileNavOpen(false)}
          >
            Draft
          </Link>
        ) : null}
        {canRateCurrentEvent ? (
          <Link
            to="/ratings"
            className={navLinkClass}
            activeProps={{ className: navLinkActiveClass }}
            onClick={() => setMobileNavOpen(false)}
          >
            Ratings
          </Link>
        ) : null}
        <Link
          to="/hall-of-legends"
          className={navLinkClass}
          activeProps={{ className: navLinkActiveClass }}
          onClick={() => setMobileNavOpen(false)}
        >
          Hall of Legends
        </Link>
        <div
          className={`nav-menu relative w-full lg:w-auto ${communityOpen ? 'open' : ''}`}
          onMouseEnter={openCommunityMenu}
          onMouseLeave={scheduleCommunityMenuClose}
          onFocus={openCommunityMenu}
          onBlur={(event) => closeMenuOnBlur(event, closeCommunityMenu)}
        >
          <button
            type="button"
            className={`${navLinkClass} w-full justify-center border-0 bg-transparent font-normal lg:w-auto ${isCommunityRoute || communityOpen ? 'bg-white/[0.08] text-[#fff7e6]' : ''}`}
            aria-haspopup="true"
            aria-expanded={communityOpen}
            onClick={() => setCommunityOpen((open) => !open)}
          >
            Community
          </button>
          <div
            className={`${communityOpen ? 'grid' : 'hidden'} nav-dropdown static mt-1.5 min-w-0 rounded-lg border border-white/[0.12] bg-[#121417]/[0.98] p-1.5 shadow-none lg:absolute lg:left-1/2 lg:top-[calc(100%+8px)] lg:z-20 lg:mt-0 lg:min-w-[150px] lg:-translate-x-1/2 lg:shadow-[0_18px_40px_rgba(0,0,0,0.35)]`}
          >
            <Link
              to="/players"
              className={dropdownItemClass}
              activeProps={{ className: dropdownItemActiveClass }}
              onClick={closeCommunityMenu}
            >
              Players
            </Link>
            <Link
              to="/groups"
              className={dropdownItemClass}
              activeProps={{ className: dropdownItemActiveClass }}
              onClick={closeCommunityMenu}
            >
              Groups
            </Link>
          </div>
        </div>
      </nav>
      <div
        className={`${mobileNavOpen ? 'flex' : 'hidden'} account-actions col-span-full w-full flex-col items-stretch gap-2 rounded-lg border border-white/[0.10] bg-white/[0.045] p-2 [&>a]:w-full [&>a]:justify-center lg:col-auto lg:flex lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:justify-end lg:border-0 lg:bg-transparent lg:p-0 lg:[&>a]:w-auto`}
      >
        <a
          className="discord-link inline-flex min-h-9 w-9 items-center justify-center rounded-full text-[#cbd5d3] transition-colors hover:bg-white/[0.08] hover:text-[#fff7e6]"
          href="https://discord.gg/k3SfwE8rN4"
          target="_blank"
          rel="noreferrer"
          aria-label="Join the HammaBowl Discord"
          title="Join the HammaBowl Discord"
          onClick={() => setMobileNavOpen(false)}
        >
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.32 4.37A19.83 19.83 0 0 0 15.36 2.83a13.79 13.79 0 0 0-.63 1.3 18.55 18.55 0 0 0-5.5 0 13.79 13.79 0 0 0-.64-1.3 19.74 19.74 0 0 0-4.96 1.54C.5 9.04-.35 13.59.08 18.07a19.94 19.94 0 0 0 6.08 3.08 14.8 14.8 0 0 0 1.3-2.11 12.9 12.9 0 0 1-2.05-.98c.17-.13.34-.26.5-.39a14.13 14.13 0 0 0 12.18 0c.16.13.33.26.5.39-.65.39-1.34.72-2.06.99.37.73.8 1.44 1.3 2.1a19.88 19.88 0 0 0 6.09-3.08c.5-5.19-.84-9.7-3.6-13.7ZM8.02 15.31c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.09 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.09 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Z" />
          </svg>
        </a>
        {isAdmin ? (
          <Link
            to="/admin"
            className={loginClass}
            activeProps={{ className: loginActiveClass }}
            onClick={() => setMobileNavOpen(false)}
          >
            Admin
          </Link>
        ) : null}
        {user ? (
          <div
            className={`user-menu relative w-full lg:w-auto ${userMenuOpen ? 'open' : ''}`}
            onMouseEnter={openUserMenu}
            onMouseLeave={scheduleUserMenuClose}
            onFocus={openUserMenu}
            onBlur={(event) => closeMenuOnBlur(event, closeUserMenu)}
          >
            <Link
              to="/players/$discordId"
              params={{ discordId: user.id }}
              className="user-chip inline-flex min-h-9 w-full max-w-full items-center justify-center gap-2 rounded-full py-[3px] pl-[3px] pr-3 text-[#cbd5d3] transition-colors hover:bg-white/[0.08] hover:text-[#fff7e6] lg:w-auto lg:max-w-[220px]"
              activeProps={{
                className:
                  'user-chip inline-flex min-h-9 w-full max-w-full items-center justify-center gap-2 rounded-full bg-white/[0.08] py-[3px] pl-[3px] pr-3 text-[#fff7e6] transition-colors lg:w-auto lg:max-w-[220px]',
              }}
              aria-label={`${user.name}'s profile`}
              onClick={closeUserMenu}
            >
              {user.avatarUrl ? (
                <img className="size-[30px] shrink-0 rounded-full object-cover" src={user.avatarUrl} alt="" />
              ) : (
                <span
                  className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[#e4b45e]/[0.16] text-sm font-black text-[#e4b45e]"
                  aria-hidden="true"
                >
                  {user.name.slice(0, 1)}
                </span>
              )}
              <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                <PlayerName name={user.name} groupTag={user.groupTag} groupTagColor={user.groupTagColor} />
              </strong>
            </Link>
            <div
              className={`${userMenuOpen ? 'grid' : 'hidden'} user-dropdown static mt-1.5 min-w-0 rounded-lg border border-white/[0.12] bg-[#121417]/[0.98] p-1.5 shadow-none lg:absolute lg:right-0 lg:top-[calc(100%+8px)] lg:z-20 lg:mt-0 lg:min-w-40 lg:shadow-[0_18px_40px_rgba(0,0,0,0.35)]`}
            >
              <Link to="/settings" className={dropdownItemClass} onClick={closeUserMenu}>
                Settings
              </Link>
              <form action="/api/auth/logout" method="post" onSubmit={closeUserMenu}>
                <button className={`${dropdownItemClass} w-full border-0 bg-transparent text-left hover:bg-[#d94f3d]/[0.16] hover:text-[#f2b4ab]`} type="submit">
                  Logout
                </button>
              </form>
            </div>
          </div>
        ) : (
          <a className={loginClass} href="/api/auth/discord" onClick={() => setMobileNavOpen(false)}>
            Login
          </a>
        )}
      </div>
    </header>
  )
}
