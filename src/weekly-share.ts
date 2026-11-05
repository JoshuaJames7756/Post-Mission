import type { ReviewFields } from './shared/schemas/review.js'

export function weeklyShareText(fields: ReviewFields, completedGoals: string[]) {
  const goals = completedGoals.map((goal) => goal.trim()).filter(Boolean).slice(0, 8)
  const lines = ['Mi revisión semanal · Post Mission']
  lines.push('', 'Metas completadas:')
  lines.push(...(goals.length ? goals.map((goal) => `• ${goal}`) : ['• Esta semana avancé a mi ritmo.']))
  if (fields.wins.trim()) lines.push('', `Lo que celebro: ${fields.wins.trim()}`)
  lines.push('', `Mi próximo enfoque: ${fields.nextSteps.trim() || 'Seguir dando un paso a la vez.'}`)
  return lines.join('\n')
}
