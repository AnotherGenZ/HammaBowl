import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { PlayerRatingSummary } from '../lib/types'

type PlayerTableSort = 'name-asc' | 'name-desc' | 'rating-asc' | 'rating-desc'

export function PlayerTable({ rows }: { rows: PlayerRatingSummary[] }) {
  const [sort, setSort] = useState<PlayerTableSort>('name-asc')
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const nameComparison = a.player.name.localeCompare(b.player.name, undefined, {
          sensitivity: 'base',
        })

        if (sort === 'name-asc') return nameComparison
        if (sort === 'name-desc') return -nameComparison

        const aHasRating = a.isCaptain || a.ratingCount > 0
        const bHasRating = b.isCaptain || b.ratingCount > 0
        if (aHasRating !== bHasRating) return aHasRating ? -1 : 1
        if (!aHasRating || !bHasRating) return nameComparison

        const aRating = a.isCaptain ? 11 : a.averageRating
        const bRating = b.isCaptain ? 11 : b.averageRating
        const ratingComparison = aRating - bRating
        if (ratingComparison === 0) return nameComparison
        return sort === 'rating-asc' ? ratingComparison : -ratingComparison
      }),
    [rows, sort],
  )

  const nextNameSort = sort === 'name-desc' ? 'name-asc' : 'name-desc'
  const nextRatingSort = sort === 'rating-desc' ? 'rating-asc' : 'rating-desc'

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th aria-sort={sort === 'name-asc' ? 'ascending' : sort === 'name-desc' ? 'descending' : 'none'}>
              <button type="button" className="table-sort-button" onClick={() => setSort(nextNameSort)}>
                Player {sort === 'name-asc' ? '↑' : sort === 'name-desc' ? '↓' : ''}
              </button>
            </th>
            <th
              aria-sort={sort === 'rating-asc' ? 'ascending' : sort === 'rating-desc' ? 'descending' : 'none'}
            >
              <button type="button" className="table-sort-button" onClick={() => setSort(nextRatingSort)}>
                Average rating {sort === 'rating-asc' ? '↑' : sort === 'rating-desc' ? '↓' : ''}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.player.id}>
              <td>
                <Link to="/players/$discordId" params={{ discordId: row.player.id }}>
                  <strong>{row.player.name}</strong>
                </Link>
              </td>
              <td>
                {row.isCaptain ? (
                  <span aria-label="Team captain" title="Team captain">
                    👑
                  </span>
                ) : row.ratingCount ? (
                  row.averageRating.toFixed(2)
                ) : (
                  'TBD'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
