import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Cake, CalendarDays, MoreHorizontal, Pencil, Phone, Plus, RotateCcw, Search, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { addCalendarDays, getCalendarDate } from './date-utils.js'
import { LoadingState } from './loading-state.js'
import { SkeletonRows } from './skeletons.js'
import { SectionTopbar } from './section-topbar.js'
import { useDebouncedValue } from './use-debounced-value.js'

type Relationship = 'family' | 'friend' | 'mentor' | 'community' | 'other'
type AvatarColor = 'sage' | 'amber' | 'navy' | 'slate' | 'plum'
type Person = { id: string; name: string; relationship: Relationship; phone: string | null; birthday: string | null; notes: string | null; avatarColor: AvatarColor; linkedEventCount: number }
type EventSummary = { id: string; title: string; allDay: boolean; startDate: string | null; startAt: string | null; timeZone: string | null }
type Request = <T>(path: string, options?: RequestInit) => Promise<T>

const relationshipLabels: Record<Relationship, string> = { family: 'Familia', friend: 'Amistad', mentor: 'Mentoría', community: 'Comunidad', other: 'Otro' }
const colorLabels: Record<AvatarColor, string> = { sage: 'Salvia', amber: 'Ámbar', navy: 'Azul profundo', slate: 'Pizarra', plum: 'Ciruela' }
const emptyForm = { name: '', relationship: 'friend' as Relationship, phone: '', birthday: '', notes: '', avatarColor: 'sage' as AvatarColor }

export function PeoplePage({ userId, timeZone, request }: { userId: string; timeZone: string; request: Request }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const searchQuery = useDebouncedValue(search.trim())
  const [relationshipFilter, setRelationshipFilter] = useState<Relationship | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const addPersonButtonRef = useRef<HTMLButtonElement>(null)
  const formTriggerRef = useRef<HTMLElement | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [selectedEventIds, setSelectedEventIds] = useState<string[] | null>(null)
  const from = getCalendarDate(new Date(), timeZone)
  const to = addCalendarDays(from, 89)
  const peopleKey = ['people', userId, searchQuery]
  const archivedKey = ['people-archived', userId]
  const peopleQuery = useQuery({ queryKey: peopleKey, queryFn: () => request<Person[]>(`/people${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`), placeholderData: (previous, query) => query?.queryKey[1] === userId ? previous : undefined })
  const searching = search.trim() !== searchQuery || (peopleQuery.isFetching && !peopleQuery.isLoading)
  const archivedQuery = useQuery({ queryKey: archivedKey, queryFn: () => request<Person[]>('/people?archived=true') })
  const eventsQuery = useQuery({ queryKey: ['people-events-options', userId, from, to], queryFn: () => request<EventSummary[]>(`/events?from=${from}&to=${to}&timeZone=${encodeURIComponent(timeZone)}`) })
  const linkedQuery = useQuery({
    queryKey: ['people-linked-events', userId, expandedPersonId],
    queryFn: () => request<EventSummary[]>(`/people/${expandedPersonId}/events`),
    enabled: Boolean(expandedPersonId),
  })
  const selectedIds = selectedEventIds ?? linkedQuery.data?.map((event) => event.id) ?? []

  const mutation = useMutation({
    mutationFn: ({ path, body, method = 'POST' }: { path: string; body?: unknown; method?: string }) => request<unknown>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['people', userId] }),
        queryClient.invalidateQueries({ queryKey: archivedKey }),
        queryClient.invalidateQueries({ queryKey: ['people-linked-events', userId] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No pudimos guardar los cambios.'),
  })

  const activeEvents = useMemo(() => {
    const seen = new Set<string>()
    return [...(linkedQuery.data ?? []), ...(eventsQuery.data ?? [])].filter((event) => {
      if (seen.has(event.id)) return false
      seen.add(event.id)
      return true
    })
  }, [eventsQuery.data, linkedQuery.data])
  const archivePerson = async (person: Person) => {
    try {
      await mutation.mutateAsync({ path: `/people/${person.id}/archive` })
      setExpandedPersonId((current) => current === person.id ? null : current)
      toast.success(`${person.name}: contacto archivado.`, {
        duration: 8000,
        action: { label: 'Deshacer', onClick: () => {
          void mutation.mutateAsync({ path: `/people/${person.id}/restore` })
            .then(() => { toast.success('Contacto restaurado.') })
            .catch(() => { /* The mutation displays the recoverable error. */ })
        } },
      })
    } catch { /* The mutation displays the recoverable error. */ }
  }
  const visiblePeople = useMemo(() => (peopleQuery.data ?? []).filter((person) => relationshipFilter === 'all' || person.relationship === relationshipFilter), [peopleQuery.data, relationshipFilter])
  const closePersonForm = () => {
    setFormOpen(false)
    setEditingPerson(null)
    setForm(emptyForm)
    window.setTimeout(() => {
      const trigger = formTriggerRef.current
      const target = trigger?.isConnected && trigger !== document.body ? trigger : addPersonButtonRef.current
      target?.focus()
    }, 0)
  }
  const submitPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = { name: form.name, relationship: form.relationship, phone: form.phone || null, birthday: form.birthday || null, notes: form.notes || null, avatarColor: form.avatarColor }
    mutation.mutate({ path: editingPerson ? `/people/${editingPerson.id}` : '/people', method: editingPerson ? 'PATCH' : 'POST', body }, {
      onSuccess: () => {
        closePersonForm()
        toast.success(editingPerson ? 'Contacto actualizado.' : 'Contacto guardado.')
      },
    })
  }

  const editPerson = (person: Person, trigger?: HTMLElement | null) => {
    formTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setEditingPerson(person)
    setFormOpen(true)
    setForm({ name: person.name, relationship: person.relationship, phone: person.phone ?? '', birthday: person.birthday ?? '', notes: person.notes ?? '', avatarColor: person.avatarColor })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const togglePersonForm = () => {
    if (formOpen) {
      closePersonForm()
      return
    }
    formTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditingPerson(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const toggleEvent = (eventId: string) => setSelectedEventIds((current) => {
    const selected = current ?? linkedQuery.data?.map((event) => event.id) ?? []
    return selected.includes(eventId) ? selected.filter((id) => id !== eventId) : [...selected, eventId]
  })

  return <section className="people-page" aria-label="Personas">
    <SectionTopbar title="Personas" icon={Users} actions={<button ref={addPersonButtonRef} type="button" className="people-add-button section-topbar-add" aria-expanded={formOpen} aria-controls="person-form" onClick={togglePersonForm}>{formOpen ? <><X size={15} />Cerrar</> : <><Plus size={15} />Añadir persona</>}</button>} />
    <div className="people-toolbar"><div className="people-toolbar-actions"><label className="people-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Buscar personas" placeholder="Buscar por nombre o relación…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>
    <div className="people-relationship-filters" role="group" aria-label="Filtrar por relación">
      <button type="button" className={relationshipFilter === 'all' ? 'people-filter-current' : ''} aria-pressed={relationshipFilter === 'all'} onClick={() => setRelationshipFilter('all')}>Todas</button>
      {Object.entries(relationshipLabels).map(([value, label]) => <button type="button" key={value} className={relationshipFilter === value ? 'people-filter-current' : ''} aria-pressed={relationshipFilter === value} onClick={() => setRelationshipFilter(value as Relationship)}>{label}</button>)}
    </div>
    {formOpen && <form className="person-form" id="person-form" onSubmit={submitPerson} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closePersonForm() } }} aria-label={editingPerson ? 'Editar persona' : 'Añadir persona'}>
      <div className="person-form-heading"><div><p className="setup-eyebrow">{editingPerson ? 'Actualizar' : 'Nueva persona'}</p><h2>{editingPerson ? 'Editar persona' : 'Añade a alguien importante'}</h2></div><button type="button" className="person-icon-action" aria-label="Cerrar formulario" onClick={closePersonForm}><X size={16} /></button></div>
      <div className="person-form-grid">
        <label>Nombre<input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre y apellido" /></label>
        <label>Relación<select value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value as Relationship })}>{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Teléfono <span>(opcional)</span><input type="tel" maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+1 555 0100" /></label>
        <label>Cumpleaños <span>(opcional)</span><input type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} /></label>
        <fieldset className="color-choice"><legend>Color del avatar</legend><div>{Object.entries(colorLabels).map(([value, label]) => <button key={value} type="button" className="color-swatch-button" aria-label={`Color ${label}`} aria-pressed={form.avatarColor === value} title={label} onClick={() => setForm({ ...form, avatarColor: value as AvatarColor })}><span className={`color-swatch-dot color-swatch-${value}`} /></button>)}</div></fieldset>
        <label className="person-notes-field">Notas <span>(privadas)</span><textarea maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} placeholder="Algo que quieras recordar…" /></label>
      </div>
      <button className="person-save" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : editingPerson ? 'Guardar cambios' : 'Guardar persona'}</button>
    </form>}
    <p className="search-feedback" role="status">{searching ? "Buscando personas…" : ""}</p>
    {peopleQuery.isLoading && <SkeletonRows label="personas" rows={4} />}
    {peopleQuery.error && <div className="error-banner" role="alert"><p>No pudimos cargar tus personas.</p><button onClick={() => { void peopleQuery.refetch() }}>Reintentar</button></div>}
    {!searching && !peopleQuery.isLoading && !peopleQuery.error && visiblePeople.length === 0 && <p className="people-empty">{(peopleQuery.data?.length ?? 0) === 0 ? search.trim() ? 'No encontramos personas con esa búsqueda.' : 'Aún no has añadido personas. Puedes empezar con alguien que quieras tener presente.' : <>No hay personas de tipo {relationshipLabels[relationshipFilter as Relationship]} en esta búsqueda. <button className="people-filter-reset" type="button" onClick={() => setRelationshipFilter('all')}>Ver todas las relaciones</button></>}</p>}
    <div className="people-grid" aria-busy={searching}>{visiblePeople.map((person) => <article className="person-card" key={person.id}>
      <div className="person-card-head">
        <div className={`person-avatar person-avatar-${person.avatarColor}`} aria-hidden="true">{person.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join('')}</div>
        <div className="person-card-identity"><h3>{person.name}</h3><span className="person-relationship-badge">{relationshipLabels[person.relationship]}</span></div>
        <details className="person-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
          <summary aria-label={`Acciones de ${person.name}`} title="Acciones"><MoreHorizontal size={18} aria-hidden="true" /></summary>
          <div className="person-menu-popover">
            <button type="button" aria-label={`Editar ${person.name}`} onClick={(event) => { const menu = event.currentTarget.closest('details'); const trigger = menu?.querySelector('summary'); if (menu) menu.open = false; editPerson(person, trigger) }}><Pencil size={15} aria-hidden="true" />Editar</button>
            <button type="button" aria-label={`Archivar ${person.name}`} disabled={mutation.isPending} onClick={(event) => { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; void archivePerson(person) }}><Archive size={15} aria-hidden="true" />Archivar</button>
          </div>
        </details>
      </div>
      {(person.phone || person.birthday) && <div className="person-meta">
        {person.phone && <a href={`tel:${person.phone}`} title={person.phone}><Phone size={13} aria-hidden="true" /><span>{person.phone}</span></a>}
        {person.birthday && <span><Cake size={13} aria-hidden="true" /><time dateTime={person.birthday}>{new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${person.birthday}T12:00:00Z`))}</time></span>}
      </div>}
      {person.notes && <details className="person-notes"><summary title={person.notes}>Nota: {person.notes}</summary><p>{person.notes}</p></details>}
      <button className="person-events-tag" type="button" aria-expanded={expandedPersonId === person.id} aria-controls={expandedPersonId === person.id ? `person-events-${person.id}` : undefined} onClick={() => { setExpandedPersonId((current) => current === person.id ? null : person.id); setSelectedEventIds(null) }}><CalendarDays size={14} aria-hidden="true" />{person.linkedEventCount > 0 ? `Eventos · ${person.linkedEventCount}` : 'Vincular evento'}</button>
      {expandedPersonId === person.id && <div className="person-event-links" id={`person-events-${person.id}`}><h4>Eventos vinculados y próximos</h4>{eventsQuery.isLoading || linkedQuery.isLoading ? <LoadingState compact label="Cargando eventos…" /> : eventsQuery.error || linkedQuery.error ? <p role="alert">No pudimos cargar los eventos. <button onClick={() => { void eventsQuery.refetch(); void linkedQuery.refetch() }}>Reintentar</button></p> : activeEvents.length === 0 ? <p>No hay eventos vinculados ni próximos.</p> : <div className="person-event-options">{activeEvents.map((event) => <label key={event.id}><input type="checkbox" checked={selectedIds.includes(event.id)} onChange={() => toggleEvent(event.id)} /><span>{event.title}</span><small>{event.allDay && event.startDate ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${event.startDate}T12:00:00Z`)) : event.startAt ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: event.timeZone ?? timeZone }).format(new Date(event.startAt)) : ''}</small></label>)}</div>}<button className="person-save person-events-save" onClick={() => mutation.mutate({ path: `/people/${person.id}/events`, method: 'PUT', body: { eventIds: selectedIds } })} disabled={mutation.isPending || linkedQuery.isLoading || Boolean(linkedQuery.error) || Boolean(eventsQuery.error)}>Guardar eventos</button></div>}
    </article>)}</div>

    <details className="people-archived"><summary>Personas archivadas ({archivedQuery.data?.length ?? 0})</summary>{archivedQuery.isLoading && <LoadingState compact label="Cargando archivo…" />}{archivedQuery.error && <div className="error-banner" role="alert"><p>No pudimos cargar el archivo.</p><button onClick={() => { void archivedQuery.refetch() }}>Reintentar</button></div>}{!archivedQuery.isLoading && !archivedQuery.error && (archivedQuery.data?.length ?? 0) === 0 && <p className="empty-message">No hay personas archivadas.</p>}{archivedQuery.data?.map((person) => <div className="people-archived-row" key={person.id}><span>{person.name}</span><button className="person-link-toggle" onClick={() => mutation.mutate({ path: `/people/${person.id}/restore` })} disabled={mutation.isPending}><RotateCcw size={14} />Restaurar</button></div>)}</details>
  </section>
}
