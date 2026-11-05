// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { CalendarPage } from '../../src/calendar-page.js'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('visualiza en la zona del perfil y edita en la original sin cambiar de día', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-01T14:00:00Z'))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const event = { id: 'meeting', title: 'Reunión internacional', description: null, category: 'Personal', color: 'sage', goalId: null, allDay: false, startDate: null, endDate: null, startAt: '2026-11-01T15:30:00Z', endAt: '2026-11-01T16:30:00Z', timeZone: 'Asia/Tokyo', status: 'scheduled' }
  const request = async (path: string) => path.includes('archived=true') ? [] : [event]
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><CalendarPage userId="test-user" timeZone="America/La_Paz" goals={[]} request={request} /></QueryClientProvider>)
  const meeting = await screen.findByRole('button', { name: 'Editar Reunión internacional, 11:30 a 12:30' })
  expect(meeting.style.top).toBe('690px')
  await userEvent.click(meeting)
  expect((screen.getByRole('textbox', { name: /^Zona horaria del evento/ }) as HTMLInputElement).value).toBe('Asia/Tokyo')
  expect((screen.getByLabelText('Empieza') as HTMLInputElement).value).toBe('2026-11-02T00:30')
  expect(screen.getByRole('heading', { name: 'domingo, 1 de noviembre' })).toBeDefined()
  client.clear()
})
