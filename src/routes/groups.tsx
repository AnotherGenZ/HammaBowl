import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { GROUP_LOGO_ACCEPT_ATTRIBUTE } from '../lib/groupLogoConstants'
import { processGroupLogoInput } from '../lib/groupLogoInput'
import { pageMeta } from '../lib/meta'
import type { GroupSummary } from '../lib/types'
import {
  eyebrowClass,
  groupAdminPanelClass,
  groupCardClass,
  groupCardFooterClass,
  groupCardMainClass,
  groupCountBadgeClass,
  groupFormActionsClass,
  groupFormClass,
  groupFormHintClass,
  groupFormWideClass,
  groupLogoFallbackClass,
  groupLogoImageClass,
  groupTagClass,
  groupsGridClass,
  groupsHeaderClass,
  groupsSearchInputClass,
  groupsSearchWrapClass,
  groupTitleLineClass,
} from '../lib/ui'

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
  const [groups, setGroups] = useState<GroupSummary[]>(loaderData.groups)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [logoMessage, setLogoMessage] = useState('')
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
      setLogoMessage('')
      setMessage('Group created.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create group.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    setLogoMessage('')
    try {
      const result = await processGroupLogoInput(event.currentTarget.files?.[0])
      if (result.logoUrl) setForm((current) => ({ ...current, logoUrl: result.logoUrl }))
      if (result.message) setLogoMessage(result.message)
    } catch (error) {
      event.currentTarget.value = ''
      setLogoMessage(error instanceof Error ? error.message : 'Unable to process logo image.')
    }
  }

  return (
    <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
      <section className={groupsHeaderClass}>
        <div>
          <p className={eyebrowClass}>Group directory</p>
          <h1>Groups</h1>
        </div>
        <div className={groupsSearchWrapClass}>
          <input
            className={groupsSearchInputClass}
            value={query}
            placeholder="Search groups"
            onChange={(event) => {
              const value = event.currentTarget.value
              setQuery(value)
            }}
          />
        </div>
      </section>

      {message ? <div className="mb-4 rounded-lg border border-white/[0.10] bg-white/[0.06] px-3.5 py-3 text-[#d8dedc]">{message}</div> : null}

      {loaderData.isSiteAdmin ? (
        <section className={groupAdminPanelClass}>
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <div>
              <p className={eyebrowClass}>Site admin</p>
              <h2>Create group</h2>
            </div>
          </div>
          <form className={groupFormClass} onSubmit={submitGroup}>
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
              <input accept={GROUP_LOGO_ACCEPT_ATTRIBUTE} type="file" onChange={handleLogoChange} />
              {logoMessage ? <small className={groupFormHintClass}>{logoMessage}</small> : null}
            </label>
            <label className={groupFormWideClass}>
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
            <div className={groupFormActionsClass}>
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={groupsGridClass} aria-label="Available groups">
        {filteredGroups.length === 0 ? (
          <div className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
            <h2>No groups found</h2>
            <p>Available groups will appear here after an admin creates them.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <article className={groupCardClass} key={group.id}>
              <Link to="/groups/$groupId" params={{ groupId: group.id }} className={groupCardMainClass}>
                <GroupLogo group={group} />
                <div>
                  <div className={groupTitleLineClass}>
                    <span className={groupTagClass} style={groupTagStyle(group.tagColor)}>{group.tag}</span>
                    <h2>{group.name}</h2>
                  </div>
                  <p>{group.description}</p>
                </div>
              </Link>
              <div className={groupCardFooterClass}>
                <span className={groupCountBadgeClass}>{formatMemberCount(group.memberCount)}</span>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}

function GroupLogo({ group }: { group: Pick<GroupSummary, 'name' | 'tag' | 'logoUrl'> }) {
  if (group.logoUrl) return <img className={groupLogoImageClass()} src={group.logoUrl} alt="" />
  return <span className={groupLogoFallbackClass()}>{group.tag.slice(0, 2)}</span>
}

function formatMemberCount(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`
}

function groupTagStyle(tagColor?: string): CSSProperties | undefined {
  return tagColor ? ({ '--group-tag-color': tagColor } as CSSProperties) : undefined
}
