import { useState } from 'react'
import { Archive, Check, Compass, MoreHorizontal, Pencil, X } from 'lucide-react'

export type GoalForTree = {
  id: string
  title: string
  periodType: 'year' | 'month' | 'week' | 'day'
  targetDate: string
  parentGoalId: string | null
  hasChildren?: boolean
}

type GoalNode<T extends GoalForTree> = T & { children: GoalNode<T>[] }

function buildGoalTree<T extends GoalForTree>(goals: T[]): GoalNode<T>[] {
  const nodes = new Map(goals.map((goal) => [goal.id, { ...goal, children: [] as GoalNode<T>[] }]))
  const roots: GoalNode<T>[] = []

  for (const node of nodes.values()) {
    const parent = node.parentGoalId ? nodes.get(node.parentGoalId) : undefined
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

export function GoalTree({ goals, todayDate, pending, onComplete, onArchive, onEdit }: {
  goals: GoalForTree[]
  todayDate: string
  pending: boolean
  onComplete: (goalId: string) => void
  onArchive: (goalId: string) => void
  onEdit: (goalId: string) => void
}) {
  const roots = buildGoalTree(goals)
  return <div className="goal-tree">{roots.map((goal) => <GoalBranch key={goal.id} goal={goal} todayDate={todayDate} pending={pending} onComplete={onComplete} onArchive={onArchive} onEdit={onEdit} />)}</div>
}

function GoalBranch({ goal, todayDate, pending, onComplete, onArchive, onEdit }: {
  goal: GoalNode<GoalForTree>
  todayDate: string
  pending: boolean
  onComplete: (goalId: string) => void
  onArchive: (goalId: string) => void
  onEdit: (goalId: string) => void
}) {
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const period = goal.periodType === 'year' ? 'Este año' : goal.periodType === 'month' ? 'Este mes' : goal.periodType === 'week' ? 'Esta semana' : 'Hoy'
  const targetLabel = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', ...(goal.targetDate.slice(0, 4) === todayDate.slice(0, 4) ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(new Date(`${goal.targetDate}T12:00:00Z`))
  const overdue = goal.targetDate < todayDate

  return <div className="goal-branch">
    <article className="goal-row">
      <div className="goal-symbol"><Compass size={17} /></div>
      <div className="goal-info"><h3>{goal.title}</h3><p>{overdue ? <>Revisar fecha · {targetLabel}</> : <>{period} · hasta {targetLabel}</>}</p></div>
      <button className="goal-complete" title="Completar meta" aria-label={`Completar ${goal.title}`} onClick={() => onComplete(goal.id)} disabled={pending}><Check size={17} /></button>
      <details className="goal-menu area-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label={`Acciones de ${goal.title}`} title="Acciones"><MoreHorizontal size={18} aria-hidden="true" /></summary><div className="area-menu-panel"><button type="button" onClick={(event) => { event.currentTarget.closest('details')!.open = false; onEdit(goal.id) }} disabled={pending}><Pencil size={15} aria-hidden="true" />Editar</button><button type="button" className="area-menu-archive" onClick={(event) => { event.currentTarget.closest('details')!.open = false; setConfirmingArchive(true) }} disabled={pending}><Archive size={15} aria-hidden="true" />Archivar</button></div></details>
    </article>
    {confirmingArchive && <div className="area-archive-confirm" role="group" aria-label={`Confirmar archivado de ${goal.title}`}>
      {goal.hasChildren || goal.children.length > 0 ? <span>Archiva primero las submetas para conservar el orden del plan.</span> : <><span>Esta meta quedará en Metas archivadas y podrás restaurarla después.</span><button className="area-action area-action-archive" onClick={() => onArchive(goal.id)} disabled={pending}>Archivar meta</button></>}
      <button className="area-action" aria-label={`Cancelar archivado de ${goal.title}`} onClick={() => setConfirmingArchive(false)}><X size={14} />Cancelar</button>
    </div>}
    {goal.children.length > 0 && <div className="goal-children" role="group" aria-label={`Submetas de ${goal.title}`}>
      {goal.children.map((child) => <GoalBranch key={child.id} goal={child} todayDate={todayDate} pending={pending} onComplete={onComplete} onArchive={onArchive} onEdit={onEdit} />)}
    </div>}
  </div>
}
