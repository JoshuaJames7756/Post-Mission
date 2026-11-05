import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, CalendarHeart, Pencil, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { getCalendarDate } from './date-utils.js'
import { journeySummary } from './journey.js'
import { SectionTopbar } from './section-topbar.js'
import { SkeletonRows } from './skeletons.js'
import './journey.css'

type Journey = { returnDate: string | null; displayMode: 'elapsed' | 'days'; timezone: string }
type Milestone = { id: string; title: string; milestoneDate: string; description: string | null }
type Request = <T>(path: string, options?: RequestInit) => Promise<T>

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

export function JourneyPage({ userId, request }: { userId: string; request: Request }) {
  const cache = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)
  const journey = useQuery({ queryKey: ['journey', userId], queryFn: () => request<Journey>('/journey') })
  const milestones = useQuery({ queryKey: ['journey-milestones', userId], queryFn: () => request<Milestone[]>('/journey/milestones') })
  const archived = useQuery({ queryKey: ['journey-archived', userId], queryFn: () => request<Milestone[]>('/journey/milestones?archived=true'), enabled: showArchived })
  const [dateDraft, setDateDraft] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [milestoneDate, setMilestoneDate] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<Milestone | null>(null)
  const save = useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: string; body?: unknown }) => request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['journey', userId] })
      void cache.invalidateQueries({ queryKey: ['journey-milestones', userId] })
      void cache.invalidateQueries({ queryKey: ['journey-archived', userId] })
      void cache.invalidateQueries({ queryKey: ['profile', userId] })
      toast.success('Cambios guardados.')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No pudimos guardar el cambio.'),
  })
  const today = getCalendarDate(new Date(), journey.data?.timezone ?? 'America/La_Paz')
  const active = milestones.data ?? []
  const upcoming = active.filter((item) => item.milestoneDate >= today)
  const previous = active.filter((item) => item.milestoneDate < today).reverse()

  function submitMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = { title, milestoneDate, description: description.trim() || null }
    save.mutate({ path: editing ? `/journey/milestones/${editing.id}` : '/journey/milestones', method: editing ? 'PATCH' : 'POST', body }, { onSuccess: () => { setEditing(null); setTitle(''); setMilestoneDate(''); setDescription('') } })
  }

  function editMilestone(item: Milestone) {
    setEditing(item)
    setTitle(item.title)
    setMilestoneDate(item.milestoneDate)
    setDescription(item.description ?? '')
    document.getElementById('journey-milestone-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const list = (items: Milestone[]) => items.map((item) => <li className="journey-milestone" key={item.id}>
    <div className="journey-milestone-date"><span>{formatDate(item.milestoneDate)}</span></div>
    <div className="journey-milestone-main"><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>
    <div className="journey-milestone-actions"><button type="button" aria-label={`Editar ${item.title}`} onClick={() => editMilestone(item)} disabled={save.isPending}><Pencil size={16} /></button><button type="button" aria-label={`Archivar ${item.title}`} onClick={() => save.mutate({ path: `/journey/milestones/${item.id}/archive` })} disabled={save.isPending}><Archive size={16} /></button></div>
  </li>)

  return <div className="journey-page">
    <SectionTopbar title="Journey" icon={CalendarHeart} actions={<a className="journey-back" href="#home"><ArrowLeft size={16} /> Inicio</a>} />
    {(journey.isLoading || milestones.isLoading) && <SkeletonRows label="tu recorrido" rows={3} />}
    {(journey.error || milestones.error) && <div className="error-banner" role="alert"><p>No pudimos cargar tu recorrido.</p><button type="button" onClick={() => { void journey.refetch(); void milestones.refetch() }}>Intentar de nuevo</button></div>}
    {journey.data && milestones.data && <>
      <section className="journey-hero" aria-labelledby="journey-heading"><p className="setup-eyebrow">Tu recorrido</p><h2 id="journey-heading">Un capítulo que sigue creciendo.</h2>
        {journey.data.returnDate ? <><p className="journey-count" aria-live="polite">{journeySummary(journey.data.returnDate, today, journey.data.displayMode)}</p><p>Desde tu regreso el {formatDate(journey.data.returnDate)}. El día de regreso cuenta como día cero.</p></> : <p>Si quieres, añade tu fecha de regreso. Tu recorrido puede empezar sin ella.</p>}
        <div className="journey-mode" role="group" aria-label="Forma de mostrar el tiempo"><button type="button" aria-pressed={journey.data.displayMode === 'elapsed'} onClick={() => save.mutate({ path: '/journey', method: 'PATCH', body: { displayMode: 'elapsed' } })} disabled={save.isPending}>Años y meses</button><button type="button" aria-pressed={journey.data.displayMode === 'days'} onClick={() => save.mutate({ path: '/journey', method: 'PATCH', body: { displayMode: 'days' } })} disabled={save.isPending}>Días</button></div>
        <form className="journey-date-form" onSubmit={(event) => { event.preventDefault(); save.mutate({ path: '/journey', method: 'PATCH', body: { returnDate: dateDraft || null } }, { onSuccess: () => setDateDraft(null) }) }}><label htmlFor="journey-return-date">Fecha de regreso (opcional)</label><div><input id="journey-return-date" type="date" max={today} value={dateDraft ?? journey.data.returnDate ?? ''} onChange={(event) => setDateDraft(event.target.value)} /><button disabled={save.isPending || dateDraft === null || (dateDraft || null) === journey.data.returnDate}>{save.isPending ? 'Guardando…' : 'Guardar fecha'}</button></div></form>
      </section>
      <section className="journey-milestones-section" aria-labelledby="milestones-heading"><div className="journey-section-heading"><div><p className="setup-eyebrow">Momentos que importan</p><h2 id="milestones-heading">Hitos personales</h2></div><span>{active.length}</span></div><p>Guarda los momentos que tú elijas. Puedes añadir fechas pasadas o próximas.</p>
        <form id="journey-milestone-form" className="journey-milestone-form" onSubmit={submitMilestone}><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Un momento importante" /></label><label>Fecha<input type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} required /></label><label className="journey-description">Descripción (opcional)<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={2} placeholder="¿Qué hizo especial este momento?" /></label><div className="journey-form-actions">{editing && <button type="button" onClick={() => { setEditing(null); setTitle(''); setMilestoneDate(''); setDescription('') }}>Cancelar</button>}<button disabled={save.isPending}>{save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir hito'}</button></div></form>
        {active.length === 0 && <p className="journey-empty">Aún no tienes hitos. Añade el primero cuando haya algo que quieras recordar.</p>}
        {upcoming.length > 0 && <div className="journey-list"><h3>Próximos</h3><ul>{list(upcoming)}</ul></div>}
        {previous.length > 0 && <div className="journey-list"><h3>Ya vividos</h3><ul>{list(previous)}</ul></div>}
        <details className="journey-archive" open={showArchived} onToggle={(event) => setShowArchived(event.currentTarget.open)}><summary>Hitos archivados</summary>{showArchived && <>{archived.isLoading && <SkeletonRows label="hitos archivados" rows={2} />}{archived.error && <div className="error-banner" role="alert"><p>No pudimos cargar los hitos archivados.</p><button type="button" onClick={() => { void archived.refetch() }}>Reintentar</button></div>}{archived.data?.length === 0 && <p>No hay hitos archivados.</p>}<ul>{archived.data?.map((item) => <li className="journey-archived-item" key={item.id}><span>{item.title} · {formatDate(item.milestoneDate)}</span><button type="button" onClick={() => save.mutate({ path: `/journey/milestones/${item.id}/restore` })} disabled={save.isPending}><RotateCcw size={15} /> Restaurar</button></li>)}</ul></>}</details>
      </section>
    </>}
  </div>
}
