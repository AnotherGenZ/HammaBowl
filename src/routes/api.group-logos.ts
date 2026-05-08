import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser, requireAdminSession } from '../lib/discord.server'
import { GROUP_LOGO_MAX_REQUEST_BYTES } from '../lib/groupLogoConstants'
import { isGroupAdministrator } from '../lib/db.server'
import { saveGroupLogoUpload } from '../lib/groupLogoStorage.server'

export const Route = createFileRoute('/api/group-logos')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get('content-length') ?? 0)
        if (contentLength > GROUP_LOGO_MAX_REQUEST_BYTES) {
          return Response.json({ ok: false, message: 'Group logo is too large.' }, { status: 413 })
        }

        const formData = await request.formData()
        const groupId = String(formData.get('groupId') ?? '').trim()
        if (groupId) {
          const user = await getDiscordSessionUser()
          const canManage = Boolean(
            user && (user.roles.includes('admin') || isGroupAdministrator(groupId, user.id)),
          )
          if (!canManage) return Response.json({ ok: false, message: 'Admin access required.' }, { status: 403 })
        } else {
          await requireAdminSession()
        }

        const logo = formData.get('logo')
        if (!isUploadedFile(logo)) {
          return Response.json({ ok: false, message: 'Logo image is required.' }, { status: 400 })
        }

        try {
          const logoUrl = await saveGroupLogoUpload(logo)
          return Response.json({ ok: true, logoUrl })
        } catch (error) {
          return Response.json(
            { ok: false, message: error instanceof Error ? error.message : 'Unable to upload logo image.' },
            { status: 400 },
          )
        }
      },
    },
  },
  component: () => null,
})

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value && 'type' in value
}
