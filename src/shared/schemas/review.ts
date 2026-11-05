import { z } from 'zod'

export const reviewPeriodTypeSchema = z.enum(['daily', 'weekly'])
export const reviewFieldsSchema = z.object({
  wins: z.string().max(5000),
  challenges: z.string().max(5000),
  reflection: z.string().max(5000),
  nextSteps: z.string().max(5000),
}).strict()
export const saveReviewSchema = reviewFieldsSchema.extend({ baseRevision: z.number().int().min(0) }).strict()
export const reviewRevisionSchema = z.object({ baseRevision: z.number().int().min(1) }).strict()
export type ReviewFields = z.infer<typeof reviewFieldsSchema>
