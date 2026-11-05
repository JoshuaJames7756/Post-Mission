import { and, eq, max, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { eventPeople, eventPlaces, events, goals, lifeAreas, people, places, profiles, tasks } from '../../db/schema.js'
import { getZonedDateTimeOptions } from '../../../calendar-time.js'
import { addCalendarDays, getCalendarDate } from '../../../date-utils.js'
import { EXAMPLE_AREA_NAME } from '../../../shared/example-data.js'

export class ExampleProfileRequiredError extends Error {
  constructor() { super('example_profile_required') }
}

function exampleTime(date: string, hour: string, timeZone: string) {
  const option = getZonedDateTimeOptions(`${date}T${hour}`, timeZone)[0]
  if (!option) throw new Error('example_time_unavailable')
  return new Date(option.instant)
}

export async function seedExamples(db: Database, userId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    const [existing] = await tx.select({ id: lifeAreas.id }).from(lifeAreas)
      .where(and(eq(lifeAreas.userId, userId), eq(lifeAreas.name, EXAMPLE_AREA_NAME))).limit(1)
    if (existing) return { created: false }

    const [profile] = await tx.select({ timezone: profiles.timezone }).from(profiles)
      .where(eq(profiles.userId, userId)).limit(1)
    if (!profile) throw new ExampleProfileRequiredError()
    const timeZone = profile.timezone
    const today = getCalendarDate(now, timeZone)
    const tomorrow = addCalendarDays(today, 1)
    const nextDay = addCalendarDays(today, 2)
    const [order] = await tx.select({ highest: max(lifeAreas.sortOrder) }).from(lifeAreas)
      .where(eq(lifeAreas.userId, userId))

    const [relations, wellbeing] = await tx.insert(lifeAreas).values([
      { userId, name: EXAMPLE_AREA_NAME, icon: 'people', sortOrder: (order?.highest ?? -1) + 1 },
      { userId, name: 'Ejemplo · Bienestar', icon: 'heart', sortOrder: (order?.highest ?? -1) + 2 },
    ]).returning({ id: lifeAreas.id })
    if (!relations || !wellbeing) throw new Error('example_areas_not_created')
    const [friendshipGoal, wellnessGoal] = await tx.insert(goals).values([
      { userId, lifeAreaId: relations.id, title: 'Ejemplo · Cuidar mis amistades', description: 'Un ejemplo que puedes editar o archivar.', periodType: 'month', startDate: today, targetDate: addCalendarDays(today, 30) },
      { userId, lifeAreaId: wellbeing.id, title: 'Ejemplo · Salir a caminar', description: 'Hazlo a tu ritmo.', periodType: 'week', startDate: today, targetDate: addCalendarDays(today, 6) },
    ]).returning({ id: goals.id })
    if (!friendshipGoal || !wellnessGoal) throw new Error('example_goals_not_created')

    await tx.insert(tasks).values([
      { userId, goalId: friendshipGoal.id, title: 'Ejemplo · Escribir a Alex', priority: 'high', dueAt: exampleTime(tomorrow, '15:00', timeZone) },
      { userId, goalId: wellnessGoal.id, title: 'Ejemplo · Preparar una caminata', priority: 'normal', dueAt: exampleTime(nextDay, '16:00', timeZone) },
      { userId, title: 'Ejemplo · Elegir un momento para reflexionar', status: 'completed', completedAt: now, priority: 'low' },
    ])

    const [coffeeEvent, walkingEvent] = await tx.insert(events).values([
      { userId, goalId: friendshipGoal.id, title: 'Ejemplo · Conversar con Alex', description: 'Un encuentro ficticio para explorar la agenda.', category: 'Social', color: 'sage', allDay: false, startAt: exampleTime(tomorrow, '10:00', timeZone), endAt: exampleTime(tomorrow, '11:00', timeZone), timeZone },
      { userId, goalId: wellnessGoal.id, title: 'Ejemplo · Caminata por la plaza', category: 'Bienestar', color: 'amber', allDay: false, startAt: exampleTime(nextDay, '17:00', timeZone), endAt: exampleTime(nextDay, '18:00', timeZone), timeZone },
      { userId, title: 'Ejemplo · Día para revisar mi plan', category: 'Personal', color: 'navy', allDay: true, startDate: addCalendarDays(today, 3), endDate: addCalendarDays(today, 3) },
    ]).returning({ id: events.id })
    if (!coffeeEvent || !walkingEvent) throw new Error('example_events_not_created')

    const [alex] = await tx.insert(people).values([
      { userId, name: 'Alex Rivera · ejemplo', relationship: 'friend', notes: 'Persona ficticia. Puedes cambiar este contacto por alguien real.', avatarColor: 'sage' },
      { userId, name: 'Sam Torres · ejemplo', relationship: 'community', notes: 'Otro contacto ficticio para probar la organización.', avatarColor: 'amber' },
    ]).returning({ id: people.id })
    if (!alex) throw new Error('example_person_not_created')
    const [plaza] = await tx.insert(places).values([
      { userId, name: 'Plaza Murillo · ejemplo', type: 'community', address: 'Plaza Murillo, La Paz · ubicación de ejemplo', latitude: -16.4957, longitude: -68.1336 },
      { userId, name: 'Plaza San Francisco · ejemplo', type: 'community', address: 'Plaza San Francisco, La Paz · ubicación de ejemplo', latitude: -16.4969, longitude: -68.1374 },
    ]).returning({ id: places.id })
    if (!plaza) throw new Error('example_place_not_created')

    await tx.insert(eventPeople).values({ userId, eventId: coffeeEvent.id, personId: alex.id })
    await tx.insert(eventPlaces).values([
      { userId, eventId: coffeeEvent.id, placeId: plaza.id },
      { userId, eventId: walkingEvent.id, placeId: plaza.id },
    ])
    return { created: true }
  })
}
