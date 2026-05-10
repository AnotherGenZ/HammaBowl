import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  raidHelperEventId: text('raid_helper_event_id').notNull().unique(),
  raidHelperChannelId: text('raid_helper_channel_id'),
  source: text('source').notNull().default('raid_helper'),
  eventColor: text('event_color'),
  eventImageUrl: text('event_image_url'),
  mentionRoleIdsJson: text('mention_role_ids_json'),
  embedUseDiscordMentions: integer('embed_use_discord_mentions', { mode: 'boolean' }).notNull().default(false),
  autoCreateSignupThread: integer('auto_create_signup_thread', { mode: 'boolean' }).notNull().default(false),
  minSignupSpecs: integer('min_signup_specs').notNull().default(1),
  maxSignupSpecs: integer('max_signup_specs').notNull().default(5),
  allowMultipleSignups: integer('allow_multiple_signups', { mode: 'boolean' }).notNull().default(false),
  discordCheckInMessageId: text('discord_check_in_message_id'),
  discordCheckInMessageChannelId: text('discord_check_in_message_channel_id'),
  name: text('name').notNull(),
  nameOverride: text('name_override'),
  server: text('server').notNull(),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at'),
  closingTime: text('closing_time'),
  draftStartMinutesBefore: integer('draft_start_minutes_before'),
  roundCount: integer('round_count').notNull().default(3),
  roundDurationSeconds: integer('round_duration_seconds').notNull().default(900),
  phase: text('phase').notNull().default('signups'),
  salaryPool: integer('salary_pool').notNull().default(250_000_000),
  bonusPool: integer('bonus_pool').notNull().default(50_000_000),
  maxPlayerBonus: integer('max_player_bonus').notNull().default(10_000_000),
  bidIncrement: integer('bid_increment').notNull().default(1_000_000),
  pendingSignupCount: integer('pending_signup_count').notNull().default(0),
  nextPickTeamId: text('next_pick_team_id'),
  winningTeamId: text('winning_team_id'),
  twitchStreamUrl: text('twitch_stream_url'),
  twitchVodUrl: text('twitch_vod_url'),
  eventDescription: text('event_description'),
  trophyId: text('trophy_id').notNull().default('hammo-bowl-cup'),
  lore: text('lore'),
  honuZoneId: integer('honu_zone_id').notNull().default(0),
  honuAlertId: integer('honu_alert_id'),
  honuAlertCreatedAt: text('honu_alert_created_at'),
  updatedAt: text('updated_at').notNull(),
})

export const eventTemplates = sqliteTable('event_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  defaultChannelId: text('default_channel_id'),
  defaultDurationMinutes: integer('default_duration_minutes').notNull().default(120),
  defaultSignupCloseMinutesBefore: integer('default_signup_close_minutes_before').notNull().default(60),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const eventTemplateOptions = sqliteTable(
  'event_template_options',
  {
    templateId: text('template_id').notNull().references(() => eventTemplates.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.status] })],
)

export const eventTemplateSpecs = sqliteTable(
  'event_template_specs',
  {
    templateId: text('template_id').notNull().references(() => eventTemplates.id, { onDelete: 'cascade' }),
    specName: text('spec_name').notNull(),
    specEmoji: text('spec_emoji'),
    position: integer('position').notNull(),
    defaultLimit: integer('default_limit'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.specName] })],
)

export const eventSignupLimits = sqliteTable(
  'event_signup_limits',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    status: text('status'),
    specName: text('spec_name'),
    limit: integer('limit_count').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.status, table.specName] }),
    index('idx_event_signup_limits_event').on(table.eventId),
  ],
)

export const eventSignups = sqliteTable(
  'event_signups',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    lateMinutes: integer('late_minutes').notNull().default(0),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    createdByDiscordId: text('created_by_discord_id'),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.discordId] }),
    index('idx_event_signups_event_status').on(table.eventId, table.status),
  ],
)

export const eventSignupSpecs = sqliteTable(
  'event_signup_specs',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    specName: text('spec_name').notNull(),
    position: integer('position').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.discordId, table.specName] }),
    index('idx_event_signup_specs_event_spec').on(table.eventId, table.specName),
  ],
)

export const eventDiscordMessages = sqliteTable(
  'event_discord_messages',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    channelId: text('channel_id').notNull(),
    messageId: text('message_id').notNull(),
    threadId: text('thread_id'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.kind] })],
)

export const eventReminders = sqliteTable('event_reminders', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  target: text('target').notNull(),
  offsetMinutes: integer('offset_minutes').notNull(),
  channelId: text('channel_id'),
  message: text('message'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastSentAt: text('last_sent_at'),
})

export const eventRecurrences = sqliteTable('event_recurrences', {
  id: text('id').primaryKey(),
  templateEventId: text('template_event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  intervalDays: integer('interval_days').notNull(),
  postTime: text('post_time').notNull(),
  nextPostAt: text('next_post_at').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
})

export const eventAuditLog = sqliteTable('event_audit_log', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  actorDiscordId: text('actor_discord_id'),
  action: text('action').notNull(),
  payloadJson: text('payload_json'),
  createdAt: text('created_at').notNull(),
})

export const eventRoleGates = sqliteTable(
  'event_role_gates',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    gate: text('gate').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.roleId, table.gate] })],
)

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const eventAvailableFactions = sqliteTable(
  'event_available_factions',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    faction: text('faction').notNull(),
    position: integer('position').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.faction] })],
)

export const eventAvailableSides = sqliteTable(
  'event_available_sides',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    side: text('side').notNull(),
    position: integer('position').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.side] })],
)

export const eventAvailableSpecs = sqliteTable(
  'event_available_specs',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    specName: text('spec_name').notNull(),
    specEmoji: text('spec_emoji'),
    position: integer('position').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.specName] })],
)

export const eventLinks = sqliteTable(
  'event_links',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    url: text('url').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.position] })],
)

export const participants = sqliteTable('participants', {
  discordId: text('discord_id').primaryKey(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  nameOverridden: integer('name_overridden', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  tag: text('tag').notNull().unique(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  tagColor: text('tag_color').notNull().default('#47bf8f'),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const groupMembers = sqliteTable(
  'group_members',
  {
    groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull().references(() => participants.discordId, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    requestedAt: text('requested_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.discordId] }),
    index('idx_group_members_status').on(table.groupId, table.status),
  ],
)

export const groupAdministrators = sqliteTable(
  'group_administrators',
  {
    groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull().references(() => participants.discordId, { onDelete: 'cascade' }),
    assignedAt: text('assigned_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.discordId] })],
)

export const playerProfiles = sqliteTable('player_profiles', {
  discordId: text('discord_id').primaryKey(),
  bannerUrl: text('banner_url'),
  catchphrase: text('catchphrase'),
  noPersonalJaegerAccount: integer('no_personal_jaeger_account', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})

export const participantRoleIds = sqliteTable(
  'participant_role_ids',
  {
    discordId: text('discord_id').notNull().references(() => participants.discordId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.discordId, table.roleId] })],
)

export const playerBadgeDisplayPreferences = sqliteTable(
  'player_badge_display_preferences',
  {
    discordId: text('discord_id').notNull().references(() => playerProfiles.discordId, { onDelete: 'cascade' }),
    badgeId: text('badge_id').notNull(),
    position: integer('position'),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.discordId, table.badgeId] })],
)

export const playerCharacters = sqliteTable(
  'player_characters',
  {
    discordId: text('discord_id').notNull(),
    faction: text('faction').notNull(),
    characterId: text('character_id').notNull(),
    characterName: text('character_name').notNull(),
    resolvedAt: text('resolved_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.discordId, table.faction] })],
)

export const playerEventStats = sqliteTable(
  'player_event_stats',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    killsOnHamma: integer('kills_on_hamma').notNull().default(0),
    deathsToHamma: integer('deaths_to_hamma').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.discordId] })],
)

export const eventPlayerCharacters = sqliteTable(
  'event_player_characters',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    faction: text('faction').notNull(),
    characterId: text('character_id').notNull(),
    characterName: text('character_name').notNull(),
    assignedAt: text('assigned_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.discordId, table.faction] })],
)

export const badgeDefinitions = sqliteTable('badge_definitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  color: text('color').notNull().default('#e4b45e'),
  source: text('source').notNull().default('manual'),
  createdAt: text('created_at').notNull(),
})

export const playerBadgeAssignments = sqliteTable(
  'player_badge_assignments',
  {
    badgeId: text('badge_id').notNull().references(() => badgeDefinitions.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    assignedAt: text('assigned_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.badgeId, table.discordId] })],
)

export const eventParticipants = sqliteTable(
  'event_participants',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('signed_up'),
    disqualified: integer('disqualified', { mode: 'boolean' }).notNull().default(false),
    winner: integer('winner', { mode: 'boolean' }).notNull().default(false),
    checkedInAt: text('checked_in_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.discordId] })],
)

export const eventSignupOverrides = sqliteTable(
  'event_signup_overrides',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    action: text('action').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.discordId] })],
)

export const eventParticipantSpecs = sqliteTable(
  'event_participant_specs',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    specName: text('spec_name').notNull(),
    position: integer('position').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.discordId, table.specName] }),
    index('idx_event_participant_specs_event_spec').on(table.eventId, table.specName),
  ],
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
  honuReportUrl: text('honu_report_url'),
  honuReportCreatedAt: text('honu_report_created_at'),
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
  openedByTeamId: text('opened_by_team_id').references(() => teams.id, { onDelete: 'set null' }),
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

export const eventRounds = sqliteTable(
  'event_rounds',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    startedAt: text('started_at').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    winningTeamId: text('winning_team_id').references(() => teams.id, { onDelete: 'set null' }),
    resultNote: text('result_note'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.roundNumber] })],
)

export const eventRoundScores = sqliteTable(
  'event_round_scores',
  {
    eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.roundNumber, table.teamId] })],
)

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
  availableFactions: many(eventAvailableFactions),
  availableSides: many(eventAvailableSides),
  availableSpecs: many(eventAvailableSpecs),
  links: many(eventLinks),
  participants: many(eventParticipants),
  signupOverrides: many(eventSignupOverrides),
  participantSpecs: many(eventParticipantSpecs),
  teams: many(teams),
  ratings: many(ratings),
  draftPicks: many(draftPicks),
  activeDraftBids: many(activeDraftBids),
  rounds: many(eventRounds),
  roundScores: many(eventRoundScores),
}))

export const groupRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  administrators: many(groupAdministrators),
}))
