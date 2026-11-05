// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReviewsPage } from '../../src/reviews-page.js'
import { getCalendarDate } from '../../src/date-utils.js'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup(request: <T>(path: string, options?: RequestInit) => Promise<T>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><ReviewsPage userId="test-user" timeZone="America/La_Paz" request={request} /></QueryClientProvider>)
  return client
}

describe('review autosave feedback', () => {
  it('shares a completed weekly review only after the share button is pressed', async () => {
    const start = getCalendarDate(new Date(), 'America/La_Paz')
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {})
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const request = vi.fn(async <T,>(path: string): Promise<T> => {
      if (path === '/reviews') return [] as T
      if (path === '/goals') return [{ id: 'goal-1', title: 'Visitar a un amigo', status: 'completed', periodType: 'week', targetDate: start }] as T
      return { id: 'review-1', periodType: 'weekly', periodStart: start, wins: 'Avancé con constancia', challenges: 'Privado', reflection: 'Privado', nextSteps: 'Escuchar mejor', status: 'completed', revision: 2, updatedAt: new Date().toISOString(), completedAt: new Date().toISOString() } as T
    })
    const client = setup(request)
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    const button = await screen.findByRole('button', { name: 'Compartir con un mentor / compañero' })
    expect(share).not.toHaveBeenCalled()
    fireEvent.click(button)
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Escuchar mejor') })))
    expect(share.mock.calls[0]?.[0].text).toContain('Visitar a un amigo')
    expect(share.mock.calls[0]?.[0].text).not.toContain('Privado')
    client.clear()
  })

  it('guides the weekly review through goals, wins, and next steps', async () => {
    const request = vi.fn(async <T,>(path: string): Promise<T> => {
      if (path === '/reviews') return [] as T
      if (path === '/goals') return [{ id: 'goal-1', title: 'Visitar a un amigo', status: 'active', periodType: 'week', targetDate: '2026-11-10' }] as T
      return null as T
    })
    const client = setup(request)
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    expect(await screen.findByText('Mira lo que planeaste')).toBeTruthy()
    expect(await screen.findByText('Visitar a un amigo')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Dificultades' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Celebra lo que avanzó')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Logros' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Elige tu enfoque')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Próximos pasos' })).toBeTruthy()
    client.clear()
  })

  it('waits for server confirmation before saying saved and then allows completion', async () => {
    const start = getCalendarDate(new Date(), 'America/La_Paz')
    let confirmSave!: (value: unknown) => void
    const pendingSave = new Promise((resolve) => { confirmSave = resolve })
    const request = vi.fn(async <T,>(path: string, options?: RequestInit): Promise<T> => {
      if (path === '/reviews') return [] as T
      if (!options?.method) return null as T
      if (options.method === 'PUT') return pendingSave as T
      return { id: 'review-1', periodType: 'daily', periodStart: start, wins: 'Terminé una tarea', challenges: '', reflection: '', nextSteps: '', status: 'completed', revision: 2, updatedAt: new Date().toISOString(), completedAt: new Date().toISOString() } as T
    })
    const client = setup(request)
    await screen.findByText('Nuevo borrador')
    fireEvent.change(screen.getByRole('textbox', { name: 'Logros' }), { target: { value: 'Terminé una tarea' } })
    expect(screen.getByText('Cambios sin guardar')).toBeTruthy()
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/reviews/daily/${start}`, expect.objectContaining({ method: 'PUT' })), { timeout: 2000 })
    expect(screen.getByText('Guardando…')).toBeTruthy()
    expect(screen.queryByText('Guardado')).toBeNull()
    confirmSave({ id: 'review-1', periodType: 'daily', periodStart: start, wins: 'Terminé una tarea', challenges: '', reflection: '', nextSteps: '', status: 'draft', revision: 1, updatedAt: new Date().toISOString(), completedAt: null })
    await screen.findByText('Guardado')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como completada' }))
    await screen.findByText('Completada')
    expect(screen.getByRole('textbox', { name: 'Logros' }).hasAttribute('disabled')).toBe(true)
    client.clear()
  })

  it('marks unsaved text honestly when the server rejects the save', async () => {
    const request = vi.fn(async <T,>(path: string, options?: RequestInit): Promise<T> => {
      if (path === '/reviews') return [] as T
      if (options?.method === 'PUT') throw new Error('Sin conexión')
      return null as T
    })
    const client = setup(request)
    await screen.findByText('Nuevo borrador')
    fireEvent.change(screen.getByRole('textbox', { name: 'Reflexión' }), { target: { value: 'Texto sin guardar' } })
    await screen.findByText('Error al guardar', {}, { timeout: 2000 })
    expect(screen.getByText(/Este texto aún no está guardado/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Reflexión' }).hasAttribute('disabled')).toBe(true)
    client.clear()
  })
})
