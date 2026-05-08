import { GROUP_LOGO_ACCEPTED_MIME_TYPES, GROUP_LOGO_MAX_UPLOAD_BYTES } from './groupLogoConstants'

const RESIZE_DIMENSIONS = [512, 384, 256, 192, 128]
const WEBP_QUALITIES = [0.92, 0.82, 0.72, 0.62, 0.52]

type ProcessedGroupLogo = {
  logoUrl: string
  message?: string
}

export async function processGroupLogoInput(file?: File, options: { groupId?: string } = {}): Promise<ProcessedGroupLogo> {
  if (!file) return { logoUrl: '' }
  if (!GROUP_LOGO_ACCEPTED_MIME_TYPES.includes(file.type as (typeof GROUP_LOGO_ACCEPTED_MIME_TYPES)[number])) {
    throw new Error('Logo must be a PNG, JPG, WebP, or GIF image.')
  }

  if (file.type === 'image/gif') {
    if (file.size > GROUP_LOGO_MAX_UPLOAD_BYTES) {
      throw new Error('GIF logos must be smaller than 500 KB. Use PNG, JPG, or WebP for automatic resizing.')
    }
    return { logoUrl: await uploadGroupLogo(file, options.groupId) }
  }

  if (file.size <= GROUP_LOGO_MAX_UPLOAD_BYTES) {
    return { logoUrl: await uploadGroupLogo(file, options.groupId) }
  }

  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)
  for (const maxDimension of RESIZE_DIMENSIONS) {
    const canvas = drawImageWithin(image, maxDimension)
    for (const quality of WEBP_QUALITIES) {
      const blob = await canvasToBlob(canvas, 'image/webp', quality)
      if (blob.size <= GROUP_LOGO_MAX_UPLOAD_BYTES) {
        return {
          logoUrl: await uploadGroupLogo(blob, options.groupId, 'group-logo.webp'),
          message: 'Logo was resized to fit the upload limit.',
        }
      }
    }
  }

  throw new Error('Logo is too large to process. Try a smaller or simpler PNG, JPG, or WebP image.')
}

async function uploadGroupLogo(file: Blob, groupId?: string, filename?: string) {
  const formData = new FormData()
  formData.append('logo', file, filename ?? (file instanceof File ? file.name : 'group-logo.webp'))
  if (groupId) formData.set('groupId', groupId)

  const response = await fetch('/api/group-logos', {
    method: 'POST',
    body: formData,
  })
  const payload = await response.json() as { logoUrl?: string; message?: string }
  if (!response.ok || !payload.logoUrl) throw new Error(payload.message ?? 'Unable to upload logo image.')
  return payload.logoUrl
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Unable to read logo image.'))
      }
    }
    reader.onerror = () => reject(new Error('Unable to read logo image.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to process logo image.'))
    image.src = src
  })
}

function drawImageWithin(image: HTMLImageElement, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to process logo image.')
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Unable to process logo image.'))
      }
    }, type, quality)
  })
}
