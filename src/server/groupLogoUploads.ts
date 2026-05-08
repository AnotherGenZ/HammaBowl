import fs from 'node:fs/promises'
import { defineHandler, getMethod, getRequestURL } from 'h3'
import { groupLogoContentType, groupLogoFilePath } from '../lib/groupLogoStorage.server'

export default defineHandler(async (event) => {
  const method = getMethod(event)
  if (method !== 'GET' && method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

  const filename = decodeURIComponent(getRequestURL(event).pathname.split('/').pop() ?? '')

  try {
    const filePath = groupLogoFilePath(filename)
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) return new Response('Not found', { status: 404 })
    const headers = {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': String(stat.size),
      'content-type': groupLogoContentType(filename),
    }
    if (method === 'HEAD') {
      return new Response(null, { headers })
    }
    const contents = await fs.readFile(filePath)
    return new Response(contents, {
      headers: {
        ...headers,
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
})
