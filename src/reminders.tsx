import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bell, X } from 'lucide-react'
import { toast } from 'sonner'

type Category = 'tasks' | 'events' | 'reviews'
type Preferences = { remindTasks: boolean; remindEvents: boolean; remindReviews: boolean }
type Reminder = { category: Category; title: string; detail: string; href: string }
type Response = { preferences: Preferences | null; items: Reminder[] }
type Request = <T>(path: string, options?: RequestInit) => Promise<T>

export function RemindersPanel({ userId, request }: { userId: string; request: Request }) {
  const cache = useQueryClient()
  const key = ['reminders', userId]
  const reminders = useQuery({ queryKey: key, queryFn: () => request<Response>('/reminders'), staleTime: 60_000 })
  const dismiss = useMutation({
    mutationFn: (category: Category) => request(`/reminders/${category}/dismiss`, { method: 'POST' }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: key }) },
    onError: () => toast.error('No pudimos ocultar el aviso.'),
  })

  if (reminders.isPending) return <div className="reminders-skeleton skeleton-shape" aria-label="Cargando avisos" />
  if (reminders.isError) return <div className="reminders-error" role="status">No se pudieron cargar tus avisos. <button onClick={() => void reminders.refetch()}>Reintentar</button></div>
  if (!reminders.data?.items.length) return null

  return <section className="reminders-panel" aria-labelledby="reminders-title">
    <div className="reminders-heading"><Bell size={17} aria-hidden="true" /><h2 id="reminders-title">Para tener presente</h2></div>
    <div className="reminders-list">{reminders.data.items.map((item) => <div className="reminder-item" key={item.category}>
      <div className="reminder-copy"><strong>{item.title}</strong><p>{item.detail}</p></div>
      <a href={item.href} aria-label={`Ver ${item.title.toLowerCase()}`}><ArrowRight size={17} /></a>
      <button type="button" aria-label={`Ocultar ${item.title.toLowerCase()} por hoy`} title="Ocultar por hoy" disabled={dismiss.isPending} onClick={() => dismiss.mutate(item.category)}><X size={16} /></button>
    </div>)}</div>
  </section>
}

const settings = [
  { key: 'remindTasks', label: 'Tareas con fecha pendiente' },
  { key: 'remindEvents', label: 'Eventos próximos' },
  { key: 'remindReviews', label: 'Revisiones sin terminar' },
] as const

export function RemindersSettings({ userId, request }: { userId: string; request: Request }) {
  const cache = useQueryClient()
  const key = ['reminders', userId]
  const reminders = useQuery({ queryKey: key, queryFn: () => request<Response>('/reminders'), staleTime: 60_000 })
  const update = useMutation({
    mutationFn: (change: Partial<Preferences>) => request('/reminders/preferences', { method: 'PATCH', body: JSON.stringify(change), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: key }); toast.success('Preferencia guardada.') },
    onError: () => toast.error('No pudimos guardar la preferencia.'),
  })

  return <section className="reminder-settings" aria-labelledby="reminder-settings-title">
    <h3 id="reminder-settings-title">Avisos en Inicio</h3>
    <p>Solo aparecen mientras usas la app. Puedes ocultar cada aviso por hoy.</p>
    {reminders.isPending && <div className="reminder-settings-loading skeleton-shape" aria-label="Cargando preferencias" />}
    {reminders.isError && <div className="reminders-error" role="status">No se cargaron tus preferencias. <button onClick={() => void reminders.refetch()}>Reintentar</button></div>}
    {reminders.data?.preferences && settings.map(({ key: preference, label }) => <label className="reminder-toggle" key={preference}>
      <span>{label}</span><input type="checkbox" checked={reminders.data!.preferences![preference]} disabled={update.isPending} onChange={(event) => update.mutate({ [preference]: event.target.checked })} />
    </label>)}
  </section>
}
