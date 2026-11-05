export function daysSince(start: string, today: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`)
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  return Math.max(0, Math.round((todayTime - startTime) / 86_400_000))
}

function monthAnchor(start: string, months: number): string {
  const year = Number(start.slice(0, 4))
  const month = Number(start.slice(5, 7))
  const day = Number(start.slice(8, 10))
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

export function elapsedSince(start: string, today: string): { years: number; months: number; days: number } {
  if (today <= start) return { years: 0, months: 0, days: 0 }
  const startYear = Number(start.slice(0, 4))
  const startMonth = Number(start.slice(5, 7))
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7))
  let totalMonths = (todayYear - startYear) * 12 + todayMonth - startMonth
  if (monthAnchor(start, totalMonths) > today) totalMonths -= 1
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: daysSince(monthAnchor(start, totalMonths), today),
  }
}

export function journeySummary(start: string, today: string, mode: 'elapsed' | 'days'): string {
  if (mode === 'days') {
    const days = daysSince(start, today)
    return `${days} ${days === 1 ? 'día' : 'días'}`
  }
  const { years, months, days } = elapsedSince(start, today)
  const parts = [years && `${years} ${years === 1 ? 'año' : 'años'}`, months && `${months} ${months === 1 ? 'mes' : 'meses'}`, days && `${days} ${days === 1 ? 'día' : 'días'}`].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Hoy'
}
