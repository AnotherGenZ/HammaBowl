import '@tanstack/react-start/server-only'

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from './env'
import { GROUP_LOGO_MAX_UPLOAD_BYTES, GROUP_LOGO_UPLOAD_BASE_URL } from './groupLogoConstants'

const GROUP_LOGO_UPLOAD_DIR =
  env('GROUP_LOGO_UPLOAD_DIR').trim() || path.join(process.cwd(), 'data', 'uploads', 'group-logos')
const GROUP_LOGO_FILENAME_PATTERN = /^[a-f0-9-]+\.(?:png|jpe?g|webp|gif)$/i

const MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

export function groupLogoUploadDirectory() {
  return GROUP_LOGO_UPLOAD_DIR
}

export function groupLogoFilePath(filename: string) {
  const normalizedFilename = normalizeStoredGroupLogoFilename(filename)
  return path.join(GROUP_LOGO_UPLOAD_DIR, normalizedFilename)
}

export function groupLogoUploadUrlToFilename(logoUrl?: string | null) {
  const normalizedLogoUrl = logoUrl?.trim()
  if (!normalizedLogoUrl) return undefined
  const prefix = `${GROUP_LOGO_UPLOAD_BASE_URL}/`
  if (!normalizedLogoUrl.startsWith(prefix)) return undefined

  const filename = normalizedLogoUrl.slice(prefix.length)
  return GROUP_LOGO_FILENAME_PATTERN.test(filename) ? filename : undefined
}

export function groupLogoContentType(filename: string) {
  const extension = path.extname(filename).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

export async function saveGroupLogoUpload(file: {
  type: string
  size?: number
  arrayBuffer: () => Promise<ArrayBuffer>
}) {
  const extension = MIME_EXTENSIONS.get(file.type)
  if (!extension) throw new Error('Logo must be a PNG, JPG, WebP, or GIF image.')
  if (typeof file.size === 'number' && file.size > GROUP_LOGO_MAX_UPLOAD_BYTES) {
    throw new Error('Group logo is too large.')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  return saveGroupLogoBuffer(buffer, extension)
}

export function persistGroupLogoReference(value: string) {
  const logoUrl = value.trim()
  if (!logoUrl) return undefined

  const dataUrlMatch = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([a-z0-9+/=]+)$/i.exec(logoUrl)
  if (dataUrlMatch) {
    const extension = MIME_EXTENSIONS.get(dataUrlMatch[1].toLowerCase())
    if (!extension) throw new Error('Group logo must be an uploaded image.')
    return saveGroupLogoBuffer(Buffer.from(dataUrlMatch[2], 'base64'), extension)
  }

  if (
    new RegExp(`^${escapeRegExp(GROUP_LOGO_UPLOAD_BASE_URL)}/[a-f0-9-]+\\.(?:png|jpe?g|webp|gif)$`, 'i').test(logoUrl) ||
    /^\/[a-z0-9/_\-%.]+$/i.test(logoUrl) ||
    /^https:\/\/[^\s]+$/i.test(logoUrl)
  ) {
    return logoUrl
  }

  throw new Error('Group logo must be an uploaded image.')
}

export function cleanupOrphanedGroupLogoUploads(
  referencedLogoUrls: Iterable<string | null | undefined>,
  options: { olderThanMs: number; now?: number },
) {
  const referencedFilenames = new Set(
    Array.from(referencedLogoUrls).flatMap((logoUrl) => {
      const filename = groupLogoUploadUrlToFilename(logoUrl)
      return filename ? [filename] : []
    }),
  )
  const now = options.now ?? Date.now()
  const deleted: string[] = []
  const skipped: string[] = []

  if (!fs.existsSync(GROUP_LOGO_UPLOAD_DIR)) return { deleted, skipped }

  for (const entry of fs.readdirSync(GROUP_LOGO_UPLOAD_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !GROUP_LOGO_FILENAME_PATTERN.test(entry.name)) {
      skipped.push(entry.name)
      continue
    }
    if (referencedFilenames.has(entry.name)) continue

    const filePath = path.join(GROUP_LOGO_UPLOAD_DIR, entry.name)
    let stat: fs.Stats
    try {
      stat = fs.statSync(filePath)
    } catch {
      skipped.push(entry.name)
      continue
    }
    if (!stat.isFile() || now - stat.mtimeMs < options.olderThanMs) continue

    try {
      fs.rmSync(filePath)
      deleted.push(entry.name)
    } catch {
      skipped.push(entry.name)
    }
  }

  return { deleted, skipped }
}

function saveGroupLogoBuffer(buffer: Buffer, extension: string) {
  if (!buffer.length) throw new Error('Group logo is empty.')
  if (buffer.length > GROUP_LOGO_MAX_UPLOAD_BYTES) throw new Error('Group logo is too large.')

  fs.mkdirSync(GROUP_LOGO_UPLOAD_DIR, { recursive: true })
  const filename = `${randomUUID()}.${extension === 'jpeg' ? 'jpg' : extension}`
  fs.writeFileSync(path.join(GROUP_LOGO_UPLOAD_DIR, filename), buffer, { flag: 'wx' })
  return `${GROUP_LOGO_UPLOAD_BASE_URL}/${filename}`
}

function normalizeStoredGroupLogoFilename(filename: string) {
  const normalizedFilename = filename.trim()
  if (!GROUP_LOGO_FILENAME_PATTERN.test(normalizedFilename)) {
    throw new Error('Invalid group logo filename.')
  }
  return normalizedFilename
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
