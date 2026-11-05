import { z } from 'zod'

export const placeTypeSchema = z.enum(['home', 'church', 'work', 'school', 'community', 'other'])

const placeFields = z.object({
  name: z.string().trim().min(1).max(120),
  type: placeTypeSchema,
  address: z.string().trim().max(240).nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
}).strict()

export const createPlaceSchema = placeFields.superRefine((place, context) => {
  const hasLatitude = place.latitude !== undefined && place.latitude !== null
  const hasLongitude = place.longitude !== undefined && place.longitude !== null
  if (hasLatitude !== hasLongitude) {
    context.addIssue({ code: 'custom', path: [hasLatitude ? 'longitude' : 'latitude'], message: 'Indica latitud y longitud juntas, o deja ambas vacías.' })
  }
})

export const updatePlaceSchema = placeFields.partial().superRefine((place, context) => {
  if (Object.keys(place).length === 0) context.addIssue({ code: 'custom', message: 'Incluye al menos un cambio.' })
  const hasLatitude = Object.hasOwn(place, 'latitude')
  const hasLongitude = Object.hasOwn(place, 'longitude')
  if (hasLatitude !== hasLongitude) {
    context.addIssue({ code: 'custom', path: [hasLatitude ? 'longitude' : 'latitude'], message: 'Actualiza latitud y longitud juntas, o deja ambas sin cambios.' })
  } else if (hasLatitude && ((place.latitude === null) !== (place.longitude === null))) {
    context.addIssue({ code: 'custom', path: ['longitude'], message: 'Indica las dos coordenadas o borra ambas.' })
  }
})
export const placeSearchSchema = z.object({ q: z.string().trim().max(80).optional() }).strict()
export const placeEventLinksSchema = z.object({ eventIds: z.array(z.uuid()).max(100) }).strict()

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>
