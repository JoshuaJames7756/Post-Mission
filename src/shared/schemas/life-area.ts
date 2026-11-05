import { z } from 'zod'

export const createLifeAreaSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(32).nullable().optional(),
}).strict()

export const updateLifeAreaSchema = createLifeAreaSchema.partial().extend({
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict()

export const reorderLifeAreasSchema = z.object({
  areaIds: z.array(z.uuid()).min(1).refine((ids) => new Set(ids).size === ids.length, {
    message: 'Una misma área no puede aparecer más de una vez.',
  }),
}).strict()

export type CreateLifeAreaInput = z.infer<typeof createLifeAreaSchema>
export type UpdateLifeAreaInput = z.infer<typeof updateLifeAreaSchema>
export type ReorderLifeAreasInput = z.infer<typeof reorderLifeAreasSchema>
