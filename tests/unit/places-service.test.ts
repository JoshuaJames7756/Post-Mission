import { afterEach, describe, expect, it, vi } from 'vitest'
import * as repository from '../../src/server/modules/places/repository.js'
import * as service from '../../src/server/modules/places/service.js'

const placeId = '00000000-0000-4000-8000-000000000021'
const eventId = '00000000-0000-4000-8000-000000000022'
const foreignEventId = '00000000-0000-4000-8000-000000000023'

afterEach(() => vi.restoreAllMocks())

function database() {
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: placeId }] }) }) }),
  }
  return { transaction: (operation: (transaction: typeof tx) => unknown) => operation(tx) }
}

describe('place event associations', () => {
  it('refuses to replace links with events owned by another user', async () => {
    vi.spyOn(repository, 'listOwnedActiveEvents').mockResolvedValue([{ id: eventId }] as never)
    const replace = vi.spyOn(repository, 'replacePlaceEvents').mockResolvedValue(undefined)

    await expect(service.replaceEvents(database() as never, 'user-alpha', placeId, [eventId, foreignEventId]))
      .rejects.toMatchObject({ code: 'invalid_event' })
    expect(replace).not.toHaveBeenCalled()
  })

  it('deduplicates requested events before saving verified links', async () => {
    vi.spyOn(repository, 'listOwnedActiveEvents').mockResolvedValue([{ id: eventId }] as never)
    const replace = vi.spyOn(repository, 'replacePlaceEvents').mockResolvedValue(undefined)
    vi.spyOn(repository, 'listPlaceEvents').mockResolvedValue([] as never)

    await service.replaceEvents(database() as never, 'user-alpha', placeId, [eventId, eventId])
    expect(replace).toHaveBeenCalledWith(expect.anything(), 'user-alpha', placeId, [eventId])
  })
})
