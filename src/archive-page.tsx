import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { SectionTopbar } from './section-topbar.js'
import { SkeletonRows } from './skeletons.js'
import './archive.css'

type Kind = 'areas' | 'goals' | 'tasks' | 'events' | 'people' | 'places' | 'milestones' | 'notes'
type Item = { kind: Kind; id: string; title: string; archivedAt: string }
type ArchiveResult = { items: Item[]; page: number; hasMore: boolean }
type Request = <T>(path: string, options?: RequestInit) => Promise<T>

const labels: Record<Kind, string> = {
  areas: 'Áreas', goals: 'Metas', tasks: 'Tareas', events: 'Eventos',
  people: 'Personas', places: 'Lugares', milestones: 'Hitos', notes: 'Notas',
}
const restorePaths: Record<Kind, (id: string) => string> = {
  areas: (id) => `/life-areas/${id}/restore`,
  goals: (id) => `/goals/${id}/restore`,
  tasks: (id) => `/tasks/${id}/restore`,
  events: (id) => `/events/${id}/restore`,
  people: (id) => `/people/${id}/restore`,
  places: (id) => `/places/${id}/restore`,
  milestones: (id) => `/journey/milestones/${id}/restore`,
  notes: (id) => `/notes/${id}/restore`,
}

export function ArchivePage({ userId, timeZone, request }: { userId: string; timeZone: string; request: Request }) {
  const cache = useQueryClient()
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [restoreError, setRestoreError] = useState<{ id: string; message: string } | null>(null)
  const archive = useQuery({
    queryKey: ['archive', userId, kind, appliedSearch, page],
    queryFn: () => request<ArchiveResult>(`/archive?kind=${kind}&page=${page}&q=${encodeURIComponent(appliedSearch)}`),
    refetchOnMount: 'always',
  })
  const restore = useMutation({
    mutationFn: (item: Item) => request(restorePaths[item.kind](item.id), { method: 'POST' }),
    onSuccess: async (_result, item) => {
      setRestoreError(null)
      await cache.invalidateQueries()
      if (archive.data?.items.length === 1 && page > 1) setPage(page - 1)
      toast.success(`${item.title}: restaurado del archivo.`)
    },
    onError: (error, item) => setRestoreError({ id: item.id, message: error instanceof Error ? error.message : 'No se pudo restaurar. Inténtalo de nuevo.' }),
  })

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedSearch(search.trim())
    setPage(1)
  }

  return <div className="archive-page">
    <SectionTopbar title="Archivo" icon={Archive} actions={<a className="archive-back" href="#home"><ArrowLeft size={16} /> Inicio</a>} />
    <p className="archive-intro">Encuentra lo que retiraste de tus vistas habituales y restáuralo cuando lo necesites.</p>
    <div className="archive-controls">
      <label>Tipo<select value={kind} onChange={(event) => { setKind(event.target.value as Kind | 'all'); setPage(1); setRestoreError(null) }}><option value="all">Todo el archivo</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <form role="search" onSubmit={applySearch}><label htmlFor="archive-search">Buscar</label><div><input id="archive-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Buscar por nombre…" /><button type="submit" aria-label="Buscar en archivo"><Search size={18} /></button></div></form>
    </div>
    {archive.isLoading && <SkeletonRows label="archivo" rows={4} />}
    {archive.error && <div className="error-banner" role="alert"><p>{archive.error instanceof Error ? archive.error.message : 'No pudimos cargar el archivo.'}</p><button type="button" onClick={() => { void archive.refetch() }}>Reintentar</button></div>}
    {!archive.isLoading && !archive.error && <>
      {archive.data?.items.length === 0 && <div className="archive-empty"><Archive size={23} /><h2>{appliedSearch ? 'No encontramos coincidencias.' : kind === 'all' ? 'Tu archivo está vacío.' : 'No hay elementos de este tipo.'}</h2><p>{appliedSearch ? 'Prueba otra búsqueda o cambia el tipo de contenido.' : 'Lo que archives aparecerá aquí sin perder sus relaciones.'}</p></div>}
      <div className="archive-list">{archive.data?.items.map((item) => <article className="archive-row" key={`${item.kind}:${item.id}`}>
        <div><span className="archive-kind">{labels[item.kind]}</span><h2>{item.title}</h2><time dateTime={item.archivedAt}>Archivado el {new Intl.DateTimeFormat('es', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.archivedAt))}</time></div>
        <button type="button" disabled={restore.isPending} onClick={() => { setRestoreError(null); restore.mutate(item) }} aria-label={`Restaurar ${item.title}`}><RotateCcw size={15} /> Restaurar</button>
        {restoreError?.id === item.id && <p className="archive-restore-error" role="alert">{restoreError.message}</p>}
      </article>)}</div>
      {(page > 1 || archive.data?.hasMore) && <nav className="archive-pagination" aria-label="Páginas del archivo"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /> Anterior</button><span>Página {page}</span><button type="button" disabled={!archive.data?.hasMore} onClick={() => setPage((current) => current + 1)}>Siguiente <ChevronRight size={16} /></button></nav>}
    </>}
  </div>
}
