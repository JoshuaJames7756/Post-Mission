import { z } from 'zod'

export const personRelationshipSchema = z.enum(['family', 'friend', 'mentor', 'community', 'other'])
export const personAvatarColorSchema = z.enum(['sage', 'amber', 'navy', 'slate', 'plum'])

export const createPersonSchema = z.object({
  name: z.string().trim().min(1).max(100),
  relationship: personRelationshipSchema,
  phone: z.string().trim().max(32).nullable().optional(),
  birthday: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  avatarColor: personAvatarColorSchema,
}).strict()

export const updatePersonSchema = createPersonSchema.partial().refine((person) => Object.keys(person).length > 0)

export const personSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
}).strict()

export const personEventLinksSchema = z.object({ eventIds: z.array(z.uuid()).max(100) }).strict()

export type CreatePersonInput = z.infer<typeof createPersonSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>
