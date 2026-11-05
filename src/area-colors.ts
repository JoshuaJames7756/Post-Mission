export type AreaReference = { id: string; name: string }
export type GoalAreaReference = { id: string; lifeAreaId?: string | null }

export function areaTone(name: string): 'physical' | 'spiritual' | 'social' | 'intellectual' {
  const value = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/fisic|salud|bienestar|cuerpo|deporte|ejercicio/.test(value)) return 'physical'
  if (/espiritual|fe|evangelio|oracion|templo/.test(value)) return 'spiritual'
  if (/social|familia|amistad|relacion|comunidad|personas/.test(value)) return 'social'
  if (/intelectual|estudio|aprender|educacion|lectura|trabajo/.test(value)) return 'intellectual'
  const tones = ['physical', 'spiritual', 'social', 'intellectual'] as const
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return tones[hash % tones.length]!
}

export function areaForGoal(goalId: string | null, goals: GoalAreaReference[], areas: AreaReference[]): AreaReference | null {
  const areaId = goals.find((goal) => goal.id === goalId)?.lifeAreaId
  return areas.find((area) => area.id === areaId) ?? null
}
