import { describe, expect, it, vi } from 'vitest'
import { seedExamples } from '../../src/server/modules/examples/service.js'

describe('example data loading', () => {
  it('returns without inserting anything when this account already has the example marker', async () => {
    const insert = vi.fn()
    const tx = {
      execute: vi.fn(),
      insert,
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 'existing-example-area' }] }) }) }),
    }
    const db = { transaction: async (operation: (value: typeof tx) => Promise<unknown>) => operation(tx) }

    expect(await seedExamples(db as never, 'user-one')).toEqual({ created: false })
    expect(tx.execute).toHaveBeenCalledOnce()
    expect(insert).not.toHaveBeenCalled()
  })
})
