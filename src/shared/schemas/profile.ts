import { z } from 'zod'

export const themePreferenceSchema = z.enum(['system', 'light', 'dark'])

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  purpose: z.string().trim().max(500).nullable().optional(),
  timezone: z.string().trim().min(1).max(100),
  themePreference: themePreferenceSchema,
}).strict()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
