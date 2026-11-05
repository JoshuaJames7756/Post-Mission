import { z } from 'zod'

export const reminderCategorySchema = z.enum(['tasks', 'events', 'reviews'])

export const reminderPreferencesSchema = z.strictObject({
  remindTasks: z.boolean().optional(),
  remindEvents: z.boolean().optional(),
  remindReviews: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Selecciona al menos una preferencia.')
