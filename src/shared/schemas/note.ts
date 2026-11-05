import { z } from 'zod'

export const noteLinksSchema = z.object({
  goalIds: z.array(z.uuid()).max(100),
  taskIds: z.array(z.uuid()).max(100),
  eventIds: z.array(z.uuid()).max(100),
  personIds: z.array(z.uuid()).max(100),
  placeIds: z.array(z.uuid()).max(100),
}).strict()

export const saveNoteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().max(20_000),
  links: noteLinksSchema,
}).strict()

export type SaveNoteInput = z.infer<typeof saveNoteSchema>
