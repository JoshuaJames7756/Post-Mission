// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OnboardingFlow } from '../../src/onboarding.js'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('first use onboarding', () => {
  it('keeps the user on the area step when saving fails and completes only after an area is saved', async () => {
    let rejectArea = true
    const request = vi.fn(async <T,>(path: string): Promise<T> => {
      if (path === '/life-areas' && rejectArea) throw new Error('Sin conexión')
      return {} as T
    })
    render(<OnboardingFlow profile={null} areas={[]} goals={[]} request={request} refresh={async () => {}} />)

    fireEvent.change(screen.getByRole('textbox', { name: '¿Cómo quieres que te llamemos?' }), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar y continuar/ }))
    await screen.findByRole('heading', { name: 'Tu camino continúa.' })
    fireEvent.click(screen.getByRole('button', { name: /Guardar y continuar/ }))
    await screen.findByRole('heading', { name: 'Elige un área de vida.' })

    fireEvent.click(screen.getByRole('button', { name: 'Familia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar área' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('heading', { name: 'Elige un área de vida.' })).toBeTruthy()
    expect(request).not.toHaveBeenCalledWith('/me/onboarding/complete', expect.anything())

    rejectArea = false
    fireEvent.click(screen.getByRole('button', { name: 'Guardar área' }))
    await screen.findByRole('heading', { name: 'Listo para comenzar.' })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar a mi espacio' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/me/onboarding/complete', expect.objectContaining({ method: 'POST' })))
    expect(request).not.toHaveBeenCalledWith('/goals', expect.anything())
  })
})
