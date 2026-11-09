// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountDeletionPendingScreen, AccountDeletionSettings } from '../../src/account-deletion.js'

const { invalidateQueries, signOut } = vi.hoisted(() => ({ invalidateQueries: vi.fn(async () => {}), signOut: vi.fn(async () => {}) }))
vi.mock('@clerk/react-router', () => ({
  useAuth: () => ({ getToken: async () => 'session-test' }),
  useClerk: () => ({ signOut }),
  useReverification: (callback: () => Promise<unknown>) => async () => {
    const result = await callback()
    return result instanceof Response ? result.json() : result
  },
}))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries, clear: vi.fn() }) }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); invalidateQueries.mockClear(); signOut.mockClear() })

describe('account deletion confirmation', () => {
  it('requires the exact phrase before making a request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { state: 'requested' } }), { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountDeletionSettings userId="user-test" />)
    fireEvent.click(screen.getByText('Eliminar cuenta y datos'))
    const button = screen.getByRole('button', { name: 'Eliminar mi cuenta definitivamente' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox', { name: /Escribe BORRAR MI CUENTA/ }), { target: { value: 'BORRAR MI CUENTA ' } })
    expect(button.disabled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox', { name: /Escribe BORRAR MI CUENTA/ }), { target: { value: 'BORRAR MI CUENTA' } })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(signOut).not.toHaveBeenCalled()
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['account-deletion', 'user-test'] }))
  })

  it('shows an API error from the parsed reverification response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Vuelve a verificar tu sesión.' } }), { status: 401 })))
    render(<AccountDeletionSettings userId="user-test" />)
    fireEvent.click(screen.getByText('Eliminar cuenta y datos'))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe BORRAR MI CUENTA/ }), { target: { value: 'BORRAR MI CUENTA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta definitivamente' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Vuelve a verificar tu sesión.')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('closes a pending session after the server confirms automatic completion', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { state: 'none' } }), { status: 200 })))
      render(<AccountDeletionPendingScreen userId="user-test" status={{ state: 'data_deleted' }} />)
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
      expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/' })
    } finally { vi.useRealTimers() }
  })
})
