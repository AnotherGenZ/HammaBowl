import type { CSSProperties } from 'react'
import { playerGroupTagClass, playerNameWithGroupClass } from '../lib/ui'

interface PlayerNameProps {
  name: string
  groupTag?: string
  groupTagColor?: string
  className?: string
}

export function PlayerName({ name, groupTag, groupTagColor, className }: PlayerNameProps) {
  const tagStyle = groupTagColor ? ({ '--group-tag-color': groupTagColor } as CSSProperties) : undefined

  return (
    <span className={className ? `${playerNameWithGroupClass} ${className}` : playerNameWithGroupClass}>
      {groupTag ? (
        <span className={playerGroupTagClass} style={tagStyle}>
          {groupTag}
        </span>
      ) : null}
      <span>{name}</span>
    </span>
  )
}
