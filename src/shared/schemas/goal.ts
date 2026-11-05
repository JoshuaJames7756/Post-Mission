import { z } from 'zod'

export const goalPeriodSchema = z.enum(['year', 'month', 'week', 'day'])
export const goalStatusSchema = z.enum(['active', 'completed'])

const goalFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  lifeAreaId: z.uuid().nullable().optional(),
  parentGoalId: z.uuid().nullable().optional(),
  periodType: goalPeriodSchema,
  startDate: z.iso.date(),
  targetDate: z.iso.date(),
}).strict()

export const createGoalSchema = goalFieldsSchema.refine((value) => value.targetDate >= value.startDate, {
  message: 'La fecha objetivo debe ser igual o posterior al inicio.', path: ['targetDate'],
})
export const updateGoalSchema = goalFieldsSchema.partial().strict().refine(
  (value) => !value.startDate || !value.targetDate || value.targetDate >= value.startDate,
  { message: 'La fecha objetivo debe ser igual o posterior al inicio.', path: ['targetDate'] },
)

export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
