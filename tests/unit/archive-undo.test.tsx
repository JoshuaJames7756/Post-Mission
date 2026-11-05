// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { PeoplePage } from '../../src/people-page.js'
import { MapPage } from '../../src/map-page.js'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
afterEach(cleanup)

describe.each([
  { domain: 'people', Page: PeoplePage, item: { id: 'test-person', name: 'Contacto de prueba', relationship: 'friend', phone: null, birthday: null, notes: null, avatarColor: 'sage' } },
  { domain: 'places', Page: MapPage, item: { id: 'test-place', name: 'Lugar de prueba', type: 'other', address: null, latitude: null, longitude: null } },
])('archivar y deshacer en $domain', ({ domain, Page, item }) => {
  it('restaura el elemento y sincroniza la lista después de pulsar Deshacer', async () => {
    let archived = false
    const writes: string[] = []
    const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
      if (options?.method === 'POST') {
        writes.push(path)
        archived = path.endsWith('/archive')
        return undefined as T
      }
      if (path === `/${domain}`) return (archived ? [] : [item]) as T
      if (path === `/${domain}?archived=true`) return (archived ? [item] : []) as T
      return [] as T
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><Page userId="test-user" timeZone="America/La_Paz" request={request} /></QueryClientProvider>)
    await screen.findByRole('heading', { name: item.name })
    await userEvent.click(screen.getByLabelText(`Acciones de ${item.name}`))
    await userEvent.click(screen.getByRole('button', { name: `Archivar ${item.name}` }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: item.name })).toBeNull())
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    const options = vi.mocked(toast.success).mock.calls[0]![1] as { action: { label: string; onClick: () => void } }
    expect(options.action.label).toBe('Deshacer')
    await act(async () => { options.action.onClick() })
    await screen.findByRole('heading', { name: item.name })
    expect(writes).toEqual([`/${domain}/${item.id}/archive`, `/${domain}/${item.id}/restore`])
    expect(toast.error).not.toHaveBeenCalled()
    client.clear()
  })
})
