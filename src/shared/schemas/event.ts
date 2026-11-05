import { z } from 'zod'

export const eventStatusSchema = z.enum(['scheduled', 'completed', 'cancelled'])
export const eventColorSchema = z.enum(['sage', 'amber', 'navy', 'slate'])

const eventFields = {
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().min(1).max(40),
  color: eventColorSchema,
  goalId: z.uuid().nullable().optional(),
}

const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Usa una fecha y hora local válidas.')
const offsetMinutesSchema = z.number().int().min(-840).max(840)

const allDayEventSchema = z.object({
  ...eventFields,
  allDay: z.literal(true),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).strict()

const timedEventSchema = z.object({
  ...eventFields,
  allDay: z.literal(false),
  startLocal: localDateTimeSchema,
  endLocal: localDateTimeSchema,
  timeZone: z.string().trim().min(1).max(100),
  startOffsetMinutes: offsetMinutesSchema,
  endOffsetMinutes: offsetMinutesSchema,
}).strict()

export const createEventSchema = z.union([allDayEventSchema, timedEventSchema]).superRefine((event, context) => {
  if (event.allDay && event.endDate < event.startDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'La fecha final debe ser igual o posterior a la inicial.' })
  }
})

export const eventRangeQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  timeZone: z.string().trim().min(1).max(100),
}).strict().superRefine((range, context) => {
  if (range.to < range.from) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'La fecha final debe ser igual o posterior a la inicial.' })
  } else if (Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`) > 90 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'El calendario solo permite consultar hasta 90 días por solicitud.' })
  }
})

export type CreateEventInput = z.infer<typeof createEventSchema>
