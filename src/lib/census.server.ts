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

export class CensusLookupError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'CensusLookupError'
    this.status = status
  }
}

export async function resolveJaegerCharacter(faction: Faction, name: string): Promise<PlayerCharacter> {
  const trimmed = name.trim()
  if (!trimmed) throw new CensusLookupError(`${faction} character name is required.`, 400)

  const client = new Rest.Client('ps2', {
    serviceId: env('PS2_CENSUS_SERVICE_ID', 'example'),
    axios: {
      timeout: 8000,
    },
  })
  const result = await queryCharacter(client, faction, trimmed)
  const matches = (Array.isArray(result) ? result : []) as CensusCharacter[]
  const exact = matches.find(
    (character) =>
      character.faction_id === FACTION_IDS[faction] &&
      character.name?.first?.toLowerCase() === trimmed.toLowerCase(),
  )

  if (!exact?.character_id || !exact.name?.first) {
    throw new CensusLookupError(`Could not resolve ${trimmed} as a ${faction} character.`, 404)
  }

  return {
    faction,
    characterId: exact.character_id,
    characterName: exact.name.first,
    resolvedAt: new Date().toISOString(),
  }
}

export function censusLookupErrorResponse(error: unknown): Response | null {
  if (!(error instanceof CensusLookupError)) return null
  return new Response(error.message, { status: error.status })
}

async function queryCharacter(client: Rest.Client, faction: Faction, name: string): Promise<unknown> {
  try {
    return await client
      .getQueryBuilder('character')
      .show('character_id', 'name.first', 'name.first_lower', 'faction_id')
      .exactMatchFirst(true)
      .limit(5)
      .get({ 'name.first_lower': name.toLowerCase() })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new CensusLookupError(`Census timed out while resolving ${name} as a ${faction} character.`, 504)
    }

    throw new CensusLookupError(
      `Census could not be reached while resolving ${name} as a ${faction} character.`,
      502,
    )
  }
}

function isTimeoutError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as { code?: unknown; message?: unknown }
  return maybeError.code === 'ECONNABORTED' ||
    maybeError.code === 'ETIMEDOUT' ||
    (typeof maybeError.message === 'string' && maybeError.message.toLowerCase().includes('timeout'))
}
