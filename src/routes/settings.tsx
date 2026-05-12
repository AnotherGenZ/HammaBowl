import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { PlayerName } from '../components/PlayerName'
import { pageMeta } from '../lib/meta'
import { PROFILE_BANNERS } from '../lib/profileBanners'
import { useSession } from '../lib/SessionContext'
import {
  badgeOrderActionsClass,
  badgeSettingsClass,
  badgeSettingsListClass,
  badgeSettingsRowClass,
  bannerChoiceClass,
  bannerPickerClass,
  eyebrowClass,
  infoListClass,
  toastClass,
  type ToastTone,
} from '../lib/ui'
import type { Faction, PlayerBadge, PlayerCharacter } from '../lib/types'

const FACTIONS: Faction[] = ['TR', 'VS', 'NC']
const DEFAULT_BANNER = PROFILE_BANNERS[0]?.src ?? ''
type SettingsMessage = { text: string; tone: ToastTone }

const loadPlayerSettings = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDiscordSessionUser } = await import('../lib/discord.server')
  const user = await getDiscordSessionUser()
  if (!user) throw redirect({ href: '/api/auth/discord' })
  const { getPlayerSettings } = await import('../lib/db.server')
  return getPlayerSettings(user.id)
})

export const Route = createFileRoute('/settings')({
  loader: () => loadPlayerSettings(),
  head: () =>
    pageMeta({
      title: 'Player Settings',
      description: 'Customize your HammaBowl player profile and linked Jaeger characters.',
      path: '/settings',
      noIndex: true,
    }),
  component: Settings,
})

function Settings() {
  const initialProfile = Route.useLoaderData()
  const { refreshSession } = useSession()
  const [bannerUrl, setBannerUrl] = useState(initialProfile.bannerUrl || DEFAULT_BANNER)
  const [catchphrase, setCatchphrase] = useState(initialProfile.catchphrase)
  const [characters, setCharacters] = useState(
    Object.fromEntries(FACTIONS.map((faction) => [faction, characterName(initialProfile.characters, faction)])) as Record<
      Faction,
      string
    >,
  )
  const [noPersonalJaegerAccount, setNoPersonalJaegerAccount] = useState(initialProfile.noPersonalJaegerAccount)
  const [resolvedCharacters, setResolvedCharacters] = useState(initialProfile.characters)
  const [badgeDisplayOrder, setBadgeDisplayOrder] = useState(initialProfile.badgeDisplayOrder)
  const [message, setMessage] = useState<SettingsMessage | null>(
    initialProfile.complete
      ? null
      : {
          text: 'Add your TR, VS, and NC Jaeger characters, or mark that you need an event assignment.',
          tone: 'neutral',
        },
  )
  const [saving, setSaving] = useState<'profile' | 'characters' | null>(null)
  const jaegerReady = noPersonalJaegerAccount || FACTIONS.every((faction) =>
    resolvedCharacters.some((character) => character.faction === faction),
  )

  async function saveProfile() {
    setSaving('profile')
    setMessage(null)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerUrl, catchphrase, noPersonalJaegerAccount, badgeDisplayOrder }),
      })
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json() as { profile: { bannerUrl?: string } }
      setBannerUrl(payload.profile.bannerUrl || DEFAULT_BANNER)
      setMessage({ text: 'Profile saved.', tone: 'success' })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to save profile.',
        tone: 'error',
      })
    } finally {
      setSaving(null)
    }
  }

  async function saveJaegerPreference() {
    setSaving('characters')
    setMessage(null)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noPersonalJaegerAccount }),
      })
      if (!response.ok) throw new Error(await response.text())
      await refreshSession()
      setMessage({
        text: noPersonalJaegerAccount ? 'Jaeger account status saved.' : 'Jaeger account status cleared.',
        tone: 'success',
      })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to save Jaeger status.',
        tone: 'error',
      })
    } finally {
      setSaving(null)
    }
  }

  async function resolveCharacters() {
    setSaving('characters')
    setMessage(null)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characters),
      })
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json() as { resolved: PlayerCharacter[] }
      await refreshSession()
      setResolvedCharacters(payload.resolved)
      setMessage({ text: 'Characters resolved and saved.', tone: 'success' })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to resolve characters.',
        tone: 'error',
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
      <section className="event-hero compact-hero">
        <div>
          <p className={eyebrowClass}>Player settings</p>
          <h1>
            <PlayerName
              name={initialProfile.name}
              groupTag={initialProfile.groupTag}
              groupTagColor={initialProfile.groupTagColor}
            />
          </h1>
          <div className="meta-row mt-[18px] flex flex-wrap items-center gap-2.5 [&_a]:rounded-full [&_a]:border [&_a]:border-[#e4b45e]/40 [&_a]:bg-white/[0.08] [&_a]:px-3 [&_a]:py-2 [&_a]:font-black [&_a]:text-[#f4d59a] [&_a]:transition-colors [&_a:hover]:bg-[#e4b45e]/[0.20] [&_span]:rounded-full [&_span]:border [&_span]:border-white/[0.08] [&_span]:bg-white/[0.08] [&_span]:px-3 [&_span]:py-2 [&_span]:text-[#d8dedc] max-[1023px]:max-w-full max-[720px]:[&_a]:w-fit max-[720px]:[&_span]:w-fit">
            <Link to="/players/$discordId" params={{ discordId: initialProfile.discordId }}>
              View profile
            </Link>
          </div>
        </div>
      </section>

      {message ? (
        <div className={toastClass(message.tone)} role="status" aria-live="polite">
          {message.text}
        </div>
      ) : null}

      <section className="settings-grid grid min-w-0 grid-cols-2 gap-[18px] max-[720px]:grid-cols-1 [&>.panel]:mt-0">
        <article className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  settings-panel grid content-start gap-3.5 [&_label]:grid [&_label]:gap-[7px] [&_label]:text-[0.78rem] [&_label]:font-black [&_label]:uppercase [&_label]:text-[#b4bcbb] [&_input]:min-h-[42px] [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.18] [&_input]:bg-[#121417] [&_input]:px-3 [&_input]:text-base [&_input]:font-bold [&_input]:normal-case [&_input]:text-[#f4f0e8] [&_input]:transition-colors [&_.checkbox-field]:grid-cols-[auto_minmax(0,1fr)] [&_.checkbox-field]:items-center [&_.checkbox-field]:normal-case [&_.checkbox-field]:text-[#d8dedc] [&_.checkbox-field_input]:w-[18px] [&_.checkbox-field_input]:min-h-[18px]">
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <div>
              <h2>Jaeger characters</h2>
            </div>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={noPersonalJaegerAccount}
              onChange={(event) => setNoPersonalJaegerAccount(event.currentTarget.checked)}
            />
            I do not have a personal Jaeger account
          </label>
          {noPersonalJaegerAccount ? (
            <>
              <p>Admins can assign you a Jaeger character for each event after you sign up.</p>
              <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55" disabled={saving === 'characters'} onClick={() => void saveJaegerPreference()}>
                {saving === 'characters' ? <span className="spinner" aria-label="Saving" /> : null}
                Save Jaeger status
              </button>
            </>
          ) : (
            <>
              {FACTIONS.map((faction) => (
                <label key={faction}>
                  {faction} character
                  <input
                    value={characters[faction]}
                    onChange={(event) =>
                      setCharacters((current) => ({ ...current, [faction]: event.target.value }))
                    }
                  />
                </label>
              ))}
              <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55" disabled={saving === 'characters'} onClick={() => void resolveCharacters()}>
                {saving === 'characters' ? <span className="spinner" aria-label="Saving" /> : null}
                Resolve and save
              </button>
              {resolvedCharacters.length ? (
                <div className={infoListClass}>
                  {resolvedCharacters.map((character) => (
                    <span key={character.faction}>
                      <strong>{character.faction}</strong> {character.characterName} #{character.characterId}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </article>

        <article className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  settings-panel grid content-start gap-3.5 [&_label]:grid [&_label]:gap-[7px] [&_label]:text-[0.78rem] [&_label]:font-black [&_label]:uppercase [&_label]:text-[#b4bcbb] [&_input]:min-h-[42px] [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.18] [&_input]:bg-[#121417] [&_input]:px-3 [&_input]:text-base [&_input]:font-bold [&_input]:normal-case [&_input]:text-[#f4f0e8] [&_input]:transition-colors [&_.checkbox-field]:grid-cols-[auto_minmax(0,1fr)] [&_.checkbox-field]:items-center [&_.checkbox-field]:normal-case [&_.checkbox-field]:text-[#d8dedc] [&_.checkbox-field_input]:w-[18px] [&_.checkbox-field_input]:min-h-[18px]">
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <div>
              <h2>Profile</h2>
            </div>
          </div>
          {!jaegerReady ? (
            <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">Complete the Jaeger section before customizing your profile.</div>
          ) : null}
          <div>
            <h3>Banner</h3>
          </div>
          <div className={bannerPickerClass} aria-disabled={!jaegerReady}>
            {PROFILE_BANNERS.map((banner) => (
              <label key={banner.id} className={bannerChoiceClass} data-selected={bannerUrl === banner.src}>
                <input
                  type="radio"
                  name="profile-banner"
                  disabled={!jaegerReady}
                  checked={bannerUrl === banner.src}
                  onChange={() => setBannerUrl(banner.src)}
                />
                <img src={banner.src} alt="" />
                <span>{banner.name}</span>
              </label>
            ))}
          </div>
          <label>
            Catchphrase
            <input
              disabled={!jaegerReady}
              maxLength={140}
              value={catchphrase}
              onChange={(event) => setCatchphrase(event.target.value)}
            />
          </label>
          <div className={badgeSettingsClass}>
            <div>
              <h3>Shown badges</h3>
            </div>
            {initialProfile.badges.length ? (
              <div className={badgeSettingsListClass}>
                {orderedBadgeChoices(initialProfile.badges, badgeDisplayOrder).map((badge) => {
                  const selected = badgeDisplayOrder.includes(badge.id)
                  return (
                    <article className={badgeSettingsRowClass} key={badge.id} data-selected={selected}>
                      <label className="checkbox-field">
                        <input
                          disabled={!jaegerReady}
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked
                            setBadgeDisplayOrder((current) =>
                              checked
                                ? [...current, badge.id]
                                : current.filter((badgeId) => badgeId !== badge.id),
                            )
                          }}
                        />
                        <span>
                          <strong>{badge.name}</strong>
                          <small>{badge.description}</small>
                        </span>
                      </label>
                      <div className={badgeOrderActionsClass}>
                        <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
                          type="button"
                          disabled={!jaegerReady || !selected || badgeDisplayOrder.indexOf(badge.id) <= 0}
                          onClick={() => setBadgeDisplayOrder((current) => moveBadge(current, badge.id, -1))}
                        >
                          Up
                        </button>
                        <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
                          type="button"
                          disabled={
                            !jaegerReady ||
                            !selected ||
                            badgeDisplayOrder.indexOf(badge.id) === -1 ||
                            badgeDisplayOrder.indexOf(badge.id) >= badgeDisplayOrder.length - 1
                          }
                          onClick={() => setBadgeDisplayOrder((current) => moveBadge(current, badge.id, 1))}
                        >
                          Down
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">No badges earned yet.</div>
            )}
          </div>
          <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55" disabled={saving === 'profile' || !jaegerReady} onClick={() => void saveProfile()}>
            {saving === 'profile' ? <span className="spinner" aria-label="Saving" /> : null}
            Save profile
          </button>
        </article>
      </section>
    </main>
  )
}

function characterName(characters: PlayerCharacter[], faction: Faction) {
  return characters.find((character) => character.faction === faction)?.characterName ?? ''
}

function orderedBadgeChoices(badges: PlayerBadge[], selectedIds: string[]) {
  const badgeById = new Map(badges.map((badge) => [badge.id, badge]))
  const selected = selectedIds.flatMap((badgeId) => {
    const badge = badgeById.get(badgeId)
    return badge ? [badge] : []
  })
  const unselected = badges.filter((badge) => !selectedIds.includes(badge.id))
  return [...selected, ...unselected]
}

function moveBadge(badgeIds: string[], badgeId: string, direction: -1 | 1) {
  const index = badgeIds.indexOf(badgeId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= badgeIds.length) return badgeIds

  const next = [...badgeIds]
  const [removed] = next.splice(index, 1)
  next.splice(nextIndex, 0, removed)
  return next
}
