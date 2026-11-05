import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, RotateCcw, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { getCalendarDate, addCalendarDays } from './date-utils.js'
import { movePeriod, periodStart, type ReviewPeriodType } from './review-period.js'
import type { ReviewFields } from './shared/schemas/review.js'
import { SectionTopbar } from './section-topbar.js'
import { SkeletonRows } from './skeletons.js'
import { weeklyShareText } from './weekly-share.js'
import './reviews.css'

type Review = ReviewFields & { id: string; periodType: ReviewPeriodType; periodStart: string; status: 'draft' | 'completed'; revision: number; updatedAt: string; completedAt: string | null }
type ReviewGoal = { id: string; title: string; periodType: string; status: 'active' | 'completed'; targetDate: string }
type Request = <T>(path: string, options?: RequestInit) => Promise<T>
type SaveState = 'ready' | 'dirty' | 'saving' | 'saved' | 'error' | 'completing' | 'completed'
const blank = (): ReviewFields => ({ wins: '', challenges: '', reflection: '', nextSteps: '' })
const same = (a: ReviewFields, b: ReviewFields) => a.wins === b.wins && a.challenges === b.challenges && a.reflection === b.reflection && a.nextSteps === b.nextSteps
const fields: { key: keyof ReviewFields; label: string; prompt: string }[] = [
  { key: 'wins', label: 'Logros', prompt: '¿Qué salió bien?' },
  { key: 'challenges', label: 'Dificultades', prompt: '¿Qué fue difícil?' },
  { key: 'reflection', label: 'Reflexión', prompt: '¿Qué aprendiste o sentiste?' },
  { key: 'nextSteps', label: 'Próximos pasos', prompt: '¿Qué te gustaría hacer después?' },
]
const weeklySteps = [
  { title: 'Mira lo que planeaste', description: 'Repasa tus metas y escribe lo que aprendiste de la semana.', fields: ['challenges', 'reflection'] as const },
  { title: 'Celebra lo que avanzó', description: 'Reconoce los logros grandes y pequeños antes de seguir.', fields: ['wins'] as const },
  { title: 'Elige tu enfoque', description: 'Define el siguiente paso que quieres cuidar esta semana.', fields: ['nextSteps'] as const },
]

function dateLabel(date: string, options: Intl.DateTimeFormatOptions) {
  const label = new Intl.DateTimeFormat('es', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function initialReviewPeriod(today: string) {
  const match = /^#reviews\/(daily|weekly)\/(\d{4}-\d{2}-\d{2})$/.exec(window.location.hash)
  if (!match) return null
  const type = match[1] as ReviewPeriodType
  const start = match[2]!
  if (Number.isNaN(Date.parse(`${start}T12:00:00Z`)) || periodStart(start, type) !== start || start > periodStart(today, type)) return null
  return { type, start }
}

function ReviewEditor({ userId, type, start, request, onSaveState }: { userId: string; type: ReviewPeriodType; start: string; request: Request; onSaveState: (state: SaveState) => void }) {
  const cache = useQueryClient()
  const key = ['review', userId, type, start]
  const review = useQuery({ queryKey: key, queryFn: () => request<Review | null>(`/reviews/${type}/${start}`), refetchOnWindowFocus: false })
  const weeklyGoals = useQuery({ queryKey: ['goals', userId], queryFn: () => request<ReviewGoal[]>('/goals'), enabled: type === 'weekly' })
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<ReviewFields>(blank)
  const [confirmedState, setConfirmedState] = useState<ReviewFields>(blank)
  const [saveState, setSaveState] = useState<SaveState>('ready')
  const [errorMessage, setErrorMessage] = useState('')
  const [failedAction, setFailedAction] = useState<'complete' | 'reopen' | null>(null)
  const initialized = useRef(false)
  const confirmed = useRef<ReviewFields>(blank())
  const latest = useRef<ReviewFields>(blank())
  const revision = useRef(0)
  const saving = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!review.isSuccess || initialized.current) return
    initialized.current = true
    const values = review.data ? { wins: review.data.wins, challenges: review.data.challenges, reflection: review.data.reflection, nextSteps: review.data.nextSteps } : blank()
    confirmed.current = values
    setConfirmedState(values)
    latest.current = values
    revision.current = review.data?.revision ?? 0
    setDraft(values)
    setSaveState(review.data?.status === 'completed' ? 'completed' : 'ready')
    setErrorMessage('')
  }, [review.data, review.isSuccess])

  useEffect(() => { onSaveState(saveState) }, [onSaveState, saveState])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!['dirty', 'saving', 'error'].includes(saveState)) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    const guardLinks = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href^="#"]')) {
        event.preventDefault()
        toast.warning(saveState === 'error' ? 'Reintenta o descarta los cambios antes de salir.' : 'Espera a que se guarde la revisión antes de salir.')
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', guardLinks, true)
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLinks, true) }
  }, [saveState])

  const saveCurrent = useCallback(async () => {
    if (saving.current || same(latest.current, confirmed.current)) return
    saving.current = true
    const snapshot = { ...latest.current }
    setSaveState('saving')
    let succeeded = false
    try {
      const result = await request<Review>(`/reviews/${type}/${start}`, { method: 'PUT', body: JSON.stringify({ ...snapshot, baseRevision: revision.current }) })
      revision.current = result.revision
      confirmed.current = snapshot
      setConfirmedState(snapshot)
      cache.setQueryData(['review', userId, type, start], result)
      void cache.invalidateQueries({ queryKey: ['reviews-history', userId] })
      void cache.invalidateQueries({ queryKey: ['reminders', userId] })
      setErrorMessage('')
      succeeded = true
      if (same(latest.current, snapshot)) setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos guardar. Reinténtalo.')
    } finally {
      saving.current = false
      if (succeeded && !same(latest.current, snapshot)) {
        setSaveState('dirty')
        timer.current = setTimeout(() => { void saveCurrent() }, 700)
      }
    }
  }, [cache, request, start, type, userId])

  function changeField(field: keyof ReviewFields, value: string) {
    const next = { ...latest.current, [field]: value }
    latest.current = next
    setDraft(next)
    setSaveState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void saveCurrent() }, 700)
  }

  async function changeStatus(action: 'complete' | 'reopen') {
    if (!review.data || saving.current) return
    setSaveState('completing')
    try {
      const result = await request<Review>(`/reviews/${type}/${start}/${action}`, { method: 'POST', body: JSON.stringify({ baseRevision: revision.current }) })
      revision.current = result.revision
      cache.setQueryData(['review', userId, type, start], result)
      void cache.invalidateQueries({ queryKey: ['reviews-history', userId] })
      void cache.invalidateQueries({ queryKey: ['reminders', userId] })
      setSaveState(result.status === 'completed' ? 'completed' : 'ready')
      setErrorMessage('')
      setFailedAction(null)
    } catch (error) {
      setSaveState('error')
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos cambiar el estado.')
      setFailedAction(action)
    }
  }

  async function shareProgress() {
    const goals = (weeklyGoals.data ?? []).filter((goal) => goal.status === 'completed').map((goal) => goal.title)
    const text = weeklyShareText(draft, goals)
    try {
      if (navigator.share) await navigator.share({ title: 'Mi revisión semanal', text })
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast.success('Resumen copiado. Compártelo con quien elijas.')
      } else toast.error('Tu navegador no permite compartir este resumen.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('No pudimos compartir el resumen. Inténtalo de nuevo.')
    }
  }

  if (review.isLoading) return <SkeletonRows label="tu revisión" rows={4} />
  if (review.error) return <div className="error-banner" role="alert"><p>No pudimos cargar la revisión.</p><button type="button" onClick={() => { void review.refetch() }}>Intentar de nuevo</button></div>
  const completed = review.data?.status === 'completed'
  const unsaved = !same(draft, confirmedState)
  const activeStep = weeklySteps[step]!
  const visibleFields = type === 'weekly' ? fields.filter((field) => (activeStep.fields as readonly string[]).includes(field.key)) : fields

  return <section className="review-editor" aria-label="Editor de revisión">
    <div className="review-editor-status"><span className={`review-state review-state-${saveState}`} role="status">{saveState === 'error' ? 'Error al guardar' : saveState === 'completing' ? 'Actualizando…' : completed ? 'Completada' : saveState === 'saving' ? 'Guardando…' : saveState === 'dirty' ? 'Cambios sin guardar' : saveState === 'saved' ? 'Guardado' : review.data ? 'Borrador guardado' : 'Nuevo borrador'}</span>{review.data?.updatedAt && <small>Último guardado: {new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(review.data.updatedAt))}</small>}</div>
    {saveState === 'error' && <div className="review-save-error" role="alert"><p>{errorMessage} {unsaved ? 'Este texto aún no está guardado.' : ''}</p><div>{errorMessage.includes('cambió') ? <button type="button" onClick={() => { initialized.current = false; void review.refetch() }}>Recargar versión guardada</button> : <button type="button" onClick={() => { if (failedAction) void changeStatus(failedAction); else void saveCurrent() }}>Reintentar</button>}{unsaved && <button type="button" onClick={() => { latest.current = confirmed.current; setDraft(confirmed.current); setSaveState(review.data?.status === 'completed' ? 'completed' : 'ready'); setErrorMessage('') }}>Descartar cambios sin guardar</button>}</div></div>}
    {type === 'weekly' && <div className="review-wizard" aria-label="Planificación semanal"><div className="review-wizard-progress" aria-label={`Paso ${step + 1} de 3`}>{weeklySteps.map((item, index) => <span key={item.title} className={index <= step ? 'review-wizard-progress-active' : ''} />)}</div><p className="review-wizard-count">Paso {step + 1} de 3</p><h3>{activeStep.title}</h3><p>{activeStep.description}</p>{step === 0 && <div className="review-goal-recap"><strong>Metas para tener presentes</strong>{weeklyGoals.isLoading ? <p>Cargando tus metas…</p> : weeklyGoals.error ? <p>No pudimos cargar tus metas. Puedes continuar con tu reflexión.</p> : (weeklyGoals.data ?? []).length === 0 ? <p>Esta semana comienza con una página en blanco.</p> : <ul>{(weeklyGoals.data ?? []).slice(0, 5).map((goal) => <li key={goal.id}><Check size={14} aria-hidden="true" /><span>{goal.title}</span><small>{goal.status === 'completed' ? 'Lograda' : 'En curso'}</small></li>)}</ul>}</div>}</div>}
    <div className="review-fields">{visibleFields.map((field) => <label key={field.key}>{field.label}<textarea value={draft[field.key]} onChange={(event) => changeField(field.key, event.target.value)} disabled={completed || saveState === 'completing' || saveState === 'error'} maxLength={5000} rows={4} placeholder={type === 'weekly' && field.key === 'nextSteps' ? '¿Cuál será tu prioridad para la nueva semana?' : field.prompt} /></label>)}</div>
    {type === 'weekly' && <div className="review-wizard-actions"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ArrowLeft size={15} />Anterior</button>{step < 2 && <button type="button" onClick={() => setStep((current) => Math.min(2, current + 1))}>Continuar<ArrowRight size={15} /></button>}</div>}
    {(type === 'daily' || step === 2 || completed) && <div className="review-footer"><p>{completed ? 'Puedes reabrirla para corregirla sin crear otra revisión.' : 'Se guarda automáticamente cuando dejas de escribir. Puedes volver después.'}</p><div className="review-footer-actions">{completed && type === 'weekly' && <button type="button" onClick={() => { void shareProgress() }}><Share2 size={16} /> Compartir con un mentor / compañero</button>}{completed ? <button type="button" onClick={() => { void changeStatus('reopen') }} disabled={saveState === 'completing'}><RotateCcw size={16} /> Reabrir revisión</button> : <button type="button" onClick={() => { void changeStatus('complete') }} disabled={!review.data || unsaved || ['saving', 'dirty', 'error', 'completing'].includes(saveState)}><Check size={16} /> Marcar como completada</button>}</div></div>}
  </section>
}

export function ReviewsPage({ userId, timeZone, request }: { userId: string; timeZone: string; request: Request }) {
  const [today, setToday] = useState(() => getCalendarDate(new Date(), timeZone))
  const [type, setType] = useState<ReviewPeriodType>(() => initialReviewPeriod(today)?.type ?? 'daily')
  useEffect(() => {
    const refresh = () => setToday(getCalendarDate(new Date(), timeZone))
    const interval = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh) }
  }, [timeZone])
  const [start, setStart] = useState(() => initialReviewPeriod(today)?.start ?? periodStart(today, 'daily'))
  const [saveState, setSaveState] = useState<SaveState>('ready')
  const history = useQuery({ queryKey: ['reviews-history', userId], queryFn: () => request<Review[]>('/reviews') })
  const locked = ['dirty', 'saving', 'error', 'completing'].includes(saveState)
  const currentStart = periodStart(today, type)
  const isCurrent = start === currentStart
  const label = type === 'daily' ? dateLabel(start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `${dateLabel(start, { day: 'numeric', month: 'short' })} – ${dateLabel(addCalendarDays(start, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
  const changeType = (next: ReviewPeriodType) => { if (locked) return; setType(next); setStart(periodStart(today, next)); setSaveState('ready') }
  const move = (offset: number) => { if (locked) return; const next = movePeriod(start, type, offset); if (next <= currentStart) { setStart(next); setSaveState('ready') } }
  const goHistory = (review: Review) => { if (locked) return; setType(review.periodType); setStart(review.periodStart); setSaveState('ready'); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <div className="reviews-page">
    <SectionTopbar title="Revisiones" icon={BookOpenCheck} actions={<a className="reviews-back" href="#home"><ArrowLeft size={16} /> Inicio</a>} />
    <div className="reviews-toolbar"><div className="reviews-type" role="group" aria-label="Tipo de revisión"><button type="button" aria-pressed={type === 'daily'} onClick={() => changeType('daily')} disabled={locked}>Día</button><button type="button" aria-pressed={type === 'weekly'} onClick={() => changeType('weekly')} disabled={locked}>Semana</button></div><div className="reviews-date-controls"><button type="button" onClick={() => move(-1)} disabled={locked} aria-label="Periodo anterior"><ArrowLeft size={17} /></button><button type="button" onClick={() => move(1)} disabled={locked || isCurrent} aria-label="Periodo siguiente"><ArrowRight size={17} /></button><button type="button" onClick={() => { if (!locked) setStart(currentStart) }} disabled={locked || isCurrent}>Hoy</button></div></div>
    <h2 className="reviews-period">{label}</h2>
    <ReviewEditor key={`${type}:${start}`} userId={userId} type={type} start={start} request={request} onSaveState={setSaveState} />
    <section className="reviews-history" aria-labelledby="reviews-history-title"><h2 id="reviews-history-title">Revisiones anteriores</h2>{history.isLoading && <SkeletonRows label="historial" rows={2} />}{history.error && <div className="error-banner" role="alert"><p>No pudimos cargar el historial.</p><button type="button" onClick={() => { void history.refetch() }}>Reintentar</button></div>}{history.data?.length === 0 && <p>Aparecerán aquí cuando guardes tu primera revisión.</p>}{history.data?.map((item) => <button key={item.id} type="button" onClick={() => goHistory(item)} disabled={locked} className="reviews-history-row"><span>{item.periodType === 'daily' ? 'Día' : 'Semana'} · {dateLabel(item.periodStart, { day: 'numeric', month: 'short', year: 'numeric' })}</span><small>{item.status === 'completed' ? 'Completada' : 'Borrador'}</small></button>)}</section>
  </div>
}
