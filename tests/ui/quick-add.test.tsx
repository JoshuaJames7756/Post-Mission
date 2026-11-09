// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickAdd } from '../../src/quick-add.js'
import { createEventSchema } from '../../src/shared/schemas/event.js'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('global quick capture', () => {
  it('creates a task, a note and an event without changing the current view', async () => {
    window.location.hash = '#people'
    const request = vi.fn(async <T,>() => ({ id: 'saved' }) as T)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><QuickAdd userId="test-user" request={request} online timeZone="America/La_Paz" /></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Captura rápida' }))
    expect(screen.getByRole('heading', { name: '¿Qué quieres guardar?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tarea rápida/ }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '¿Qué harás?' })))
    fireEvent.change(screen.getByRole('textbox', { name: '¿Qué harás?' }), { target: { value: 'Llamar a Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir tarea' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/tasks', expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'Llamar a Ana', priority: 'normal' }) })))

    fireEvent.click(screen.getByRole('button', { name: 'Captura rápida' }))
    fireEvent.click(screen.getByRole('button', { name: /Nota o impresión/ }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Título de la nota' })))
    fireEvent.change(screen.getByRole('textbox', { name: 'Título de la nota' }), { target: { value: 'Una idea' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu nota' }), { target: { value: 'Recordar este momento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/notes', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nueva nota' })).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Captura rápida' }))
    fireEvent.click(screen.getByRole('button', { name: /Evento/ }))
    fireEvent.change(screen.getByRole('textbox', { name: '¿Qué vas a planificar?' }), { target: { value: 'Reunión semanal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reunión' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar evento' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/events', expect.objectContaining({ method: 'POST' })))
    const eventBody = JSON.parse(request.mock.calls.find(([path]) => path === '/events')![1]!.body as string)
    expect(eventBody).toMatchObject({ title: 'Reunión semanal', category: 'Reunión', color: 'navy', allDay: true })
    expect(window.location.hash).toBe('#people')
    client.clear()
  })

  it('sends a valid timed event and prevents an end before its start', async () => {
    const request = vi.fn(async <T,>() => ({ id: 'saved' }) as T)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><QuickAdd userId="test-user" request={request} online timeZone="America/La_Paz" /></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Captura rápida' }))
    fireEvent.click(screen.getByRole('button', { name: /Evento/ }))
    fireEvent.change(screen.getByRole('textbox', { name: '¿Qué vas a planificar?' }), { target: { value: 'Visitar a Ana' } })
    fireEvent.change(screen.getByLabelText('Empieza'), { target: { value: '2026-11-10T10:00' } })
    fireEvent.change(screen.getByLabelText('Termina'), { target: { value: '2026-11-10T09:00' } })
    expect(screen.getByRole('button', { name: 'Guardar evento' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Termina'), { target: { value: '2026-11-10T11:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar evento' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/events', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse(request.mock.calls[0]![1]!.body as string)
    expect(createEventSchema.safeParse(body).success).toBe(true)
    expect(body).toMatchObject({ title: 'Visitar a Ana', allDay: false, timeZone: 'America/La_Paz', startOffsetMinutes: -240, endOffsetMinutes: -240 })
    client.clear()
  })
})
