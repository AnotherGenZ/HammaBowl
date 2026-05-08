export const GROUP_LOGO_MAX_UPLOAD_BYTES = 500_000
export const GROUP_LOGO_MAX_REQUEST_BYTES = 650_000
export const GROUP_LOGO_UPLOAD_BASE_URL = '/uploads/group-logos'

export const GROUP_LOGO_ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

export const GROUP_LOGO_ACCEPT_ATTRIBUTE = GROUP_LOGO_ACCEPTED_MIME_TYPES.join(',')
