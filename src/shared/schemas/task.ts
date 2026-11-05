import { z } from 'zod'

export const taskStatusSchema = z.enum(['open', 'completed'])
export const taskPrioritySchema = z.enum(['low', 'normal', 'high'])

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  goalId: z.uuid().nullable().optional(),
  priority: taskPrioritySchema.default('normal'),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
}).strict()

export const updateTaskSchema = createTaskSchema.partial().extend({ status: taskStatusSchema.optional() }).strict()
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
