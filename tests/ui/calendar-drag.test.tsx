// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { CalendarPage } from '../../src/calendar-page.js'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal; delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close })

it('moves a timed event by dragging and saves its new time once', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-03T14:00:00Z'))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const event = { id: 'meeting', title: 'Estudio', description: null, category: 'Espiritual', color: 'sage', goalId: null, allDay: false, startDate: null, endDate: null, startAt: '2026-11-03T13:00:00Z', endAt: '2026-11-03T14:00:00Z', timeZone: 'America/La_Paz', status: 'scheduled' }
  const request = vi.fn(async (path: string, options?: RequestInit) => options ? event : path.includes('archived=true') ? [] : path.startsWith('/events?') ? [event] : event)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><CalendarPage userId="test-user" timeZone="America/La_Paz" goals={[]} request={request} /></QueryClientProvider>)
  const block = await screen.findByRole('button', { name: 'Editar Estudio, 09:00 a 10:00' })
  fireEvent.pointerDown(block, { pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, clientY: 300 })
  fireEvent.pointerMove(block, { pointerId: 1, isPrimary: true, pointerType: 'mouse', clientY: 330 })
  expect(block.style.top).toBe('570px')
  fireEvent.pointerUp(block, { pointerId: 1, isPrimary: true, pointerType: 'mouse', clientY: 330 })
  await waitFor(() => expect(request).toHaveBeenCalledWith('/events/meeting', expect.objectContaining({ method: 'PATCH' })))
  const save = request.mock.calls.find(([path]) => path === '/events/meeting')
  expect(JSON.parse(save?.[1]?.body as string)).toMatchObject({ startLocal: '2026-11-03T09:30', endLocal: '2026-11-03T10:30' })
  expect(screen.queryByRole('form', { name: 'Editar evento' })).toBeNull()
  client.clear()
})

it('places a single-day all-day event on the hourly timeline', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-03T14:00:00Z'))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const event = { id: 'study', title: 'Estudio', description: null, category: 'Espiritual', color: 'sage', goalId: null, allDay: true, startDate: '2026-11-03', endDate: '2026-11-03', startAt: null, endAt: null, timeZone: 'America/La_Paz', status: 'scheduled' }
  const request = vi.fn(async (path: string, options?: RequestInit) => options ? event : path.includes('archived=true') ? [] : path.startsWith('/events?') ? [event] : event)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(<QueryClientProvider client={client}><CalendarPage userId="test-user" timeZone="America/La_Paz" goals={[]} request={request} /></QueryClientProvider>)
  const block = await screen.findByRole('button', { name: 'Arrastrar al horario o editar Estudio' })
  const slots = container.querySelector('.calendar-time-slots')!
  vi.spyOn(slots, 'getBoundingClientRect').mockReturnValue({ left: 50, right: 400, top: 0, bottom: 1440, width: 350, height: 1440, x: 50, y: 0, toJSON: () => ({}) })
  fireEvent.pointerDown(block, { pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, clientX: 120, clientY: 100 })
  fireEvent.pointerMove(block, { pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: 120, clientY: 570 })
  expect(container.querySelector('.calendar-all-day-drop-preview')?.textContent).toContain('09:30')
  fireEvent.pointerUp(block, { pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: 120, clientY: 570 })
  await waitFor(() => expect(request).toHaveBeenCalledWith('/events/study', expect.objectContaining({ method: 'PATCH' })))
  const save = request.mock.calls.find(([path]) => path === '/events/study')
  expect(JSON.parse(save?.[1]?.body as string)).toMatchObject({ allDay: false, startLocal: '2026-11-03T09:30', endLocal: '2026-11-03T10:30' })
  client.clear()
})

it('opens event creation over the agenda and applies a quick event type', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const request = vi.fn(async () => [])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><CalendarPage userId="test-user" timeZone="America/La_Paz" goals={[]} request={request} /></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir evento' }))
  expect(screen.getByRole('dialog', { name: 'Crear evento' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Familia' }))
  expect((screen.getByRole('textbox', { name: 'Categoría' }) as HTMLInputElement).value).toBe('Familia')
  expect(screen.getByRole('button', { name: 'Color Salvia' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  client.clear()
})
