import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { PlayerName } from '../components/PlayerName'
import { GROUP_LOGO_ACCEPT_ATTRIBUTE } from '../lib/groupLogoConstants'
import { processGroupLogoInput } from '../lib/groupLogoInput'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import type { GroupDetail, GroupParticipant } from '../lib/types'
import {
  breadcrumbNavClass,
  dangerActionClass,
  eyebrowClass,
  groupAdminPanelClass,
  groupAdminPickerClass,
  groupCountBadgeClass,
  groupFormActionsClass,
  groupFormClass,
  groupFormHintClass,
  groupFormWideClass,
  groupHeroClass,
  groupLogoFallbackClass,
  groupLogoImageClass,
  groupPlayerAvatarFallbackClass,
  groupPlayerLinkClass,
  groupRosterListClass,
  groupRosterRowClass,
  groupRosterSectionClass,
  groupRowActionsClass,
  groupStatRowClass,
  groupTagClass,
  groupTitleLineClass,
  secondaryActionClass,
} from '../lib/ui'

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
      <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
          <h1>Group not found</h1>
          <p>The group may have been removed.</p>
          <Link className={secondaryActionClass} to="/groups">Back to groups</Link>
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
    <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
      <nav className={breadcrumbNavClass} aria-label="Breadcrumb">
        <Link to="/groups" activeOptions={{ exact: true }}>
          Groups
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{group.name}</span>
      </nav>
      <section className={groupHeroClass}>
        <GroupLogo group={group} />
        <div>
          <div className={groupTitleLineClass}>
            <span className={groupTagClass} style={groupTagStyle(group.tagColor)}>{group.tag}</span>
            <h1>{group.name}</h1>
          </div>
          <p>{group.description}</p>
          {group.currentUserStatus ? (
            <div className={groupStatRowClass}>
              {group.currentUserStatus === 'pending' ? <span>Request pending</span> : null}
              {group.currentUserStatus === 'member' ? (
                <button
                  className={dangerActionClass}
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
            <div className={groupStatRowClass}>
              {user ? (
                <button className={secondaryActionClass} type="button" onClick={() => membershipAction('request')}>
                  Apply
                </button>
              ) : (
                <span>Login to apply</span>
              )}
            </div>
          )}
        </div>
      </section>

      {message ? <div className="mb-4 rounded-lg border border-white/[0.10] bg-white/[0.06] px-3.5 py-3 text-[#d8dedc]">{message}</div> : null}

      {loaderData.canManageGroupSettings ? (
        <section className={groupAdminPanelClass}>
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <div>
              <p className={eyebrowClass}>Admin</p>
              <h2>Group properties</h2>
            </div>
          </div>
          <form className={groupFormClass} onSubmit={saveGroup}>
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
              {logoMessage ? <small className={groupFormHintClass}>{logoMessage}</small> : null}
            </label>
            <label className={groupFormWideClass}>
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
            <div className={groupFormActionsClass}>
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? 'Saving…' : 'Save properties'}
              </button>
            </div>
          </form>

          {loaderData.isSiteAdmin ? (
            <div className={groupAdminPickerClass}>
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
                className={secondaryActionClass}
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
              <button className={secondaryActionClass} type="button" onClick={() => membershipAction('accept', player.discordId)}>
                Accept
              </button>
              <button className={dangerActionClass} type="button" onClick={() => membershipAction('kick', player.discordId)}>
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
            <button className={dangerActionClass} type="button" onClick={() => membershipAction('set-admin', player.discordId, false)}>
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
            <button className={dangerActionClass} type="button" onClick={() => membershipAction('kick', player.discordId)}>
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
    <section className={groupRosterSectionClass}>
      <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
        <h2>{title}</h2>
        <span className={groupCountBadgeClass}>{people.length}</span>
      </div>
      {people.length === 0 ? (
        <p className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">{emptyText ?? 'No players to show.'}</p>
      ) : (
        <div className={groupRosterListClass}>
          {people.map((player) => (
            <div className={groupRosterRowClass} key={player.discordId}>
              <Link to="/players/$discordId" params={{ discordId: player.discordId }} className={groupPlayerLinkClass}>
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} alt="" />
                ) : (
                  <span className={groupPlayerAvatarFallbackClass}>{player.name.slice(0, 1)}</span>
                )}
                <strong>
                  <PlayerName name={player.name} groupTag={player.groupTag} groupTagColor={player.groupTagColor} />
                </strong>
              </Link>
              <div className={groupRowActionsClass}>{actions?.(player)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function GroupLogo({ group }: { group: Pick<GroupDetail, 'tag' | 'logoUrl'> }) {
  if (group.logoUrl) return <img className={groupLogoImageClass(true)} src={group.logoUrl} alt="" />
  return <span className={groupLogoFallbackClass(true)}>{group.tag.slice(0, 2)}</span>
}

function groupTagStyle(tagColor?: string): CSSProperties | undefined {
  return tagColor ? ({ '--group-tag-color': tagColor } as CSSProperties) : undefined
}
