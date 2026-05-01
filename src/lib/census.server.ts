import '@tanstack/react-start/server-only'

import { Rest } from 'ps2census'
import { env } from './env'
import type { Faction, PlayerCharacter } from './types'

const FACTION_IDS: Record<Faction, string> = {
  VS: '1',
  NC: '2',
  TR: '3',
}

type CensusCharacter = {
  character_id: string
  name?: {
    first?: string
    first_lower?: string
  }
  faction_id: string
}

export async function resolveJaegerCharacter(faction: Faction, name: string): Promise<PlayerCharacter> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error(`${faction} character name is required.`)

  const client = new Rest.Client('ps2', {
    serviceId: env('PS2_CENSUS_SERVICE_ID', 'example'),
    axios: {
      timeout: 8000,
    },
  })
  const result = await client
    .getQueryBuilder('character')
    .show('character_id', 'name.first', 'name.first_lower', 'faction_id')
    .exactMatchFirst(true)
    .limit(5)
    .get({ 'name.first_lower': trimmed.toLowerCase() })
  const matches = (Array.isArray(result) ? result : []) as CensusCharacter[]
  const exact = matches.find(
    (character) =>
      character.faction_id === FACTION_IDS[faction] &&
      character.name?.first?.toLowerCase() === trimmed.toLowerCase(),
  )

  if (!exact?.character_id || !exact.name?.first) {
    throw new Error(`Could not resolve ${trimmed} as a ${faction} character.`)
  }

  return {
    faction,
    characterId: exact.character_id,
    characterName: exact.name.first,
    resolvedAt: new Date().toISOString(),
  }
}
