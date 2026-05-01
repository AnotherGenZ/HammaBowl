export interface ProfileBannerOption {
  id: string
  name: string
  src: string
}

export const PROFILE_BANNERS: ProfileBannerOption[] = [
  {
    id: 'auraxis-sunrise',
    name: 'Auraxis Sunrise',
    src: '/profile-banners/auraxis-sunrise.svg',
  },
  {
    id: 'tr-warpgate',
    name: 'TR Warpgate',
    src: '/profile-banners/tr-warpgate.svg',
  },
  {
    id: 'vs-vortex',
    name: 'VS Vortex',
    src: '/profile-banners/vs-vortex.svg',
  },
  {
    id: 'nc-convoy',
    name: 'NC Convoy',
    src: '/profile-banners/nc-convoy.svg',
  },
  {
    id: 'hamma-feast',
    name: 'Hamma Feast',
    src: '/profile-banners/hamma-feast.svg',
  },
  {
    id: 'battle-ham',
    name: 'Battle Ham',
    src: '/profile-banners/battle-ham.svg',
  },
  {
    id: 'jaeger-login-queue',
    name: 'Jaeger Login Queue',
    src: '/profile-banners/jaeger-login-queue.svg',
  },
  {
    id: 'point-hold-panic',
    name: 'Point Hold Panic',
    src: '/profile-banners/point-hold-panic.svg',
  },
  {
    id: 'router-in-the-ham',
    name: 'Router in the Ham',
    src: '/profile-banners/router-in-the-ham.svg',
  },
  {
    id: 'nanoweave-leftovers',
    name: 'Nanoweave Leftovers',
    src: '/profile-banners/nanoweave-leftovers.svg',
  },
  {
    id: 'cobalt-ham-scrim',
    name: 'Cobalt Ham Scrim',
    src: '/profile-banners/cobalt-ham-scrim.svg',
  },
  {
    id: 'redeployside-dinner',
    name: 'Redeployside Dinner',
    src: '/profile-banners/redeployside-dinner.svg',
  },
  {
    id: 'jaeger-account-sharing',
    name: 'Shared Jaeger Login',
    src: '/profile-banners/jaeger-account-sharing.svg',
  },
  {
    id: 'hamma-orbital',
    name: 'Orbital Ham Strike',
    src: '/profile-banners/hamma-orbital.svg',
  },
]

const allowedBannerSources = new Set(PROFILE_BANNERS.map((banner) => banner.src))

export function normalizeProfileBanner(src?: string | null) {
  const value = String(src ?? '').trim()
  return allowedBannerSources.has(value) ? value : ''
}

export function isProfileBanner(src?: string | null) {
  return allowedBannerSources.has(String(src ?? '').trim())
}
