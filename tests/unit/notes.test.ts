import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { noteEvents, noteGoals, notePeople, notePlaces, noteTasks, notes, tasks } from '../../src/server/db/schema.js'
import { saveNoteSchema } from '../../src/shared/schemas/note.js'
import * as service from '../../src/server/modules/notes/service.js'

const emptyLinks = { goalIds: [], taskIds: [], eventIds: [], personIds: [], placeIds: [] }

describe('private notes', () => {
  it('uses owner-scoped foreign keys for every association', () => {
    expect(getTableConfig(notes).uniqueConstraints.map((item) => item.name)).toContain('notes_user_id_id_unique')
    expect(getTableConfig(tasks).uniqueConstraints.map((item) => item.name)).toContain('tasks_user_id_id_unique')
    for (const table of [noteGoals, noteTasks, noteEvents, notePeople, notePlaces]) {
      const config = getTableConfig(table)
      expect(config.foreignKeys).toHaveLength(2)
      expect(config.foreignKeys.every((key) => key.reference().columns[0]?.name === 'user_id')).toBe(true)
    }
  })

  it('rejects untrusted ownership fields and oversized content', () => {
    expect(saveNoteSchema.safeParse({ title: 'Nota', content: 'Texto', links: emptyLinks, userId: 'foreign-user' }).success).toBe(false)
    expect(saveNoteSchema.safeParse({ title: 'Nota', content: 'a'.repeat(20_001), links: emptyLinks }).success).toBe(false)
    expect(saveNoteSchema.safeParse({ title: 'Nota', content: '', links: emptyLinks }).success).toBe(true)
  })

  it('does not change links when the note is outside the account', async () => {
    const select = vi.fn()
    const remove = vi.fn()
    const tx = { update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }), select, delete: remove }
    const db = { transaction: (operation: (value: typeof tx) => unknown) => operation(tx) }
    await expect(service.update(db as never, 'owner', '00000000-0000-4000-8000-000000000001', { title: 'Nota', content: '', links: emptyLinks })).resolves.toBeNull()
    expect(select).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejects a link that does not belong to the authenticated account', async () => {
    const remove = vi.fn()
    const tx = {
      insert: () => ({ values: () => ({ returning: async () => [{ id: '00000000-0000-4000-8000-000000000002' }] }) }),
      select: () => ({ from: () => ({ where: async () => [] }) }),
      delete: remove,
    }
    const db = { transaction: (operation: (value: typeof tx) => unknown) => operation(tx) }
    await expect(service.create(db as never, 'owner', {
      title: 'Nota', content: '', links: { ...emptyLinks, goalIds: ['00000000-0000-4000-8000-000000000003'] },
    })).rejects.toBeInstanceOf(service.NoteLinkError)
    expect(remove).not.toHaveBeenCalled()
  })
})
