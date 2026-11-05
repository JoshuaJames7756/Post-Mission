// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickAdd } from '../../src/quick-add.js'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('global quick capture', () => {
  it('creates a task and a note without changing the current view', async () => {
    window.location.hash = '#people'
    const request = vi.fn(async <T,>() => ({ id: 'saved' }) as T)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><QuickAdd userId="test-user" request={request} online /></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Captura rápida' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '¿Qué harás?' })))
    fireEvent.change(screen.getByRole('textbox', { name: '¿Qué harás?' }), { target: { value: 'Llamar a Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir tarea' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/tasks', expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'Llamar a Ana', priority: 'normal' }) })))

    fireEvent.click(screen.getByRole('button', { name: 'Captura rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nota o impresión' }))
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Título de la nota' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Título de la nota' }), { target: { value: 'Una idea' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu impresión' }), { target: { value: 'Recordar este momento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/notes', expect.objectContaining({ method: 'POST' })))
    expect(window.location.hash).toBe('#people')
    client.clear()
  })
})
