import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import type { GroupSummary } from '../lib/types'

const loadGroupDirectory = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDiscordSessionUser } = await import('../lib/discord.server')
  const { listGroupsForUser } = await import('../lib/db.server')
  const user = await getDiscordSessionUser()

  return {
    groups: listGroupsForUser(user?.id),
    isSiteAdmin: Boolean(user?.roles.includes('admin')),
  }
})

export const Route = createFileRoute('/groups')({
  loader: () => loadGroupDirectory(),
  head: () =>
    pageMeta({
      title: 'Groups',
      description: 'Browse HammaBowl groups, request membership, and view group rosters.',
      path: '/groups',
    }),
  component: GroupDirectory,
})

function GroupDirectory() {
  const loaderData = Route.useLoaderData()
  const { user } = useSession()
  const [groups, setGroups] = useState<GroupSummary[]>(loaderData.groups)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tag: '',
    name: '',
    description: '',
    tagColor: '#47bf8f',
    logoUrl: '',
  })
  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return groups
    return groups.filter((group) =>
      [group.tag, group.name, group.description].some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [groups, query])
  const currentMemberGroup = useMemo(
    () => groups.find((group) => group.currentUserStatus === 'member'),
    [groups],
  )

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to create group.')
      setGroups(payload.groups)
      setForm({ tag: '', name: '', description: '', tagColor: '#47bf8f', logoUrl: '' })
      setMessage('Group created.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create group.')
    } finally {
      setSaving(false)
    }
  }

  async function requestMembership(groupId: string) {
    setMessage('')
    try {
      const response = await fetch('/api/group-memberships', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'request', groupId }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to request membership.')
      setGroups((current) =>
        current.map((group) => (group.id === payload.group.id ? { ...group, ...payload.group } : group)),
      )
      setMessage('Join request sent.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request membership.')
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const logoUrl = await readImageInput(event.currentTarget.files?.[0])
    if (logoUrl) setForm((current) => ({ ...current, logoUrl }))
  }

  return (
    <main>
      <section className="groups-header">
        <div>
          <p className="eyebrow">Group directory</p>
          <h1>Groups</h1>
        </div>
        <div className="groups-search-wrap">
          <input
            className="groups-search-input"
            value={query}
            placeholder="Search groups"
            onChange={(event) => {
              const value = event.currentTarget.value
              setQuery(value)
            }}
          />
        </div>
      </section>

      {message ? <div className="admin-result">{message}</div> : null}

      {loaderData.isSiteAdmin ? (
        <section className="panel group-admin-create">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Site admin</p>
              <h2>Create group</h2>
            </div>
          </div>
          <form className="group-form" onSubmit={submitGroup}>
            <label>
              Tag
              <input
                value={form.tag}
                maxLength={4}
                placeholder="2-4 characters"
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
              <input accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={handleLogoChange} />
            </label>
            <label className="group-form-wide">
              Description
              <textarea
                value={form.description}
                maxLength={2000}
                rows={4}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) => ({ ...current, description: value }))
                }}
              />
            </label>
            <div className="group-form-actions">
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="groups-grid" aria-label="Available groups">
        {filteredGroups.length === 0 ? (
          <div className="panel empty-state">
            <h2>No groups found</h2>
            <p>Available groups will appear here after an admin creates them.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <article className="group-card" key={group.id}>
              <Link to="/groups/$groupId" params={{ groupId: group.id }} className="group-card-main">
                <GroupLogo group={group} />
                <div>
                  <div className="group-title-line">
                    <span className="group-tag" style={groupTagStyle(group.tagColor)}>{group.tag}</span>
                    <h2>{group.name}</h2>
                  </div>
                  <p>{group.description}</p>
                </div>
              </Link>
              <div className="group-card-footer">
                <span className="group-count-badge">{group.memberCount} members</span>
                <MembershipAction
                  group={group}
                  loggedIn={Boolean(user)}
                  currentMemberGroup={currentMemberGroup}
                  onRequest={requestMembership}
                />
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}

function MembershipAction({
  group,
  loggedIn,
  currentMemberGroup,
  onRequest,
}: {
  group: GroupSummary
  loggedIn: boolean
  currentMemberGroup?: GroupSummary
  onRequest: (groupId: string) => void
}) {
  if (group.currentUserStatus === 'member') return <span className="status-pill">Member</span>
  if (group.currentUserStatus === 'pending') return <span className="status-pill pending">Pending</span>
  if (!loggedIn) return <span className="status-pill muted">Login to join</span>
  if (currentMemberGroup && currentMemberGroup.id !== group.id) {
    return <span className="status-pill muted">Leave {currentMemberGroup.name} to join</span>
  }

  return (
    <button className="secondary-action" type="button" onClick={() => onRequest(group.id)}>
      Request to join
    </button>
  )
}

function GroupLogo({ group }: { group: Pick<GroupSummary, 'name' | 'tag' | 'logoUrl'> }) {
  if (group.logoUrl) return <img className="group-logo" src={group.logoUrl} alt="" />
  return <span className="group-logo group-logo-fallback">{group.tag.slice(0, 2)}</span>
}

function groupTagStyle(tagColor?: string): CSSProperties | undefined {
  return tagColor ? ({ '--group-tag-color': tagColor } as CSSProperties) : undefined
}

function readImageInput(file?: File) {
  if (!file) return Promise.resolve('')
  if (!file.type.startsWith('image/')) return Promise.resolve('')
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}
