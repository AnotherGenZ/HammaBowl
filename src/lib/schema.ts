import { relations } from 'drizzle-orm'
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  raidHelperEventId: text('raid_helper_event_id').notNull().unique(),
  name: text('name').notNull(),
  nameOverride: text('name_override'),
  server: text('server').notNull(),
  startsAt: text('starts_at').notNull(),
  closingTime: text('closing_time'),
  phase: text('phase').notNull().default('signups'),
  salaryPool: integer('salary_pool').notNull().default(250_000_000),
  pendingSignupCount: integer('pending_signup_count').notNull().default(0),
  availableFactions: text('available_factions').notNull().default('["VS","NC","TR"]'),
  availableSides: text('available_sides').notNull().default('["north","south"]'),
  nextPickTeamId: text('next_pick_team_id'),
  winningTeamId: text('winning_team_id'),
  twitchStreamUrl: text('twitch_stream_url'),
  twitchVodUrl: text('twitch_vod_url'),
  lore: text('lore'),
  updatedAt: text('updated_at').notNull(),
})

export const participants = sqliteTable('participants', {
  discordId: text('discord_id').primaryKey(),
  name: text('name').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const eventParticipants = sqliteTable(
  'event_participants',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('signed_up'),
    disqualified: integer('disqualified', { mode: 'boolean' }).notNull().default(false),
    winner: integer('winner', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.discordId] })],
)

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  captainDiscordId: text('captain_discord_id'),
  faction: text('faction'),
  startingSide: text('starting_side'),
  budget: integer('budget').notNull().default(125_000_000),
  bonusCap: integer('bonus_cap').notNull().default(25_000_000),
  score: integer('score').notNull().default(0),
})

export const ratings = sqliteTable(
  'ratings',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    fromDiscordId: text('from_discord_id').notNull(),
    toDiscordId: text('to_discord_id').notNull(),
    score: real('score').notNull(),
    disqualified: integer('disqualified', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.fromDiscordId, table.toDiscordId] })],
)

export const draftPicks = sqliteTable('draft_picks', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  playerDiscordId: text('player_discord_id').notNull(),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  salary: integer('salary').notNull().default(0),
  bonusSpent: integer('bonus_spent').notNull().default(0),
  contestedByTeamId: text('contested_by_team_id'),
  confirmedAt: text('confirmed_at').notNull(),
})

export const activeDraftBids = sqliteTable('active_draft_bids', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  playerDiscordId: text('player_discord_id').notNull(),
  openedByTeamId: text('opened_by_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  highestTeamId: text('highest_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  nextTeamId: text('next_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  currentBonus: integer('current_bonus').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const scoreAdjustments = sqliteTable('score_adjustments', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason'),
  createdAt: text('created_at').notNull(),
})

export const coinflips = sqliteTable('coinflips', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  callingTeamId: text('calling_team_id').references(() => teams.id, { onDelete: 'set null' }),
  callerCall: text('caller_call'),
  winningTeamId: text('winning_team_id').references(() => teams.id, { onDelete: 'set null' }),
  result: text('result'),
  choice: text('choice'),
  winnerChoiceType: text('winner_choice_type'),
  winnerFaction: text('winner_faction'),
  winnerStartingSide: text('winner_starting_side'),
  firstPickTeamId: text('first_pick_team_id').references(() => teams.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
})

export const eventRelations = relations(events, ({ many }) => ({
  participants: many(eventParticipants),
  teams: many(teams),
  ratings: many(ratings),
  draftPicks: many(draftPicks),
  activeDraftBids: many(activeDraftBids),
}))
