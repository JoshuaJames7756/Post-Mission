// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { PeoplePage } from '../../src/people-page.js'
import { MapPage } from '../../src/map-page.js'

afterEach(cleanup)

describe.each([
  { domain: 'people', label: 'personas', Page: PeoplePage, item: { id: 'person', name: 'Ana', relationship: 'friend', phone: null, birthday: null, notes: null, avatarColor: 'sage' } },
  { domain: 'places', label: 'lugares', Page: MapPage, item: { id: 'place', name: 'Casa', type: 'home', address: null, latitude: null, longitude: null } },
])('búsqueda en $domain', ({ domain, label, Page, item }) => {
  it('agrupa pulsaciones y conserva la lista hasta recibir los resultados nuevos', async () => {
    const searches: string[] = []
    let resolveSearch!: (data: unknown[]) => void
    const pendingSearch = new Promise<unknown[]>((resolve) => { resolveSearch = resolve })
    const request = async <T,>(path: string): Promise<T> => {
      if (path.startsWith(`/${domain}?q=`)) {
        searches.push(path)
        return await pendingSearch as T
      }
      return (path === `/${domain}` ? [item] : []) as T
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><Page userId="test-user" timeZone="America/La_Paz" request={request} /></QueryClientProvider>)
    await screen.findByRole('heading', { name: item.name })
    await userEvent.type(screen.getByRole('searchbox', { name: `Buscar ${label}` }), 'Sol')
    await waitFor(() => expect(searches).toEqual([`/${domain}?q=Sol`]))
    expect(screen.getByRole('heading', { name: item.name })).toBeDefined()
    expect(screen.queryByRole('status', { name: `Cargando ${label}` })).toBeNull()
    await act(async () => { resolveSearch([]) })
    await screen.findByText(`No encontramos ${label} con esa búsqueda.`)
    expect(screen.queryByRole('heading', { name: item.name })).toBeNull()
    client.clear()
  })
})
