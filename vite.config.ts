import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    groupLogoUploadStaticDevServer(),
    tanstackStart(),
    nitro({
      handlers: [
        {
          route: '/uploads/group-logos/**',
          handler: path.resolve('src/server/groupLogoUploads.ts'),
        },
      ],
      experimental: {
        websocket: true,
      },
    }),
    viteReact(),
  ],
})

function groupLogoUploadStaticDevServer(): Plugin {
  const uploadDir =
    process.env.GROUP_LOGO_UPLOAD_DIR?.trim() || path.join(process.cwd(), 'data', 'uploads', 'group-logos')

  return {
    name: 'hammabowl-group-logo-upload-static-dev-server',
    configureServer(server) {
      server.middlewares.use('/uploads/group-logos', (request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          next()
          return
        }

        const filename = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname.split('/').pop() ?? '')
        if (!/^[a-f0-9-]+\.(?:png|jpe?g|webp|gif)$/i.test(filename)) {
          next()
          return
        }

        const filePath = path.join(uploadDir, filename)
        fs.stat(filePath, (statError, stat) => {
          if (statError || !stat.isFile()) {
            next()
            return
          }

          response.statusCode = 200
          response.setHeader('cache-control', 'public, max-age=31536000, immutable')
          response.setHeader('content-length', String(stat.size))
          response.setHeader('content-type', groupLogoContentType(filename))
          if (request.method === 'HEAD') {
            response.end()
            return
          }
          fs.createReadStream(filePath).pipe(response)
        })
      })
    },
  }
}

function groupLogoContentType(filename: string) {
  const extension = path.extname(filename).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return 'application/octet-stream'
}
