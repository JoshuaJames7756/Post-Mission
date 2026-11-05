import { z } from 'zod'

export const journeyDisplayModeSchema = z.enum(['elapsed', 'days'])

export const updateJourneySchema = z.object({
  returnDate: z.iso.date().nullable().optional(),
  displayMode: journeyDisplayModeSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Incluye al menos un cambio.')

const milestoneFields = z.object({
  title: z.string().trim().min(1).max(120),
  milestoneDate: z.iso.date(),
  description: z.string().trim().max(1000).nullable().optional(),
}).strict()

export const createMilestoneSchema = milestoneFields
export const updateMilestoneSchema = milestoneFields.partial().refine((value) => Object.keys(value).length > 0, 'Incluye al menos un cambio.')

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>
