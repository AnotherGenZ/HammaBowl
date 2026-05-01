import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { pageMeta } from '../lib/meta'
import { isCaptainPlayer } from '../lib/rules'
import { getCurrentEvent } from '../lib/services'
import type { Role } from '../lib/types'

export const Route = createFileRoute('/ratings')({
  loader: () => getCurrentEvent(),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData ? `${loaderData.name} Ratings` : 'Ratings',
      description: loaderData
        ? `Private rating page for ${loaderData.name} participants.`
        : 'Private HammaBowl participant rating page.',
      path: '/ratings',
      noIndex: true,
    }),
  component: Ratings,
})

interface SessionUser {
  id: string
  name: string
  roles: Role[]
}

function Ratings() {
  const event = Route.useLoaderData()
  const [user, setUser] = useState<SessionUser | null>()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [ratingsLoaded, setRatingsLoaded] = useState(false)
  const [saving, setSaving] = useState<string>()
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    let active = true
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((payload: { user: SessionUser | null }) => {
        if (active) setUser(payload.user)
      })
      .catch(() => {
        if (active) setUser(null)
      })

    return () => {
      active = false
    }
  }, [])

  const canRate = user?.roles.some((role) => role === 'participant' || role === 'admin')
  const players =
    event?.players.filter(
      (player) => player.id !== user?.id && !isCaptainPlayer(event, player.id),
    ) ?? []

  useEffect(() => {
    if (!event || !canRate) {
      setRatings({})
      setRatingsLoaded(false)
      return
    }

    let active = true
    setRatingsLoaded(false)
    fetch('/api/ratings')
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
        setRatingsLoaded(true)
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Unable to load ratings.')
          setRatingsLoaded(true)
        }
      })

    return () => {
      active = false
    }
  }, [event, canRate])

  async function rate(toDiscordId: string, score: number) {
    setSaving(toDiscordId)
    setMessage(undefined)
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toDiscordId, score }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setRatings((current) => ({ ...current, [toDiscordId]: score }))
      setMessage(result.message ?? 'Rating saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rating failed.')
    } finally {
      setSaving(undefined)
    }
  }

  return (
    <main>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h1>Rate known players</h1>
          </div>
          <span className="pill">{user ? user.name : 'Discord login required'}</span>
        </div>
        {!event ? (
          <div className="empty-inline">
            Ratings will be available once Raid Helper has a current HammaBowl event.
          </div>
        ) : null}
        <div
          className="admin-result ratings-result"
          aria-live="polite"
          aria-hidden={!message}
          data-visible={message ? 'true' : 'false'}
        >
          {message ?? ' '}
        </div>
        {event && !canRate ? (
          <div className="empty-inline">
            You must be an accepted participant in the current event to rate players.
          </div>
        ) : event ? (
          <div className="rating-list">
            {players.map((player) => {
              const hasRating = ratings[player.id] !== undefined
              return (
                <article
                  className="rating-row"
                  data-rating-state={ratingsLoaded && !hasRating ? 'unrated' : 'rated'}
                  key={player.id}
                >
                  <strong>{player.name}</strong>
                  <select
                    value={ratings[player.id]?.toString() ?? ''}
                    disabled={saving === player.id}
                    aria-label={`Rate ${player.name}`}
                    onChange={(event) => {
                      const score = Number(event.currentTarget.value)
                      if (score) void rate(player.id, score)
                    }}
                  >
                    <option value="" disabled>
                      Rate
                    </option>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                      <option value={score} key={score}>
                        {score}
                      </option>
                    ))}
                  </select>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </main>
  )
}
