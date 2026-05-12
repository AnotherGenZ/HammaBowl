import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { PlayerRatingSummary } from '../lib/types'
import { responsivePlayerTableClass } from '../lib/ui'
import { PlayerName } from './PlayerName'

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
    <div className={responsivePlayerTableClass}>
      <table>
        <thead>
          <tr>
            <th aria-sort={sort === 'name-asc' ? 'ascending' : sort === 'name-desc' ? 'descending' : 'none'}>
              <button type="button" className="inline-flex min-h-7 items-center justify-start rounded-md border border-transparent bg-transparent px-2 font-[inherit] text-[0.72rem] font-black uppercase text-[#8a9896] transition-colors -ml-2 hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white focus-visible:border-white/[0.14] focus-visible:bg-white/[0.08] focus-visible:text-white focus-visible:outline-0" onClick={() => setSort(nextNameSort)}>
                Player {sort === 'name-asc' ? '↑' : sort === 'name-desc' ? '↓' : ''}
              </button>
            </th>
            <th
              aria-sort={sort === 'rating-asc' ? 'ascending' : sort === 'rating-desc' ? 'descending' : 'none'}
            >
              <button type="button" className="inline-flex min-h-7 items-center justify-start rounded-md border border-transparent bg-transparent px-2 font-[inherit] text-[0.72rem] font-black uppercase text-[#8a9896] transition-colors -ml-2 hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white focus-visible:border-white/[0.14] focus-visible:bg-white/[0.08] focus-visible:text-white focus-visible:outline-0" onClick={() => setSort(nextRatingSort)}>
                Average rating {sort === 'rating-asc' ? '↑' : sort === 'rating-desc' ? '↓' : ''}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.player.id}>
              <td data-label="Player">
                <Link to="/players/$discordId" params={{ discordId: row.player.id }}>
                  <strong>
                    <PlayerName
                      name={row.player.name}
                      groupTag={row.player.groupTag}
                      groupTagColor={row.player.groupTagColor}
                    />
                  </strong>
                </Link>
              </td>
              <td data-label="Average rating">
                {row.isCaptain ? (
                  <span aria-label="Team captain" title="Team captain">
                    👑
                  </span>
                ) : row.ratingCount ? (
                  row.averageRating.toFixed(2)
                ) : (
                  'UNRATED'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
