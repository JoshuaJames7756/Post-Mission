import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { events, goals, noteEvents, noteGoals, notePeople, notePlaces, notes, noteTasks, people, places, tasks } from '../../db/schema.js'
import type { SaveNoteInput } from '../../../shared/schemas/note.js'

export class NoteLinkError extends Error { constructor() { super('note_link_not_found') } }

const emptyLinks = () => ({ goalIds: [] as string[], taskIds: [] as string[], eventIds: [] as string[], personIds: [] as string[], placeIds: [] as string[] })

export async function list(db: Database, userId: string, archived: boolean) {
  const rows = await db.select().from(notes).where(and(eq(notes.userId, userId), archived ? isNotNull(notes.archivedAt) : isNull(notes.archivedAt))).orderBy(desc(notes.updatedAt))
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [goalLinks, taskLinks, eventLinks, personLinks, placeLinks] = await Promise.all([
    db.select({ noteId: noteGoals.noteId, id: noteGoals.goalId }).from(noteGoals).where(and(eq(noteGoals.userId, userId), inArray(noteGoals.noteId, ids))),
    db.select({ noteId: noteTasks.noteId, id: noteTasks.taskId }).from(noteTasks).where(and(eq(noteTasks.userId, userId), inArray(noteTasks.noteId, ids))),
    db.select({ noteId: noteEvents.noteId, id: noteEvents.eventId }).from(noteEvents).where(and(eq(noteEvents.userId, userId), inArray(noteEvents.noteId, ids))),
    db.select({ noteId: notePeople.noteId, id: notePeople.personId }).from(notePeople).where(and(eq(notePeople.userId, userId), inArray(notePeople.noteId, ids))),
    db.select({ noteId: notePlaces.noteId, id: notePlaces.placeId }).from(notePlaces).where(and(eq(notePlaces.userId, userId), inArray(notePlaces.noteId, ids))),
  ])
  const byNote = new Map(rows.map((row) => [row.id, emptyLinks()]))
  for (const item of goalLinks) byNote.get(item.noteId)?.goalIds.push(item.id)
  for (const item of taskLinks) byNote.get(item.noteId)?.taskIds.push(item.id)
  for (const item of eventLinks) byNote.get(item.noteId)?.eventIds.push(item.id)
  for (const item of personLinks) byNote.get(item.noteId)?.personIds.push(item.id)
  for (const item of placeLinks) byNote.get(item.noteId)?.placeIds.push(item.id)
  return rows.map((row) => ({ ...row, links: byNote.get(row.id)! }))
}

export async function linkOptions(db: Database, userId: string) {
  const [goalRows, taskRows, eventRows, personRows, placeRows] = await Promise.all([
    db.select({ id: goals.id, title: goals.title, archivedAt: goals.archivedAt }).from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.updatedAt)),
    db.select({ id: tasks.id, title: tasks.title, archivedAt: tasks.archivedAt }).from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.updatedAt)),
    db.select({ id: events.id, title: events.title, archivedAt: events.archivedAt }).from(events).where(eq(events.userId, userId)).orderBy(desc(events.updatedAt)),
    db.select({ id: people.id, title: people.name, archivedAt: people.archivedAt }).from(people).where(eq(people.userId, userId)).orderBy(desc(people.updatedAt)),
    db.select({ id: places.id, title: places.name, archivedAt: places.archivedAt }).from(places).where(eq(places.userId, userId)).orderBy(desc(places.updatedAt)),
  ])
  return { goals: goalRows, tasks: taskRows, events: eventRows, people: personRows, places: placeRows }
}

async function verifyLinks(db: Pick<Database, 'select'>, userId: string, links: SaveNoteInput['links']) {
  const unique = {
    goalIds: [...new Set(links.goalIds)], taskIds: [...new Set(links.taskIds)], eventIds: [...new Set(links.eventIds)],
    personIds: [...new Set(links.personIds)], placeIds: [...new Set(links.placeIds)],
  }
  const [ownedGoals, ownedTasks, ownedEvents, ownedPeople, ownedPlaces] = await Promise.all([
    unique.goalIds.length ? db.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, userId), inArray(goals.id, unique.goalIds))) : [],
    unique.taskIds.length ? db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, userId), inArray(tasks.id, unique.taskIds))) : [],
    unique.eventIds.length ? db.select({ id: events.id }).from(events).where(and(eq(events.userId, userId), inArray(events.id, unique.eventIds))) : [],
    unique.personIds.length ? db.select({ id: people.id }).from(people).where(and(eq(people.userId, userId), inArray(people.id, unique.personIds))) : [],
    unique.placeIds.length ? db.select({ id: places.id }).from(places).where(and(eq(places.userId, userId), inArray(places.id, unique.placeIds))) : [],
  ])
  if (ownedGoals.length !== unique.goalIds.length || ownedTasks.length !== unique.taskIds.length || ownedEvents.length !== unique.eventIds.length || ownedPeople.length !== unique.personIds.length || ownedPlaces.length !== unique.placeIds.length) throw new NoteLinkError()
  return unique
}

async function replaceLinks(db: Pick<Database, 'select' | 'insert' | 'delete'>, userId: string, noteId: string, links: SaveNoteInput['links']) {
  const unique = await verifyLinks(db, userId, links)
  await Promise.all([
    db.delete(noteGoals).where(and(eq(noteGoals.userId, userId), eq(noteGoals.noteId, noteId))),
    db.delete(noteTasks).where(and(eq(noteTasks.userId, userId), eq(noteTasks.noteId, noteId))),
    db.delete(noteEvents).where(and(eq(noteEvents.userId, userId), eq(noteEvents.noteId, noteId))),
    db.delete(notePeople).where(and(eq(notePeople.userId, userId), eq(notePeople.noteId, noteId))),
    db.delete(notePlaces).where(and(eq(notePlaces.userId, userId), eq(notePlaces.noteId, noteId))),
  ])
  await Promise.all([
    unique.goalIds.length && db.insert(noteGoals).values(unique.goalIds.map((goalId) => ({ userId, noteId, goalId }))),
    unique.taskIds.length && db.insert(noteTasks).values(unique.taskIds.map((taskId) => ({ userId, noteId, taskId }))),
    unique.eventIds.length && db.insert(noteEvents).values(unique.eventIds.map((eventId) => ({ userId, noteId, eventId }))),
    unique.personIds.length && db.insert(notePeople).values(unique.personIds.map((personId) => ({ userId, noteId, personId }))),
    unique.placeIds.length && db.insert(notePlaces).values(unique.placeIds.map((placeId) => ({ userId, noteId, placeId }))),
  ])
}

export async function create(db: Database, userId: string, input: SaveNoteInput) {
  return db.transaction(async (tx) => {
    const [note] = await tx.insert(notes).values({ userId, title: input.title, content: input.content }).returning()
    if (!note) throw new Error('note_insert_failed')
    await replaceLinks(tx, userId, note.id, input.links)
    return note
  })
}

export async function update(db: Database, userId: string, id: string, input: SaveNoteInput) {
  return db.transaction(async (tx) => {
    const [note] = await tx.update(notes).set({ title: input.title, content: input.content, updatedAt: new Date() }).where(and(eq(notes.userId, userId), eq(notes.id, id), isNull(notes.archivedAt))).returning()
    if (!note) return null
    await replaceLinks(tx, userId, id, input.links)
    return note
  })
}

export const setArchived = (db: Database, userId: string, id: string, archived: boolean) => db.update(notes).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(and(eq(notes.userId, userId), eq(notes.id, id), archived ? isNull(notes.archivedAt) : isNotNull(notes.archivedAt))).returning()
