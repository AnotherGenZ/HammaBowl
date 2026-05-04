import '@tanstack/react-start/server-only'

import { env } from './env'
import { HONU_DEFAULT_ZONE_ID, HONU_JAEGER_WORLD_ID, normalizeHonuZoneId } from './honu'
import {
  getHonuPsbAccountCacheUpdatedAt,
  getPendingHonuAlertEvents,
  markEventHonuAlertCreated,
  replaceHonuPsbAccountCache,
  saveDueHonuTeamReports,
  searchHonuPsbAccounts,
  type HonuPsbAccountCacheRow,
} from './db.server'
import type { HammaEvent, HonuPsbAccountSuggestion } from './types'

const HONU_BASE_URL = env('HONU_BASE_URL', 'https://wt.honu.pw').replace(/\/+$/, '')
const HONU_PSB_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000
const HONU_ALERT_CHECK_INTERVAL_MS = 60 * 1000
let psbRefreshTimerStarted = false
let psbRefreshPromise: Promise<number> | null = null
let alertRefreshTimerStarted = false
let alertSweepPromise: Promise<number> | null = null

export function isHonuConfigured() {
  return Boolean(env('HONU_API_KEY').trim())
}

export async function ensureHonuAlertForEvent(event: HammaEvent) {
  if (!isHonuConfigured() || event.honuAlertId || !isHonuAlertDue(event)) return null

  const firstRound = event.rounds[0]
  const duration = calculateHonuAlertDurationSeconds(event)
  if (!duration) return null

  const payload = {
    timestamp: firstRound.startedAt,
    duration,
    zoneID: normalizeHonuZoneId(event.honuZoneId, HONU_DEFAULT_ZONE_ID),
    worldID: HONU_JAEGER_WORLD_ID,
    alertID: 0,
    instanceID: 0,
    name: event.name,
    victorFactionID: null,
    warpgateVS: 0,
    warpgateNC: 0,
    warpgateTR: 0,
    zoneFacilityCount: 0,
    countVS: null,
    countNC: null,
    countTR: null,
    participants: 0,
  }

  const response = await honuFetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const alertId = normalizeCreatedAlertId(await readJsonOrText(response))
  markEventHonuAlertCreated(event.id, alertId)

  return {
    alertId,
    message: `Honu alert ${alertId} created for ${event.name}.`,
  }
}

export async function searchCachedHonuPsbAccounts(query: string): Promise<{
  accounts: HonuPsbAccountSuggestion[]
  updatedAt?: string
}> {
  ensureHonuPsbAccountRefresh()
  await refreshHonuPsbAccountsIfDue().catch((error) => console.error(error))
  return {
    accounts: searchHonuPsbAccounts(query, 10),
    updatedAt: getHonuPsbAccountCacheUpdatedAt() ?? undefined,
  }
}

export function ensureHonuAlertRefresh() {
  if (alertRefreshTimerStarted || typeof window !== 'undefined') return

  alertRefreshTimerStarted = true
  void createDueHonuAlerts().catch((error) => console.error(error))
  const timer = setInterval(() => {
    void createDueHonuAlerts().catch((error) => console.error(error))
  }, HONU_ALERT_CHECK_INTERVAL_MS)
  timer.unref?.()
}

export async function createDueHonuAlerts() {
  if (alertSweepPromise) return alertSweepPromise

  alertSweepPromise = (async () => {
    let created = 0
    for (const event of await getPendingHonuAlertEvents()) {
      await saveDueHonuTeamReports(event)
      const result = await ensureHonuAlertForEvent(event)
      if (result) created += 1
    }
    return created
  })().finally(() => {
    alertSweepPromise = null
  })

  return alertSweepPromise
}

export function ensureHonuPsbAccountRefresh() {
  if (psbRefreshTimerStarted || typeof window !== 'undefined' || !isHonuConfigured()) return

  psbRefreshTimerStarted = true
  void refreshHonuPsbAccountsIfDue().catch((error) => console.error(error))
  const timer = setInterval(() => {
    void refreshHonuPsbAccounts().catch((error) => console.error(error))
  }, HONU_PSB_REFRESH_INTERVAL_MS)
  timer.unref?.()
}

export async function refreshHonuPsbAccountsIfDue() {
  const updatedAt = getHonuPsbAccountCacheUpdatedAt()
  if (updatedAt && Date.now() - new Date(updatedAt).getTime() < HONU_PSB_REFRESH_INTERVAL_MS) {
    return searchHonuPsbAccounts('', 1).length
  }

  return refreshHonuPsbAccounts()
}

export async function refreshHonuPsbAccounts() {
  if (!isHonuConfigured()) return 0
  if (psbRefreshPromise) return psbRefreshPromise

  psbRefreshPromise = (async () => {
    const response = await honuFetch('/api/psb-account/type/1')
    const payload = await response.json() as unknown
    if (!Array.isArray(payload)) throw new Error('Honu PSB account response was not a list.')

    const rows = payload
      .map(normalizeHonuPsbAccount)
      .filter((account): account is HonuPsbAccountCacheRow => Boolean(account))
    replaceHonuPsbAccountCache(rows)
    return rows.length
  })().finally(() => {
    psbRefreshPromise = null
  })

  return psbRefreshPromise
}

function calculateHonuAlertDurationSeconds(event: HammaEvent) {
  const firstRound = event.rounds[0]
  if (!firstRound) return 0

  const lastRound = getLastConfiguredRound(event)
  if (!lastRound) return 0

  const firstStart = new Date(firstRound.startedAt).getTime()
  const end = getRoundEndMs(lastRound)
  if (!Number.isFinite(firstStart) || !Number.isFinite(end) || end <= firstStart) return 0

  return Math.ceil((end - firstStart) / 1000)
}

function isHonuAlertDue(event: HammaEvent) {
  const lastRound = getLastConfiguredRound(event)
  if (!lastRound) return false

  const lastRoundEnd = getRoundEndMs(lastRound)
  return Number.isFinite(lastRoundEnd) && Date.now() >= lastRoundEnd
}

function getLastConfiguredRound(event: HammaEvent) {
  if (event.rounds.length < event.roundCount) return null
  return event.rounds.find((round) => round.roundNumber === event.roundCount) ?? null
}

function getRoundEndMs(round: HammaEvent['rounds'][number]) {
  return new Date(round.startedAt).getTime() + round.durationSeconds * 1000
}

async function honuFetch(path: string, init: RequestInit = {}) {
  const apiKey = env('HONU_API_KEY').trim()
  if (!apiKey) throw new Error('HONU_API_KEY is not configured.')

  const response = await fetch(`${HONU_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'HammaBowl',
      ...init.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`Honu ${path} failed with ${response.status}: ${await response.text()}`)
  }
  return response
}

async function readJsonOrText(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function normalizeCreatedAlertId(value: unknown) {
  const id = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Honu did not return a valid alert ID.')
  }
  return id
}

function normalizeHonuPsbAccount(value: unknown): HonuPsbAccountCacheRow | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const account = item.account as Record<string, unknown> | undefined
  if (!account || typeof account !== 'object') return null

  const accountId = Number(account.id)
  const accountType = Number(account.accountType)
  const tag = String(account.tag ?? '').trim()
  const name = String(account.name ?? '').trim()
  const playerName = String(account.playerName ?? name).trim()
  const deletedAt = nullableString(account.deletedAt)
  if (!Number.isInteger(accountId) || accountId <= 0 || accountType !== 1 || !tag || !name || !playerName || deletedAt) {
    return null
  }

  return {
    accountId,
    accountType,
    tag,
    name,
    playerName,
    vsId: nullableString(account.vsID),
    vsName: characterName(item.vsCharacter),
    ncId: nullableString(account.ncID),
    ncName: characterName(item.ncCharacter),
    trId: nullableString(account.trID),
    trName: characterName(item.trCharacter),
    nsId: nullableString(account.nsID),
    nsName: characterName(item.nsCharacter),
    deletedAt,
    rawJson: JSON.stringify(value),
  }
}

function characterName(value: unknown) {
  if (!value || typeof value !== 'object') return null
  return nullableString((value as Record<string, unknown>).name)
}

function nullableString(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}
