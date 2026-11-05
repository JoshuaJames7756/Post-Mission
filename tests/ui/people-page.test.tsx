// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { PeoplePage } from '../../src/people-page.js'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('shows a linked event in the badge and keeps it selected alongside upcoming options', async () => {
  const person = { id: 'person-1', name: 'Ana', relationship: 'friend', phone: null, birthday: null, notes: null, avatarColor: 'sage', linkedEventCount: 1 }
  const linked = { id: 'event-old', title: 'Evento anterior', allDay: true, startDate: '2026-01-01', startAt: null, timeZone: null }
  const upcoming = { id: 'event-new', title: 'Evento próximo', allDay: true, startDate: '2026-11-10', startAt: null, timeZone: null }
  const request = vi.fn(async (path: string) => path === '/people' ? [person] : path === '/people?archived=true' ? [] : path === '/people/person-1/events' ? [linked] : path.startsWith('/events?') ? [upcoming] : [])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(<QueryClientProvider client={client}><PeoplePage userId="user-1" timeZone="America/La_Paz" request={request} /></QueryClientProvider>)

  fireEvent.click(await screen.findByRole('button', { name: 'Eventos · 1' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: /Evento anterior/ })).toBeDefined())
  expect((screen.getByRole('checkbox', { name: /Evento anterior/ }) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('checkbox', { name: /Evento próximo/ }) as HTMLInputElement).checked).toBe(false)

  fireEvent.click(container.querySelector('.person-menu summary')!)
  expect(screen.getByRole('button', { name: 'Editar Ana' })).toBeDefined()
  expect(screen.getByRole('button', { name: 'Archivar Ana' })).toBeDefined()
  client.clear()
})
