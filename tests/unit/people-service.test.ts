import { afterEach, describe, expect, it, vi } from 'vitest'
import * as repository from '../../src/server/modules/people/repository.js'
import * as service from '../../src/server/modules/people/service.js'

const personId = '00000000-0000-4000-8000-000000000011'
const eventA = '00000000-0000-4000-8000-000000000012'
const eventB = '00000000-0000-4000-8000-000000000013'

afterEach(() => vi.restoreAllMocks())

function database(ownsPerson = true) {
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => ownsPerson ? [{ id: personId }] : [] }) }) }),
  }
  return { transaction: (operation: (transaction: typeof tx) => unknown) => operation(tx) }
}

describe('person event associations', () => {
  it('does not inspect or replace event links for a person outside the account', async () => {
    const listEvents = vi.spyOn(repository, 'listOwnedActiveEvents')
    const replace = vi.spyOn(repository, 'replacePersonEvents')

    await expect(service.replaceEvents(database(false) as never, 'user-alpha', personId, [eventA]))
      .resolves.toBeNull()
    expect(listEvents).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('requires every selected event to belong to the same owner before replacing links', async () => {
    vi.spyOn(repository, 'listOwnedActiveEvents').mockResolvedValue([{ id: eventA }] as never)
    const replace = vi.spyOn(repository, 'replacePersonEvents').mockResolvedValue(undefined)

    await expect(service.replaceEvents(database() as never, 'user-alpha', personId, [eventA, eventB]))
      .rejects.toMatchObject({ code: 'invalid_event' })
    expect(replace).not.toHaveBeenCalled()
  })

  it('deduplicates event IDs and saves only verified active events', async () => {
    vi.spyOn(repository, 'listOwnedActiveEvents').mockResolvedValue([{ id: eventA }] as never)
    const replace = vi.spyOn(repository, 'replacePersonEvents').mockResolvedValue(undefined)
    vi.spyOn(repository, 'listPersonEvents').mockResolvedValue([] as never)

    await service.replaceEvents(database() as never, 'user-alpha', personId, [eventA, eventA])
    expect(replace).toHaveBeenCalledWith(expect.anything(), 'user-alpha', personId, [eventA])
  })
})
