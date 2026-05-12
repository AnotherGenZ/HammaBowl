import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { pageMeta } from '../lib/meta'
import { isCaptainPlayer } from '../lib/rules'
import { useSession } from '../lib/SessionContext'
import type { HammaEvent } from '../lib/types'
import { PlayerName } from '../components/PlayerName'

type RatingsSortMode = 'name' | 'rating-desc' | 'rating-asc'
type InitialRating = { toDiscordId: string; score: number }

const RATINGS_PREFERENCES_PREFIX = 'hammabowl:ratings-preferences'
const RATINGS_SORT_MODES = new Set<RatingsSortMode>(['name', 'rating-desc', 'rating-asc'])
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const loadRatingsPage = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDiscordSessionUser } = await import('../lib/discord.server')
  const { getRatingsByRater, isEventParticipant } = await import('../lib/db.server')
  const { getCurrentEvent } = await import('../lib/services')

  const user = await getDiscordSessionUser()
  const event = await getCurrentEvent()

  if (!user) throw redirect({ to: '/' })
  if (user && !user.profileComplete) throw redirect({ to: '/settings' })

  if (!user.roles.includes('admin') && (!event || !isEventParticipant(event.id, user.id))) {
    throw redirect({ to: '/' })
  }

  const initialSelectedRaterId = event ? selectInitialRaterId(event, user) : ''

  return {
    event,
    initialSelectedRaterId,
    initialRatings: event && initialSelectedRaterId
      ? getRatingsByRater(event.id, initialSelectedRaterId)
      : [],
    loadedAt: Date.now(),
  }
})

export const Route = createFileRoute('/ratings')({
  loader: async () => {
    return loadRatingsPage()
  },
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData?.event ? `${loaderData.event.name} Ratings` : 'Ratings',
      description: loaderData?.event
        ? `Private rating page for ${loaderData.event.name} participants.`
        : 'Private HammaBowl participant rating page.',
      path: '/ratings',
      noIndex: true,
    }),
  component: Ratings,
})

function Ratings() {
  const { event, initialRatings, initialSelectedRaterId, loadedAt } = Route.useLoaderData()
  const { user } = useSession()
  const [ratings, setRatings] = useState<Record<string, number>>(() => ratingsFromList(initialRatings))
  const [ratingsLoaded, setRatingsLoaded] = useState(Boolean(initialSelectedRaterId))
  const [loadedRatingsKey, setLoadedRatingsKey] = useState(
    event && initialSelectedRaterId ? ratingsKey(event.id, initialSelectedRaterId) : undefined,
  )
  const [saving, setSaving] = useState<string>()
  const [sortMode, setSortMode] = useState<RatingsSortMode>('name')
  const [message, setMessage] = useState<{ text: string; tone: 'neutral' | 'success' | 'error' }>()
  const initialPreferencesKey = event && user && initialSelectedRaterId
    ? `${RATINGS_PREFERENCES_PREFIX}:${event.id}:${user.id}`
    : undefined
  const [loadedPreferencesKey, setLoadedPreferencesKey] = useState<string | undefined>(initialPreferencesKey)
  const ratingListRef = useRef<HTMLDivElement>(null)
  const pendingRatingScrollPosition = useRef<{
    anchorId?: string
    anchorTop?: number
    listTop: number
    windowX: number
    windowY: number
  } | undefined>(undefined)

  const isAdmin = Boolean(user?.roles.includes('admin'))
  const canRate = user?.roles.some((role) => role === 'participant' || role === 'admin')
  const ratingsLocked = Boolean(event && !isAdmin && hasDraftStarted(event, loadedAt))
  const preferencesKey = event && user
    ? `${RATINGS_PREFERENCES_PREFIX}:${event.id}:${user.id}`
    : undefined
  const preferencesLoaded = Boolean(preferencesKey && loadedPreferencesKey === preferencesKey)
  const raterOptions = useMemo(
    () => {
      const submittedRaterIds = new Set(event?.ratings.map((rating) => rating.fromPlayerId) ?? [])
      const currentUserId = user?.id

      return (event?.players ?? [])
        .filter((player) => {
          if (player.id === currentUserId) return true
          return submittedRaterIds.has(player.id)
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    },
    [event, user],
  )
  const [selectedRaterId, setSelectedRaterId] = useState(initialSelectedRaterId)
  const players = useMemo(
    () =>
      event?.players.filter(
        (player) => player.id !== selectedRaterId && !isCaptainPlayer(event, player.id),
      ) ?? [],
    [event, selectedRaterId],
  )
  const selectedRater = useMemo(
    () => raterOptions.find((player) => player.id === selectedRaterId),
    [raterOptions, selectedRaterId],
  )
  const showingOtherRaterSubmissions = Boolean(
    isAdmin && user && selectedRaterId && selectedRaterId !== user.id,
  )

  const ratedCount = useMemo(
    () => players.filter((p) => ratings[p.id] !== undefined).length,
    [players, ratings],
  )

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const nameComparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      if (sortMode === 'name') return nameComparison

      const aRating = ratings[a.id]
      const bRating = ratings[b.id]
      const aIsRated = aRating !== undefined
      const bIsRated = bRating !== undefined

      if (aIsRated !== bIsRated) return aIsRated ? -1 : 1
      if (!aIsRated || !bIsRated) return nameComparison

      const ratingComparison = aRating - bRating
      if (ratingComparison === 0) return nameComparison

      return sortMode === 'rating-asc' ? ratingComparison : -ratingComparison
    })
  }, [players, ratings, sortMode])

  useBrowserLayoutEffect(() => {
    if (!pendingRatingScrollPosition.current) return

    const { anchorId, anchorTop, listTop, windowX, windowY } = pendingRatingScrollPosition.current
    pendingRatingScrollPosition.current = undefined
    restoreRatingScrollPosition({ anchorId, anchorTop, listTop, windowX, windowY })
    requestAnimationFrame(() => restoreRatingScrollPosition({ anchorId, anchorTop, listTop, windowX, windowY }))
  }, [sortedPlayers])

  useEffect(() => {
    if (!preferencesKey) {
      setLoadedPreferencesKey(undefined)
      return
    }

    const storedPreferences = readRatingsPreferences(preferencesKey)
    setSortMode(storedPreferences.sortMode)
    setSelectedRaterId((current) => current || (user?.id ?? ''))
    setLoadedPreferencesKey(preferencesKey)
  }, [preferencesKey, user?.id])

  useEffect(() => {
    if (!preferencesLoaded) return

    if (!user) {
      setSelectedRaterId('')
      return
    }

    if (!isAdmin) {
      setSelectedRaterId(user.id)
      return
    }

    if (!raterOptions.length) {
      setSelectedRaterId('')
      return
    }

    if (!raterOptions.some((player) => player.id === selectedRaterId)) {
      const defaultRaterId = raterOptions.some((player) => player.id === user.id)
        ? user.id
        : raterOptions[0].id
      setSelectedRaterId(defaultRaterId)
    }
  }, [isAdmin, preferencesLoaded, raterOptions, selectedRaterId, user])

  useEffect(() => {
    if (!preferencesLoaded || !preferencesKey) return

    localStorage.setItem(
      preferencesKey,
      JSON.stringify({ sortMode }),
    )
  }, [preferencesKey, preferencesLoaded, sortMode])

  useEffect(() => {
    if (!event || !canRate || !preferencesLoaded) {
      setRatings({})
      setRatingsLoaded(false)
      setLoadedRatingsKey(undefined)
      return
    }

    if (!selectedRaterId) {
      setRatings({})
      setRatingsLoaded(Boolean(user))
      setLoadedRatingsKey(undefined)
      return
    }

    const nextRatingsKey = ratingsKey(event.id, selectedRaterId)
    if (loadedRatingsKey === nextRatingsKey) return

    let active = true
    setRatingsLoaded(false)
    const params = isAdmin ? `?fromDiscordId=${encodeURIComponent(selectedRaterId)}` : ''
    fetch(`/api/ratings${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text())
        return response.json() as Promise<{
          ratings: Array<{ toDiscordId: string; score: number }>
        }>
      })
      .then((payload) => {
        if (!active) return
        setRatings(
          Object.fromEntries(
            payload.ratings.map((rating) => [rating.toDiscordId, rating.score]),
          ),
        )
        setLoadedRatingsKey(nextRatingsKey)
        setRatingsLoaded(true)
      })
      .catch((error) => {
        if (active) {
          setMessage({ text: error instanceof Error ? error.message : 'Unable to load ratings.', tone: 'error' })
          setRatingsLoaded(true)
        }
      })

    return () => {
      active = false
    }
  }, [event, canRate, isAdmin, loadedRatingsKey, preferencesLoaded, selectedRaterId, user])

  async function rate(toDiscordId: string, score: number) {
    setSaving(toDiscordId)
    setMessage(undefined)
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDiscordId: selectedRaterId, toDiscordId, score }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      preserveRatingScrollPosition(toDiscordId)
      setRatings((current) => ({ ...current, [toDiscordId]: score }))
      setMessage({ text: result.message ?? 'Rating saved.', tone: 'success' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Rating failed.', tone: 'error' })
    } finally {
      setSaving(undefined)
    }
  }

  async function clearRating(toDiscordId: string) {
    setSaving(toDiscordId)
    setMessage(undefined)
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDiscordId: selectedRaterId, toDiscordId, score: null }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      preserveRatingScrollPosition(toDiscordId)
      setRatings((current) => {
        const next = { ...current }
        delete next[toDiscordId]
        return next
      })
      setMessage({ text: result.message ?? 'Rating cleared.', tone: 'success' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Rating failed.', tone: 'error' })
    } finally {
      setSaving(undefined)
    }
  }

  function preserveRatingScrollPosition(changedPlayerId: string) {
    const anchor = getRatingListScrollAnchor(changedPlayerId)

    pendingRatingScrollPosition.current = {
      anchorId: anchor?.id,
      anchorTop: anchor?.top,
      listTop: ratingListRef.current?.scrollTop ?? 0,
      windowX: window.scrollX,
      windowY: window.scrollY,
    }
  }

  function restoreRatingScrollPosition({
    anchorId,
    anchorTop,
    listTop,
    windowX,
    windowY,
  }: {
    anchorId?: string
    anchorTop?: number
    listTop: number
    windowX: number
    windowY: number
  }) {
    if (ratingListRef.current) {
      ratingListRef.current.scrollTop = listTop

      if (anchorId && anchorTop !== undefined) {
        const anchor = ratingListRef.current.querySelector<HTMLElement>(
          `[data-player-id="${window.CSS.escape(anchorId)}"]`,
        )

        if (anchor) {
          ratingListRef.current.scrollTop += anchor.getBoundingClientRect().top - anchorTop
        }
      }
    }
    window.scrollTo(windowX, windowY)
  }

  function getRatingListScrollAnchor(changedPlayerId: string) {
    const list = ratingListRef.current
    if (!list) return undefined

    const listTop = list.getBoundingClientRect().top
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-player-id]'))

    for (const row of rows) {
      if (row.dataset.playerId === changedPlayerId) continue

      const rowRect = row.getBoundingClientRect()
      if (rowRect.bottom <= listTop) continue

      return {
        id: row.dataset.playerId,
        top: rowRect.top,
      }
    }

    return undefined
  }

  return (
    <main className="ratings-page min-w-0">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h1>Rate known players</h1>
          </div>
          <div className="rating-header-actions">
            {ratingsLoaded && players.length ? (
              <span className="count-chip">
                {ratedCount}/{players.length} rated
              </span>
            ) : null}
            <label className="rating-rater-select">
              <span>Ratings by</span>
              <select
                value={selectedRaterId}
                disabled={!isAdmin || !raterOptions.length}
                onChange={(event) => setSelectedRaterId(event.currentTarget.value)}
              >
                {isAdmin ? (
                  raterOptions.length ? (
                    raterOptions.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.groupTag ? `[${player.groupTag}] ${player.name}` : player.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No raters available</option>
                  )
                ) : (
                  <option value={user?.id ?? ''}>
                    {user ? (user.groupTag ? `[${user.groupTag}] ${user.name}` : user.name) : 'Discord login required'}
                  </option>
                )}
              </select>
            </label>
          </div>
        </div>
        {!event ? (
          <div className="empty-inline">
            Ratings will be available once an active HammaBowl event is selected.
          </div>
        ) : null}
        {message ? (
          <div className={`toast toast-${message.tone}`} role="status" aria-live="polite">
            {message.text}
          </div>
        ) : null}
        {showingOtherRaterSubmissions ? (
          <div className="rating-admin-warning" role="alert">
            You are viewing and editing {selectedRater?.name ?? 'another rater'}'s submissions, not your own.
          </div>
        ) : null}
        {ratingsLocked ? (
          <div className="toast toast-neutral" role="status">
            Ratings are locked because the draft has started.
          </div>
        ) : null}
        {event && canRate ? (
          <>
            <div className="rating-legend">
              <p className="rating-legend-title">Rating guide</p>
              <div className="rating-legend-scale">
                <span><strong>1-3</strong> Below average</span>
                <span><strong>4-6</strong> Average</span>
                <span><strong>7-9</strong> Above average</span>
                <span><strong>10</strong> Exceptional</span>
              </div>
              <p className="rating-legend-note">
                Only rate players you have played with. Leave unknown players unrated. Do not troll,
                coordinate, or otherwise attempt to manipulate ratings.
              </p>
            </div>
            <div className="rating-list-toolbar" aria-label="Rating list controls">
              <span>Sort by</span>
              <div className="rating-sort-control" role="group" aria-label="Sort players">
                <button
                  type="button"
                  className={sortMode === 'name' ? 'active' : undefined}
                  aria-pressed={sortMode === 'name'}
                  onClick={() => setSortMode('name')}
                >
                  A-Z
                </button>
                <button
                  type="button"
                  className={sortMode === 'rating-desc' ? 'active' : undefined}
                  aria-pressed={sortMode === 'rating-desc'}
                  onClick={() => setSortMode('rating-desc')}
                >
                  High-Low
                </button>
                <button
                  type="button"
                  className={sortMode === 'rating-asc' ? 'active' : undefined}
                  aria-pressed={sortMode === 'rating-asc'}
                  onClick={() => setSortMode('rating-asc')}
                >
                  Low-High
                </button>
              </div>
            </div>
            <div className="rating-list" ref={ratingListRef}>
              {sortedPlayers.map((player) => {
                const hasRating = ratings[player.id] !== undefined
                return (
                  <article
                    className="rating-row"
                    data-player-id={player.id}
                    data-rating-state={ratingsLoaded && !hasRating ? 'unrated' : 'rated'}
                    key={player.id}
                  >
                    <Link to="/players/$discordId" params={{ discordId: player.id }}>
                      <strong>
                        <PlayerName name={player.name} groupTag={player.groupTag} groupTagColor={player.groupTagColor} />
                      </strong>
                    </Link>
                    <div className="rating-controls">
                      {saving === player.id ? <span className="spinner" aria-label="Saving" /> : null}
                      <div
                        className="rating-score-picker"
                        role="group"
                        aria-label={`Rate ${player.name}`}
                      >
                        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                          <button
                            type="button"
                            className={ratings[player.id] === score ? 'active' : undefined}
                            disabled={ratingsLocked || saving === player.id}
                            aria-pressed={ratings[player.id] === score}
                            onClick={(event) => {
                              event.currentTarget.blur()

                              if (ratings[player.id] === score) {
                                void clearRating(player.id)
                                return
                              }

                              void rate(player.id, score)
                            }}
                            key={score}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        ) : event ? (
          <div className="empty-inline">
            You must be an accepted participant in the current event to rate players.
          </div>
        ) : null}
      </section>
    </main>
  )
}

function selectInitialRaterId(event: HammaEvent, user: { id: string; roles: string[] }) {
  if (!user.roles.includes('admin')) return user.id

  const submittedRaterIds = new Set(event.ratings.map((rating) => rating.fromPlayerId))
  const raterOptions = event.players
    .filter((player) => player.id === user.id || submittedRaterIds.has(player.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return raterOptions.some((player) => player.id === user.id)
    ? user.id
    : raterOptions[0]?.id ?? ''
}

function ratingsFromList(ratings: InitialRating[]) {
  return Object.fromEntries(ratings.map((rating) => [rating.toDiscordId, rating.score]))
}

function ratingsKey(eventId: string, selectedRaterId: string) {
  return `${eventId}:${selectedRaterId}`
}

function hasDraftStarted(event: HammaEvent, now = Date.now()) {
  if (event.phase === 'draft' || event.phase === 'locked' || event.phase === 'complete') return true
  if (event.activeDraftBid || event.draftPicks.length || event.rounds.length) return true

  if (typeof event.draftStartMinutesBefore === 'number') {
    const startTime = Date.parse(event.startsAt)
    if (Number.isFinite(startTime)) {
      return now >= startTime - event.draftStartMinutesBefore * 60_000
    }
  }

  return false
}

function readRatingsPreferences(preferencesKey: string): {
  sortMode: RatingsSortMode
} {
  const fallback: { sortMode: RatingsSortMode } = {
    sortMode: 'name',
  }

  try {
    const storedValue = localStorage.getItem(preferencesKey)
    if (!storedValue) return fallback

    const parsed = JSON.parse(storedValue) as Partial<{ sortMode: unknown }>

    return {
      sortMode: RATINGS_SORT_MODES.has(parsed.sortMode as RatingsSortMode)
        ? parsed.sortMode as RatingsSortMode
        : fallback.sortMode,
    }
  } catch {
    return fallback
  }
}
