import type { CSSProperties } from 'react'

interface PlayerNameProps {
  name: string
  groupTag?: string
  groupTagColor?: string
  className?: string
}

export function PlayerName({ name, groupTag, groupTagColor, className }: PlayerNameProps) {
  const tagStyle = groupTagColor ? ({ '--group-tag-color': groupTagColor } as CSSProperties) : undefined

  return (
    <span className={className ? `player-name-with-group ${className}` : 'player-name-with-group'}>
      {groupTag ? (
        <span className="player-group-tag" style={tagStyle}>
          {groupTag}
        </span>
      ) : null}
      <span>{name}</span>
    </span>
  )
}
