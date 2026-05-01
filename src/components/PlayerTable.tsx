import type { PlayerSalary } from '../lib/types'

export function PlayerTable({ rows }: { rows: PlayerSalary[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Average rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.player.id}>
              <td>
                <strong>{row.player.name}</strong>
              </td>
              <td>{row.ratingCount ? row.averageRating.toFixed(2) : 'TBD'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
