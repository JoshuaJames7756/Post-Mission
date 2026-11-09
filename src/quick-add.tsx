import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, CheckSquare2, FileText, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { getLocalDateTimeValue, getZonedDateTimeOptions } from './calendar-time.js'
import './quick-add.css'

type Request = <T>(path: string, options?: RequestInit) => Promise<T>
type Kind = 'task' | 'note' | 'event'
type Capture = { kind: Kind; title: string; content: string; category: string; allDay: boolean; startLocal: string; endLocal: string; startOffsetMinutes: number | undefined; endOffsetMinutes: number | undefined }
const emptyLinks = { goalIds: [], taskIds: [], eventIds: [], personIds: [], placeIds: [] }
const eventPresets = [
  { name: 'Reunión', color: 'navy' }, { name: 'Estudio', color: 'slate' },
  { name: 'Trabajo', color: 'amber' }, { name: 'Familia', color: 'sage' },
  { name: 'Cita', color: 'navy' }, { name: 'Personal', color: 'sage' },
] as const

export function QuickAdd({ userId, request, online, timeZone, disabled = false }: { userId: string; request: Request; online: boolean; timeZone: string; disabled?: boolean }) {
  const cache = useQueryClient()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<(typeof eventPresets)[number]['name']>('Personal')
  const [allDay, setAllDay] = useState(false)
  const [startLocal, setStartLocal] = useState(() => getLocalDateTimeValue(new Date(Date.now() + 30 * 60_000).toISOString(), timeZone))
  const [endLocal, setEndLocal] = useState(() => getLocalDateTimeValue(new Date(Date.now() + 90 * 60_000).toISOString(), timeZone))
  const [startOffset, setStartOffset] = useState<number | undefined>()
  const [endOffset, setEndOffset] = useState<number | undefined>()
  const validLocal = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
  const startOptions = kind === 'event' && !allDay && validLocal.test(startLocal) ? getZonedDateTimeOptions(startLocal, timeZone) : []
  const endOptions = kind === 'event' && !allDay && validLocal.test(endLocal) ? getZonedDateTimeOptions(endLocal, timeZone) : []
  const selectedStartOffset = startOptions.length === 1 ? startOptions[0]?.offsetMinutes : startOffset
  const selectedEndOffset = endOptions.length === 1 ? endOptions[0]?.offsetMinutes : endOffset
  const eventInvalid = kind === 'event' && !allDay && (endLocal <= startLocal || startOptions.length === 0 || endOptions.length === 0 || selectedStartOffset === undefined || selectedEndOffset === undefined)
  const mutation = useMutation({
    mutationFn: (capture: Capture) => {
      const path = capture.kind === 'task' ? '/tasks' : capture.kind === 'note' ? '/notes' : '/events'
      const body = capture.kind === 'task'
        ? { title: capture.title, priority: 'normal' }
        : capture.kind === 'note'
          ? { title: capture.title, content: capture.content, links: emptyLinks }
          : capture.allDay
            ? { title: capture.title, description: null, category: capture.category, color: eventPresets.find((item) => item.name === capture.category)!.color, goalId: null, allDay: true, startDate: capture.startLocal.slice(0, 10), endDate: capture.startLocal.slice(0, 10) }
            : { title: capture.title, description: null, category: capture.category, color: eventPresets.find((item) => item.name === capture.category)!.color, goalId: null, allDay: false, startLocal: capture.startLocal, endLocal: capture.endLocal, timeZone, startOffsetMinutes: capture.startOffsetMinutes, endOffsetMinutes: capture.endOffsetMinutes }
      return request(path, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: (_result, capture) => {
      void cache.invalidateQueries({ queryKey: [capture.kind === 'task' ? 'tasks' : capture.kind === 'note' ? 'notes' : 'events', userId] })
      toast.success(capture.kind === 'task' ? 'Tarea añadida.' : capture.kind === 'note' ? 'Nota guardada.' : 'Evento creado.')
      reset()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No pudimos guardar. Inténtalo de nuevo.'),
  })

  function reset() {
    setOpen(false); setKind(null); setTitle(''); setContent(''); setCategory('Personal'); setAllDay(false)
    setStartOffset(undefined); setEndOffset(undefined)
  }

  function openSheet() {
    const now = Date.now()
    setStartLocal(getLocalDateTimeValue(new Date(now + 30 * 60_000).toISOString(), timeZone))
    setEndLocal(getLocalDateTimeValue(new Date(now + 90 * 60_000).toISOString(), timeZone))
    setOpen(true)
  }

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
    }
    if (!open && element.open) element.close()
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])
  useEffect(() => { if (open && kind) titleInput.current?.focus() }, [open, kind])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!online || !kind || !title.trim() || mutation.isPending || eventInvalid) return
    mutation.mutate({ kind, title: title.trim(), content: content.trim(), category, allDay, startLocal, endLocal, startOffsetMinutes: selectedStartOffset, endOffsetMinutes: selectedEndOffset })
  }

  return <>
    <button className="quick-add-fab" type="button" aria-label="Captura rápida" title="Captura rápida" disabled={disabled} onClick={openSheet}><Plus size={24} aria-hidden="true" /></button>
    <dialog ref={dialog} className="quick-add-sheet" aria-labelledby="quick-add-title" onClose={reset} onClick={(event) => { if (event.target === event.currentTarget) reset() }}>
      <div className="quick-add-heading"><div>{kind && <button className="quick-add-back" type="button" aria-label="Elegir otro tipo" disabled={mutation.isPending} onClick={() => setKind(null)}><ArrowLeft size={16} /> Volver</button>}<p>{kind ? 'Captura rápida' : 'Guarda lo que importa'}</p><h2 id="quick-add-title">{kind === 'task' ? 'Nueva tarea' : kind === 'note' ? 'Nueva nota' : kind === 'event' ? 'Nuevo evento' : '¿Qué quieres guardar?'}</h2></div><button type="button" aria-label="Cerrar captura rápida" onClick={reset}><X size={18} /></button></div>
      {!kind ? <div className="quick-add-choices" aria-label="Elige qué guardar">
        <button type="button" onClick={() => setKind('task')}><CheckSquare2 size={20} /><span><strong>Tarea rápida</strong><small>Un siguiente paso concreto</small></span></button>
        <button type="button" onClick={() => setKind('note')}><FileText size={20} /><span><strong>Nota o impresión</strong><small>Una idea, reflexión o recuerdo</small></span></button>
        <button type="button" onClick={() => setKind('event')}><CalendarDays size={20} /><span><strong>Evento</strong><small>Reserva un momento en tu agenda</small></span></button>
      </div> : <form onSubmit={submit}>
        <label>{kind === 'task' ? '¿Qué harás?' : kind === 'note' ? 'Título de la nota' : '¿Qué vas a planificar?'}<input ref={titleInput} required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'task' ? 'Un paso pequeño…' : kind === 'note' ? 'Una idea para recordar…' : 'Ej. Reunión con Ana'} /></label>
        {kind === 'note' && <label>Tu nota<textarea maxLength={20_000} rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escribe aquí tu idea, impresión o recuerdo…" /></label>}
        {kind === 'event' && <>
          <fieldset className="quick-add-categories"><legend>Tipo de evento</legend><div>{eventPresets.map((preset) => <button key={preset.name} type="button" aria-pressed={category === preset.name} onClick={() => setCategory(preset.name)}><span className={`color-swatch-dot color-swatch-${preset.color}`} aria-hidden="true" />{preset.name}</button>)}</div></fieldset>
          <label className="quick-add-all-day"><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />Todo el día</label>
          <div className="quick-add-dates"><label>{allDay ? 'Día' : 'Empieza'}<input type={allDay ? 'date' : 'datetime-local'} required value={allDay ? startLocal.slice(0, 10) : startLocal} onChange={(event) => { const value = allDay ? `${event.target.value}T09:00` : event.target.value; setStartLocal(value); setStartOffset(undefined); if (validLocal.test(value) && value >= endLocal) { const next = new Date(Date.parse(`${value}:00Z`) + 60 * 60_000).toISOString().slice(0, 16); setEndLocal(next); setEndOffset(undefined) } }} /></label>{!allDay && <label>Termina<input type="datetime-local" required value={endLocal} onChange={(event) => { setEndLocal(event.target.value); setEndOffset(undefined) }} /></label>}</div>
          {!allDay && startOptions.length > 1 && <label>Inicio: elige el horario<select required value={startOffset ?? ''} onChange={(event) => setStartOffset(Number(event.target.value))}><option value="">Selecciona</option>{startOptions.map((option) => <option key={option.instant} value={option.offsetMinutes}>{new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short' }).format(new Date(option.instant))}</option>)}</select></label>}
          {!allDay && endOptions.length > 1 && <label>Final: elige el horario<select required value={endOffset ?? ''} onChange={(event) => setEndOffset(Number(event.target.value))}><option value="">Selecciona</option>{endOptions.map((option) => <option key={option.instant} value={option.offsetMinutes}>{new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short' }).format(new Date(option.instant))}</option>)}</select></label>}
          {eventInvalid && <p className="quick-add-error" role="alert">{endLocal <= startLocal ? 'La hora final debe ser posterior al inicio.' : 'Esta hora no existe o se repite en tu zona horaria. Elige otra hora o selecciona su horario.'}</p>}
        </>}
        {!online && <p className="quick-add-offline" role="status">Conéctate para guardar esta captura.</p>}
        <button className="quick-add-save" type="submit" disabled={!online || mutation.isPending || eventInvalid}>{mutation.isPending ? 'Guardando…' : kind === 'task' ? 'Añadir tarea' : kind === 'note' ? 'Guardar nota' : 'Guardar evento'}</button>
      </form>}
    </dialog>
  </>
}
