// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GoalTree } from '../../src/goal-tree.js'

afterEach(() => cleanup())

it('keeps completion direct and puts edit/archive in a contextual menu with neutral past-date text', () => {
  const onComplete = vi.fn()
  const onEdit = vi.fn()
  const onArchive = vi.fn()
  const goal = { id: 'goal-1', title: 'Cuidar mis amistades', periodType: 'week' as const, targetDate: '2026-11-02', parentGoalId: null }
  render(<GoalTree goals={[goal]} todayDate="2026-11-04" pending={false} onComplete={onComplete} onEdit={onEdit} onArchive={onArchive} />)

  expect(screen.getByText('Revisar fecha · 2 nov')).toBeTruthy()
  expect(screen.queryByText('Vencida')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Completar Cuidar mis amistades' }))
  expect(onComplete).toHaveBeenCalledWith('goal-1')

  fireEvent.click(screen.getByLabelText('Acciones de Cuidar mis amistades'))
  fireEvent.click(screen.getByRole('button', { name: 'Archivar' }))
  expect(screen.getByRole('group', { name: 'Confirmar archivado de Cuidar mis amistades' })).toBeTruthy()
  expect(onArchive).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Archivar meta' }))
  expect(onArchive).toHaveBeenCalledWith('goal-1')
})
