// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { CalendarPage } from '../../src/calendar-page.js'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('actualiza la hora sin mover el horario y permite volver a Ahora con Hoy', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-11-01T14:00:00Z'))
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const request = async () => []
  render(<QueryClientProvider client={client}><CalendarPage userId="test-user" timeZone="America/La_Paz" goals={[]} request={request} /></QueryClientProvider>)
  await screen.findByText('Ahora · 10:00')
  const schedule = screen.getByRole('region', { name: /Horario del/ })
  expect(scrollTo).toHaveBeenCalled()
  scrollTo.mockClear()
  await act(async () => { vi.advanceTimersByTime(60_000) })
  expect(screen.getByText('Ahora · 10:01')).toBeDefined()
  expect(scrollTo).not.toHaveBeenCalled()

  visibility.mockReturnValue('hidden')
  await act(async () => { vi.advanceTimersByTime(180_000) })
  expect(screen.getByText('Ahora · 10:01')).toBeDefined()
  visibility.mockReturnValue('visible')
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(screen.getByText('Ahora · 10:04')).toBeDefined()
  expect(scrollTo).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Hoy', exact: true }))
  expect(scrollTo).toHaveBeenCalledOnce()
  expect(scrollTo).toHaveBeenCalledWith({ top: expect.any(Number), behavior: 'auto' })
  expect(schedule.scrollTop).toBe(0)
  client.clear()
})
