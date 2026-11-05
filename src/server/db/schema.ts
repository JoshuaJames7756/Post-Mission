import { sql } from 'drizzle-orm'
import {
  check,
  boolean,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const themePreference = pgEnum('theme_preference', ['system', 'light', 'dark'])
export const goalPeriod = pgEnum('goal_period', ['year', 'month', 'week', 'day'])
export const goalStatus = pgEnum('goal_status', ['active', 'completed'])
export const taskStatus = pgEnum('task_status', ['open', 'completed'])
export const taskPriority = pgEnum('task_priority', ['low', 'normal', 'high'])
export const eventStatus = pgEnum('event_status', ['scheduled', 'completed', 'cancelled'])
export const eventColor = pgEnum('event_color', ['sage', 'amber', 'navy', 'slate'])
export const personRelationship = pgEnum('person_relationship', ['family', 'friend', 'mentor', 'community', 'other'])
export const personAvatarColor = pgEnum('person_avatar_color', ['sage', 'amber', 'navy', 'slate', 'plum'])
export const placeType = pgEnum('place_type', ['home', 'church', 'work', 'school', 'community', 'other'])
export const journeyDisplayMode = pgEnum('journey_display_mode', ['elapsed', 'days'])
export const reviewPeriodType = pgEnum('review_period_type', ['daily', 'weekly'])
export const reviewStatus = pgEnum('review_status', ['draft', 'completed'])
export const reminderCategory = pgEnum('reminder_category', ['tasks', 'events', 'reviews'])
export const accountDeletionState = pgEnum('account_deletion_state', ['requested', 'data_deleted'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey(),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  purpose: varchar('purpose', { length: 500 }),
  returnDate: date('return_date', { mode: 'string' }),
  journeyDisplayMode: journeyDisplayMode('journey_display_mode').notNull().default('elapsed'),
  timezone: varchar('timezone', { length: 100 }).notNull().default('America/La_Paz'),
  themePreference: themePreference('theme_preference').notNull().default('system'),
  remindTasks: boolean('remind_tasks').notNull().default(true),
  remindEvents: boolean('remind_events').notNull().default(true),
  remindReviews: boolean('remind_reviews').notNull().default(true),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  ...timestamps,
})

export const accountDeletions = pgTable('account_deletions', {
  userId: text('user_id').primaryKey(),
  state: accountDeletionState('state').notNull().default('requested'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (table) => [index('account_deletions_retry_idx').on(table.state, table.nextAttemptAt)])

export const reminderDismissals = pgTable('reminder_dismissals', {
  userId: text('user_id').notNull(),
  category: reminderCategory('category').notNull(),
  localDate: date('local_date', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: 'reminder_dismissals_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('reminder_dismissals_user_category_date_unique').on(table.userId, table.category, table.localDate),
  index('reminder_dismissals_user_date_idx').on(table.userId, table.localDate),
])

export const journeyMilestones = pgTable('journey_milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  title: varchar('title', { length: 120 }).notNull(),
  milestoneDate: date('milestone_date', { mode: 'string' }).notNull(),
  description: varchar('description', { length: 1000 }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'journey_milestones_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  index('journey_milestones_user_date_idx').on(table.userId, table.milestoneDate),
  index('journey_milestones_user_archive_idx').on(table.userId, table.archivedAt),
])

export const reviews = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  periodType: reviewPeriodType('period_type').notNull(),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  wins: text('wins').notNull().default(''),
  challenges: text('challenges').notNull().default(''),
  reflection: text('reflection').notNull().default(''),
  nextSteps: text('next_steps').notNull().default(''),
  status: reviewStatus('status').notNull().default('draft'),
  revision: integer('revision').notNull().default(1),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'reviews_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('reviews_user_period_unique').on(table.userId, table.periodType, table.periodStart),
  check('reviews_week_start_check', sql`${table.periodType} = 'daily' or extract(dow from ${table.periodStart}) = 1`),
  check('reviews_completion_shape_check', sql`(${table.status} = 'draft' and ${table.completedAt} is null) or (${table.status} = 'completed' and ${table.completedAt} is not null)`),
  index('reviews_user_recent_idx').on(table.userId, table.periodType, table.periodStart),
])

export const lifeAreas = pgTable('life_areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: varchar('name', { length: 60 }).notNull(),
  icon: varchar('icon', { length: 32 }),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'life_areas_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('life_areas_user_id_id_unique').on(table.userId, table.id),
  uniqueIndex('life_areas_user_name_active_unique').on(table.userId, table.name).where(sql`${table.archivedAt} is null`),
  index('life_areas_user_order_idx').on(table.userId, table.sortOrder),
])

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  lifeAreaId: uuid('life_area_id'),
  parentGoalId: uuid('parent_goal_id'),
  title: varchar('title', { length: 120 }).notNull(),
  description: text('description'),
  periodType: goalPeriod('period_type').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  targetDate: date('target_date', { mode: 'string' }).notNull(),
  status: goalStatus('status').notNull().default('active'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'goals_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('goals_user_id_id_unique').on(table.userId, table.id),
  foreignKey({ name: 'goals_user_life_area_fk', columns: [table.userId, table.lifeAreaId], foreignColumns: [lifeAreas.userId, lifeAreas.id] }).onDelete('restrict'),
  foreignKey({ name: 'goals_user_parent_fk', columns: [table.userId, table.parentGoalId], foreignColumns: [table.userId, table.id] }).onDelete('restrict'),
  check('goals_target_after_start_check', sql`${table.targetDate} >= ${table.startDate}`),
  index('goals_user_period_status_idx').on(table.userId, table.periodType, table.status),
  index('goals_user_dates_idx').on(table.userId, table.startDate, table.targetDate),
  index('goals_user_parent_idx').on(table.userId, table.parentGoalId),
])

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  goalId: uuid('goal_id'),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description'),
  status: taskStatus('status').notNull().default('open'),
  priority: taskPriority('priority').notNull().default('normal'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'tasks_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('tasks_user_id_id_unique').on(table.userId, table.id),
  foreignKey({ name: 'tasks_user_goal_fk', columns: [table.userId, table.goalId], foreignColumns: [goals.userId, goals.id] }).onDelete('restrict'),
  index('tasks_user_status_due_idx').on(table.userId, table.status, table.dueAt),
  index('tasks_user_goal_idx').on(table.userId, table.goalId),
])

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  goalId: uuid('goal_id'),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 40 }).notNull(),
  color: eventColor('color').notNull().default('sage'),
  allDay: boolean('all_day').notNull(),
  startDate: date('start_date', { mode: 'string' }),
  endDate: date('end_date', { mode: 'string' }),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  timeZone: varchar('time_zone', { length: 100 }),
  status: eventStatus('status').notNull().default('scheduled'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'events_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('events_user_id_id_unique').on(table.userId, table.id),
  foreignKey({ name: 'events_user_goal_fk', columns: [table.userId, table.goalId], foreignColumns: [goals.userId, goals.id] }).onDelete('restrict'),
  check('events_temporal_shape_check', sql`(
    (${table.allDay} = true and ${table.startDate} is not null and ${table.endDate} is not null
      and ${table.endDate} >= ${table.startDate} and ${table.startAt} is null and ${table.endAt} is null and ${table.timeZone} is null)
    or
    (${table.allDay} = false and ${table.startDate} is null and ${table.endDate} is null
      and ${table.startAt} is not null and ${table.endAt} is not null and ${table.endAt} > ${table.startAt} and ${table.timeZone} is not null)
  )`),
  index('events_user_all_day_range_idx').on(table.userId, table.startDate, table.endDate)
    .where(sql`${table.allDay} = true and ${table.archivedAt} is null`),
  index('events_user_timed_range_idx').on(table.userId, table.startAt, table.endAt)
    .where(sql`${table.allDay} = false and ${table.archivedAt} is null`),
  index('events_user_goal_idx').on(table.userId, table.goalId),
])

export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  relationship: personRelationship('relationship').notNull(),
  phone: varchar('phone', { length: 32 }),
  birthday: date('birthday', { mode: 'string' }),
  notes: varchar('notes', { length: 2000 }),
  avatarColor: personAvatarColor('avatar_color').notNull().default('sage'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'people_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('people_user_id_id_unique').on(table.userId, table.id),
  index('people_user_name_active_idx').on(table.userId, table.name).where(sql`${table.archivedAt} is null`),
  index('people_user_archived_idx').on(table.userId, table.archivedAt),
])

export const eventPeople = pgTable('event_people', {
  userId: text('user_id').notNull(),
  eventId: uuid('event_id').notNull(),
  personId: uuid('person_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('event_people_user_event_person_unique').on(table.userId, table.eventId, table.personId),
  foreignKey({ name: 'event_people_user_event_fk', columns: [table.userId, table.eventId], foreignColumns: [events.userId, events.id] }).onDelete('cascade'),
  foreignKey({ name: 'event_people_user_person_fk', columns: [table.userId, table.personId], foreignColumns: [people.userId, people.id] }).onDelete('cascade'),
  index('event_people_user_person_idx').on(table.userId, table.personId),
])

export const places = pgTable('places', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  type: placeType('type').notNull(),
  address: varchar('address', { length: 240 }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'places_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('places_user_id_id_unique').on(table.userId, table.id),
  check('places_coordinate_pair_check', sql`(
    (${table.latitude} is null and ${table.longitude} is null)
    or (${table.latitude} is not null and ${table.longitude} is not null
      and ${table.latitude} >= -90 and ${table.latitude} <= 90
      and ${table.longitude} >= -180 and ${table.longitude} <= 180)
  )`),
  index('places_user_name_active_idx').on(table.userId, table.name).where(sql`${table.archivedAt} is null`),
  index('places_user_archived_idx').on(table.userId, table.archivedAt),
])

export const eventPlaces = pgTable('event_places', {
  userId: text('user_id').notNull(),
  eventId: uuid('event_id').notNull(),
  placeId: uuid('place_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('event_places_user_event_place_unique').on(table.userId, table.eventId, table.placeId),
  foreignKey({ name: 'event_places_user_event_fk', columns: [table.userId, table.eventId], foreignColumns: [events.userId, events.id] }).onDelete('cascade'),
  foreignKey({ name: 'event_places_user_place_fk', columns: [table.userId, table.placeId], foreignColumns: [places.userId, places.id] }).onDelete('cascade'),
  index('event_places_user_place_idx').on(table.userId, table.placeId),
])

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  content: text('content').notNull().default(''),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  foreignKey({ name: 'notes_user_profile_fk', columns: [table.userId], foreignColumns: [profiles.userId] }).onDelete('cascade'),
  unique('notes_user_id_id_unique').on(table.userId, table.id),
  index('notes_user_updated_idx').on(table.userId, table.updatedAt),
  index('notes_user_archived_idx').on(table.userId, table.archivedAt),
])

export const noteGoals = pgTable('note_goals', {
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').notNull(),
  goalId: uuid('goal_id').notNull(),
}, (table) => [
  unique('note_goals_unique').on(table.userId, table.noteId, table.goalId),
  foreignKey({ name: 'note_goals_note_fk', columns: [table.userId, table.noteId], foreignColumns: [notes.userId, notes.id] }).onDelete('cascade'),
  foreignKey({ name: 'note_goals_goal_fk', columns: [table.userId, table.goalId], foreignColumns: [goals.userId, goals.id] }).onDelete('cascade'),
  index('note_goals_goal_idx').on(table.userId, table.goalId),
])

export const noteTasks = pgTable('note_tasks', {
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').notNull(),
  taskId: uuid('task_id').notNull(),
}, (table) => [
  unique('note_tasks_unique').on(table.userId, table.noteId, table.taskId),
  foreignKey({ name: 'note_tasks_note_fk', columns: [table.userId, table.noteId], foreignColumns: [notes.userId, notes.id] }).onDelete('cascade'),
  foreignKey({ name: 'note_tasks_task_fk', columns: [table.userId, table.taskId], foreignColumns: [tasks.userId, tasks.id] }).onDelete('cascade'),
  index('note_tasks_task_idx').on(table.userId, table.taskId),
])

export const noteEvents = pgTable('note_events', {
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').notNull(),
  eventId: uuid('event_id').notNull(),
}, (table) => [
  unique('note_events_unique').on(table.userId, table.noteId, table.eventId),
  foreignKey({ name: 'note_events_note_fk', columns: [table.userId, table.noteId], foreignColumns: [notes.userId, notes.id] }).onDelete('cascade'),
  foreignKey({ name: 'note_events_event_fk', columns: [table.userId, table.eventId], foreignColumns: [events.userId, events.id] }).onDelete('cascade'),
  index('note_events_event_idx').on(table.userId, table.eventId),
])

export const notePeople = pgTable('note_people', {
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').notNull(),
  personId: uuid('person_id').notNull(),
}, (table) => [
  unique('note_people_unique').on(table.userId, table.noteId, table.personId),
  foreignKey({ name: 'note_people_note_fk', columns: [table.userId, table.noteId], foreignColumns: [notes.userId, notes.id] }).onDelete('cascade'),
  foreignKey({ name: 'note_people_person_fk', columns: [table.userId, table.personId], foreignColumns: [people.userId, people.id] }).onDelete('cascade'),
  index('note_people_person_idx').on(table.userId, table.personId),
])

export const notePlaces = pgTable('note_places', {
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').notNull(),
  placeId: uuid('place_id').notNull(),
}, (table) => [
  unique('note_places_unique').on(table.userId, table.noteId, table.placeId),
  foreignKey({ name: 'note_places_note_fk', columns: [table.userId, table.noteId], foreignColumns: [notes.userId, notes.id] }).onDelete('cascade'),
  foreignKey({ name: 'note_places_place_fk', columns: [table.userId, table.placeId], foreignColumns: [places.userId, places.id] }).onDelete('cascade'),
  index('note_places_place_idx').on(table.userId, table.placeId),
])
