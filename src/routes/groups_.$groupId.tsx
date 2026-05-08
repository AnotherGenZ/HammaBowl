import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { PlayerName } from '../components/PlayerName'
import { GROUP_LOGO_ACCEPT_ATTRIBUTE } from '../lib/groupLogoConstants'
import { processGroupLogoInput } from '../lib/groupLogoInput'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import type { GroupDetail, GroupParticipant } from '../lib/types'

const loadGroupDetail = createServerFn({ method: 'GET' })
  .inputValidator((input: { groupId: string }) => input)
  .handler(async ({ data }) => {
    const { getDiscordSessionUser } = await import('../lib/discord.server')
    const {
      getGroupAdministratorCandidateList,
      getGroupDetailForUser,
      isGroupAdministrator,
    } = await import('../lib/db.server')
    const user = await getDiscordSessionUser()
    const isSiteAdmin = Boolean(user?.roles.includes('admin'))
    const isGroupAdmin = Boolean(user && isGroupAdministrator(data.groupId, user.id))
    const group = getGroupDetailForUser(data.groupId, user?.id, isSiteAdmin || isGroupAdmin)

    return {
      group,
      isSiteAdmin,
      canManageGroupSettings: isSiteAdmin || isGroupAdmin,
      canManageMembership: isSiteAdmin || isGroupAdmin,
      players: isSiteAdmin ? getGroupAdministratorCandidateList(data.groupId) : [],
    }
  })

export const Route = createFileRoute('/groups_/$groupId')({
  loader: ({ params }) => loadGroupDetail({ data: { groupId: params.groupId } }),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData?.group ? loaderData.group.name : 'Group',
      description: loaderData?.group?.description ?? 'HammaBowl group roster and administrators.',
      path: loaderData?.group ? `/groups/${loaderData.group.id}` : '/groups',
    }),
  component: GroupPage,
})

function GroupPage() {
  const loaderData = Route.useLoaderData()
  const { user } = useSession()
  const [group, setGroup] = useState<GroupDetail | null>(loaderData.group)
  const [message, setMessage] = useState('')
  const [logoMessage, setLogoMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [form, setForm] = useState(() => ({
    tag: loaderData.group?.tag ?? '',
    name: loaderData.group?.name ?? '',
    description: loaderData.group?.description ?? '',
    tagColor: loaderData.group?.tagColor ?? '#47bf8f',
    logoUrl: loaderData.group?.logoUrl ?? '',
  }))
  const administratorIds = useMemo(
    () => new Set(group?.administrators.map((admin) => admin.discordId) ?? []),
    [group],
  )
  const adminOptions = loaderData.players.filter((player) => !administratorIds.has(player.discordId))

  if (!group) {
    return (
      <main>
        <section className="panel empty-state">
          <h1>Group not found</h1>
          <p>The group may have been removed.</p>
          <Link className="secondary-action" to="/groups">Back to groups</Link>
        </section>
      </main>
    )
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!group) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupId: group.id, ...form }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to update group.')
      setGroup((current) => current ? { ...current, ...payload.group } : payload.group)
      setLogoMessage('')
      setMessage('Group updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update group.')
    } finally {
      setSaving(false)
    }
  }

  async function membershipAction(action: string, discordId?: string, enabled?: boolean) {
    if (!group) return
    setMessage('')
    try {
      const response = await fetch('/api/group-memberships', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, groupId: group.id, discordId, enabled }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to update group.')
      setGroup((current) => current ? { ...current, ...payload.group } : payload.group)
      if (action === 'set-admin') setSelectedAdminId('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update group.')
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    setLogoMessage('')
    try {
      const result = await processGroupLogoInput(event.currentTarget.files?.[0], { groupId: group?.id })
      if (result.logoUrl) setForm((current) => ({ ...current, logoUrl: result.logoUrl }))
      if (result.message) setLogoMessage(result.message)
    } catch (error) {
      event.currentTarget.value = ''
      setLogoMessage(error instanceof Error ? error.message : 'Unable to process logo image.')
    }
  }

  return (
    <main>
      <nav className="breadcrumb-nav" aria-label="Breadcrumb">
        <Link to="/groups" activeOptions={{ exact: true }}>
          Groups
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{group.name}</span>
      </nav>
      <section className="group-hero">
        <GroupLogo group={group} />
        <div>
          <div className="group-title-line">
            <span className="group-tag" style={groupTagStyle(group.tagColor)}>{group.tag}</span>
            <h1>{group.name}</h1>
          </div>
          <p>{group.description}</p>
          {group.currentUserStatus ? (
            <div className="group-stat-row">
              {group.currentUserStatus === 'pending' ? <span>Request pending</span> : null}
              {group.currentUserStatus === 'member' ? (
                <button
                  className="danger-action"
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Leave ${group.name}?`)) membershipAction('leave')
                  }}
                >
                  Leave group
                </button>
              ) : null}
            </div>
          ) : (
            <div className="group-stat-row">
              {user ? (
                <button className="secondary-action" type="button" onClick={() => membershipAction('request')}>
                  Apply
                </button>
              ) : (
                <span>Login to apply</span>
              )}
            </div>
          )}
        </div>
      </section>

      {message ? <div className="admin-result">{message}</div> : null}

      {loaderData.canManageGroupSettings ? (
        <section className="panel group-admin-create">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Admin</p>
              <h2>Group properties</h2>
            </div>
          </div>
          <form className="group-form" onSubmit={saveGroup}>
            <label>
              Tag
              <input
                value={form.tag}
                maxLength={4}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) => ({ ...current, tag: value }))
                }}
              />
            </label>
            <label>
              Group name
              <input
                value={form.name}
                maxLength={80}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) => ({ ...current, name: value }))
                }}
              />
            </label>
            <label>
              Tag color
              <input
                type="color"
                value={form.tagColor}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) => ({ ...current, tagColor: value }))
                }}
              />
            </label>
            <label>
              Logo
              <input accept={GROUP_LOGO_ACCEPT_ATTRIBUTE} type="file" onChange={handleLogoChange} />
              {logoMessage ? <small className="group-form-hint">{logoMessage}</small> : null}
            </label>
            <label className="group-form-wide">
              Description
              <textarea
                value={form.description}
                rows={4}
                maxLength={2000}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) => ({ ...current, description: value }))
                }}
              />
            </label>
            <div className="group-form-actions">
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? 'Saving…' : 'Save properties'}
              </button>
            </div>
          </form>

          {loaderData.isSiteAdmin ? (
            <div className="group-admin-picker">
              <label>
                Add group administrator
                <select
                  value={selectedAdminId}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setSelectedAdminId(value)
                  }}
                >
                  <option value="">Choose a player</option>
                  {adminOptions.map((player) => (
                    <option key={player.discordId} value={player.discordId}>
                      {player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-action"
                disabled={!selectedAdminId}
                type="button"
                onClick={() => membershipAction('set-admin', selectedAdminId, true)}
              >
                Add admin
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {loaderData.canManageMembership && group.pendingMembers.length ? (
        <RosterSection
          title="Pending requests"
          people={group.pendingMembers}
          actions={(player) => (
            <>
              <button className="secondary-action" type="button" onClick={() => membershipAction('accept', player.discordId)}>
                Accept
              </button>
              <button className="danger-action" type="button" onClick={() => membershipAction('kick', player.discordId)}>
                Decline
              </button>
            </>
          )}
        />
      ) : null}

      <RosterSection
        title="Administrators"
        people={group.administrators}
        emptyText="No group administrators have been assigned."
        actions={(player) =>
          loaderData.isSiteAdmin ? (
            <button className="danger-action" type="button" onClick={() => membershipAction('set-admin', player.discordId, false)}>
              Remove admin
            </button>
          ) : null
        }
      />

      <RosterSection
        title="Members"
        people={group.members}
        emptyText="No members yet."
        actions={(player) =>
          loaderData.canManageMembership ? (
            <button className="danger-action" type="button" onClick={() => membershipAction('kick', player.discordId)}>
              Kick
            </button>
          ) : null
        }
      />
    </main>
  )
}

function RosterSection({
  title,
  people,
  emptyText,
  actions,
}: {
  title: string
  people: GroupParticipant[]
  emptyText?: string
  actions?: (player: GroupParticipant) => ReactNode
}) {
  return (
    <section className="panel group-roster-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="group-count-badge">{people.length}</span>
      </div>
      {people.length === 0 ? (
        <p className="empty-inline">{emptyText ?? 'No players to show.'}</p>
      ) : (
        <div className="group-roster-list">
          {people.map((player) => (
            <div className="group-roster-row" key={player.discordId}>
              <Link to="/players/$discordId" params={{ discordId: player.discordId }} className="group-player-link">
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} alt="" />
                ) : (
                  <span className="group-player-avatar-fallback">{player.name.slice(0, 1)}</span>
                )}
                <strong>
                  <PlayerName name={player.name} groupTag={player.groupTag} groupTagColor={player.groupTagColor} />
                </strong>
              </Link>
              <div className="group-row-actions">{actions?.(player)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function GroupLogo({ group }: { group: Pick<GroupDetail, 'tag' | 'logoUrl'> }) {
  if (group.logoUrl) return <img className="group-logo large" src={group.logoUrl} alt="" />
  return <span className="group-logo group-logo-fallback large">{group.tag.slice(0, 2)}</span>
}

function groupTagStyle(tagColor?: string): CSSProperties | undefined {
  return tagColor ? ({ '--group-tag-color': tagColor } as CSSProperties) : undefined
}
