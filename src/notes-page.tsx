import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, FileText, Pencil, RotateCcw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { SectionTopbar } from './section-topbar.js'
import { SkeletonRows } from './skeletons.js'
import './notes.css'

type LinkKey = 'goalIds' | 'taskIds' | 'eventIds' | 'personIds' | 'placeIds'
type Links = Record<LinkKey, string[]>
type Note = { id: string; title: string; content: string; updatedAt: string; links: Links }
type Target = { id: string; title: string; archivedAt: string | null }
type Options = Record<'goals' | 'tasks' | 'events' | 'people' | 'places', Target[]>
type Request = <T>(path: string, options?: RequestInit) => Promise<T>
const emptyLinks = (): Links => ({ goalIds: [], taskIds: [], eventIds: [], personIds: [], placeIds: [] })
const groups: { key: LinkKey; option: keyof Options; title: string }[] = [
  { key: 'goalIds', option: 'goals', title: 'Metas' }, { key: 'taskIds', option: 'tasks', title: 'Tareas' },
  { key: 'eventIds', option: 'events', title: 'Eventos' }, { key: 'personIds', option: 'people', title: 'Personas' },
  { key: 'placeIds', option: 'places', title: 'Lugares' },
]

export function NotesPage({ userId, request }: { userId: string; request: Request }) {
  const cache = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)
  const active = useQuery({ queryKey: ['notes', userId], queryFn: () => request<Note[]>('/notes') })
  const archived = useQuery({ queryKey: ['notes-archived', userId], queryFn: () => request<Note[]>('/notes?archived=true'), enabled: showArchived })
  const options = useQuery({ queryKey: ['note-options', userId], queryFn: () => request<Options>('/notes/link-options') })
  const [search, setSearch] = useState('')
  const [linkSearch, setLinkSearch] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [links, setLinks] = useState<Links>(emptyLinks)
  const [editing, setEditing] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const mutation = useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: string; body?: unknown }) => request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['notes', userId] }); void cache.invalidateQueries({ queryKey: ['notes-archived', userId] }); toast.success('Cambios guardados.') },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No pudimos guardar la nota.'),
  })

  function resetEditor() { setEditing(null); setTitle(''); setContent(''); setLinks(emptyLinks()); setShowEditor(false); setLinkSearch('') }
  function editNote(note: Note) { setEditing(note.id); setTitle(note.title); setContent(note.content); setLinks(note.links); setShowEditor(true); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({ path: editing ? `/notes/${editing}` : '/notes', method: editing ? 'PUT' : 'POST', body: { title, content, links } }, { onSuccess: resetEditor })
  }
  function toggleLink(key: LinkKey, id: string) {
    setLinks((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id] }))
  }
  const visible = (active.data ?? []).filter((note) => `${note.title} ${note.content}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))
  const selectedCount = Object.values(links).reduce((total, ids) => total + ids.length, 0)

  return <div className="notes-page">
    <SectionTopbar title="Notas" icon={FileText} actions={<a className="notes-back" href="#home"><ArrowLeft size={16} /> Inicio</a>} />
    <div className="notes-toolbar"><label className="notes-search"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tus notas" aria-label="Buscar en tus notas" /></label><button type="button" onClick={() => { resetEditor(); setShowEditor(true) }}>Nueva nota</button></div>
    {showEditor && <form className="notes-editor" onSubmit={submit} aria-label={editing ? 'Editar nota' : 'Nueva nota'}>
      <div className="notes-editor-heading"><h3>{editing ? 'Editar nota' : 'Nueva nota'}</h3><button type="button" aria-label="Cerrar editor" onClick={resetEditor}><X size={17} /></button></div>
      <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="¿Qué quieres guardar?" /></label>
      <label>Contenido<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000} rows={6} placeholder="Escribe aquí…" /></label>
      <details className="notes-links"><summary>Relacionar con Plan, Agenda, Personas o Mapa {selectedCount > 0 && `(${selectedCount})`}</summary>
        {options.isLoading && <SkeletonRows label="vínculos" rows={2} />}
        {options.error && <div className="error-banner" role="alert"><p>No pudimos cargar los elementos para relacionar.</p><button type="button" onClick={() => { void options.refetch() }}>Reintentar</button></div>}
        {options.data && <><label className="notes-link-search"><Search size={16} /><input type="search" value={linkSearch} onChange={(event) => setLinkSearch(event.target.value)} placeholder="Buscar vínculos" /></label><div className="notes-link-groups">{groups.map((group) => {
          const targets = options.data[group.option].filter((target) => target.title.toLocaleLowerCase().includes(linkSearch.toLocaleLowerCase().trim()) || links[group.key].includes(target.id))
          return <fieldset key={group.key}><legend>{group.title}</legend>{targets.length === 0 && <p>Sin resultados</p>}{targets.map((target) => <label key={target.id} className="notes-target"><input type="checkbox" checked={links[group.key].includes(target.id)} onChange={() => toggleLink(group.key, target.id)} /><span>{target.title}{target.archivedAt && <small> · Archivado</small>}</span></label>)}</fieldset>
        })}</div></>}
      </details>
      <div className="notes-editor-actions"><button type="button" onClick={resetEditor}>Cancelar</button><button type="submit" disabled={mutation.isPending || options.isLoading || Boolean(options.error)}>{mutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar nota'}</button></div>
    </form>}
    {active.isLoading && <SkeletonRows label="notas" rows={3} />}
    {active.error && <div className="error-banner" role="alert"><p>No pudimos cargar tus notas.</p><button type="button" onClick={() => { void active.refetch() }}>Intentar de nuevo</button></div>}
    {active.data && visible.length === 0 && <p className="notes-empty">{search ? 'No encontramos notas con esa búsqueda.' : 'Aún no tienes notas. Guarda una idea o un recuerdo cuando quieras.'}</p>}
    <div className="notes-list">{visible.map((note) => {
      const related = groups.flatMap((group) => note.links[group.key].map((id) => ({ id, kind: group.title, title: options.data?.[group.option].find((target) => target.id === id)?.title ?? 'Elemento vinculado' })))
      return <article className="notes-card" key={note.id}><div><h3>{note.title}</h3><time dateTime={note.updatedAt}>Actualizada el {new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(note.updatedAt))}</time></div>{note.content && <p>{note.content}</p>}{related.length > 0 && <div className="notes-card-links" aria-label="Vínculos de la nota">{related.slice(0, 3).map((item) => <span key={`${item.kind}-${item.id}`}>{item.title}</span>)}{related.length > 3 && <span>+{related.length - 3}</span>}</div>}<div className="notes-card-bottom"><span>{related.length} {related.length === 1 ? 'vínculo' : 'vínculos'}</span><div><button type="button" onClick={() => editNote(note)}><Pencil size={15} /> Editar</button><button type="button" onClick={() => mutation.mutate({ path: `/notes/${note.id}/archive` })} disabled={mutation.isPending}><Archive size={15} /> Archivar</button></div></div></article>
    })}</div>
    <details className="notes-archive" open={showArchived} onToggle={(event) => setShowArchived(event.currentTarget.open)}><summary>Notas archivadas</summary>{showArchived && <>{archived.isLoading && <SkeletonRows label="notas archivadas" rows={2} />}{archived.error && <div className="error-banner" role="alert"><p>No pudimos cargar las notas archivadas.</p><button type="button" onClick={() => { void archived.refetch() }}>Reintentar</button></div>}{archived.data?.length === 0 && <p>No hay notas archivadas.</p>}{archived.data?.map((note) => <div className="notes-archived-row" key={note.id}><span>{note.title}</span><button type="button" onClick={() => mutation.mutate({ path: `/notes/${note.id}/restore` })} disabled={mutation.isPending}><RotateCcw size={15} /> Restaurar</button></div>)}</>}</details>
  </div>
}
