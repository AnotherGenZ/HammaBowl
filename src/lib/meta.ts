export const SITE_NAME = 'HammaBowl'
export const DEFAULT_DESCRIPTION =
  'HammaBowl event operations, ratings, drafts, standings, and stream overlay.'

const DEFAULT_IMAGE = '/og-image.png?v=1'
const THEME_COLOR = '#121417'

interface PageMetaOptions {
  title?: string
  description?: string
  path?: string
  image?: string
  imageAlt?: string
  noIndex?: boolean
}

export function pageMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  imageAlt = 'HammaBowl event tools preview',
  noIndex = false,
}: PageMetaOptions = {}) {
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  const canonicalUrl = absoluteUrl(path)
  const imageUrl = absoluteUrl(image)
  const meta = [
    { title: pageTitle },
    { name: 'description', content: description },
    { name: 'theme-color', content: THEME_COLOR },
    { property: 'og:locale', content: 'en_US' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: pageTitle },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: imageAlt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: pageTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
    { name: 'twitter:image:alt', content: imageAlt },
  ]

  if (imageUrl.startsWith('https://')) {
    meta.push({ property: 'og:image:secure_url', content: imageUrl })
  }

  if (noIndex) {
    meta.push({ name: 'robots', content: 'noindex,nofollow' })
  }

  return {
    meta,
    links: [{ rel: 'canonical', href: canonicalUrl }],
  }
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path

  const baseUrl =
    typeof process === 'undefined' ? '' : process.env.APP_BASE_URL?.replace(/\/$/, '') ?? ''
  if (!baseUrl) return path

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
