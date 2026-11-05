// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MapPage } from '../../src/map-page.js'

vi.mock('../../src/map/map-canvas.js', () => ({
  MapCanvas: ({ focusPoint, onTileError }: { focusPoint?: [number, number] | null; onTileError: () => void }) => <div data-testid="map-canvas">{focusPoint?.join(',')}<button type="button" onClick={onTileError}>Simular fallo de imágenes</button></div>,
}))

afterEach(() => cleanup())

describe('Map page privacy gate', () => {
  it('does not mount the tile map until the user accepts the provider notice', async () => {
    const place = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Fixture place', type: 'home', address: null, latitude: -16.5, longitude: -68.15,
    }
    const request = vi.fn(async <T,>(path: string) => {
      if (path === '/places?archived=true') return [] as T
      if (path === '/places') return [place] as T
      return [] as T
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MapPage userId="user-test" timeZone="America/La_Paz" request={request} /></QueryClientProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Mapa' }))
    expect(await screen.findByText(/el proveedor recibe solo la zona visible/)).toBeTruthy()
    expect(screen.queryByTestId('map-canvas')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Cargar mapa de OpenStreetMap' }))
    expect(await screen.findByTestId('map-canvas')).toBeTruthy()
  })

  it('keeps list and map separate and focuses a selected saved place', async () => {
    const place = { id: 'place-1', name: 'Casa', type: 'home', address: 'Calle 1', latitude: -16.5, longitude: -68.15 }
    const request = vi.fn(async <T,>(path: string) => path === '/places' ? [place] as T : [] as T)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MapPage userId="user-test" timeZone="America/La_Paz" request={request} /></QueryClientProvider>)

    expect(screen.queryByTestId('map-canvas')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Casa, ver en mapa' }))
    expect(screen.queryByRole('searchbox', { name: 'Buscar lugares' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar mapa de OpenStreetMap' }))
    expect((await screen.findByTestId('map-canvas')).textContent).toContain('-16.5,-68.15')
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
    expect(screen.queryByTestId('map-canvas')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Buscar lugares' })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Acciones de Casa'))
    expect(screen.getByRole('button', { name: 'Editar Casa' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archivar Casa' })).toBeTruthy()
  })

  it('offers retry and the saved list when map images fail', async () => {
    const request = vi.fn(async <T,>() => [] as T)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MapPage userId="user-test" timeZone="America/La_Paz" request={request} /></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cargar mapa de OpenStreetMap' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simular fallo de imágenes' }))
    expect(screen.getByRole('alert').textContent).toContain('Tus lugares siguen disponibles')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar mapa' }))
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Simular fallo de imágenes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    expect(screen.queryByTestId('map-canvas')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Buscar lugares' })).toBeTruthy()
  })
})
