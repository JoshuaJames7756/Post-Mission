import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, RotateCcw, Sun, X } from 'lucide-react'
import { toast } from 'sonner'
import { addCalendarDays, getCalendarDate } from './date-utils.js'
import { getLocalDateTimeValue, getOffsetMinutesAt, getZonedDateTimeOptions } from './calendar-time.js'
import { LoadingState } from './loading-state.js'
import { CalendarSkeleton } from './skeletons.js'
import { SectionTopbar } from './section-topbar.js'
import { EmptyState } from './empty-state.js'
import { AreaTag } from './area-tag.js'
import { areaForGoal, type AreaReference } from './area-colors.js'
import { eventOccursOnDate, eventTimelineRange } from './calendar-display.js'
import { movedEventInput, resizableEventRange, resizedEventInput, scheduleAllDayEventInput, snapEventEnd, snapEventStart } from './calendar-drag.js'

type EventColor = 'sage' | 'amber' | 'navy' | 'slate'
const eventPresets: { name: string; color: EventColor }[] = [
  { name: 'Reunión', color: 'navy' }, { name: 'Estudio', color: 'slate' },
  { name: 'Trabajo', color: 'amber' }, { name: 'Familia', color: 'sage' },
  { name: 'Cita', color: 'navy' }, { name: 'Personal', color: 'sage' },
]
const eventColors: { value: EventColor; label: string }[] = [
  { value: 'sage', label: 'Salvia' }, { value: 'amber', label: 'Ámbar' },
  { value: 'navy', label: 'Azul' }, { value: 'slate', label: 'Gris' },
]
type CalendarEvent = {
  id: string
  title: string
  description: string | null
  category: string
  color: EventColor
  goalId: string | null
  allDay: boolean
  startDate: string | null
  endDate: string | null
  startAt: string | null
  endAt: string | null
  timeZone: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
}
type CalendarRequest = (path: string, options?: RequestInit) => Promise<unknown>
type CalendarPageProps = {
  userId: string
  timeZone: string
  goals: Array<{ id: string; title: string; lifeAreaId?: string | null }>
  areas?: AreaReference[]
  request: CalendarRequest
}
type DragGesture = { event: CalendarEvent; mode: 'move' | 'resize'; pointerId: number; startY: number; startPageScrollY: number; startMinute: number; endMinute: number; durationMinutes: number; moved: boolean }
type AllDayDragGesture = { event: CalendarEvent; pointerId: number; startX: number; startY: number; clientX: number; clientY: number; moved: boolean }

function minuteLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

function monthString(date: Date, zone: string) {
  return getCalendarDate(date, zone).slice(0, 7)
}

function shiftMonth(month: string, amount: number) {
  const year = Number(month.slice(0, 4))
  const index = Number(month.slice(5, 7))
  const next = new Date(Date.UTC(year, index - 1 + amount, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthGrid(month: string) {
  const firstDay = `${month}-01`
  const weekday = new Date(`${firstDay}T00:00:00.000Z`).getUTCDay()
  const firstCell = addCalendarDays(firstDay, -((weekday + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(firstCell, index))
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T12:00:00.000Z`))
}

function dayLabel(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00.000Z`))
}

function weekDays(date: string) {
  const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
  const monday = addCalendarDays(date, -((weekday + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index))
}

function weekdayShort(date: string) {
  return new Intl.DateTimeFormat('es', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00.000Z`)).replace('.', '')
}

function formatTime(instant: string, zone: string) {
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(instant))
}

function formatOffset(offset: number) {
  const sign = offset < 0 ? '−' : '+'
  const absolute = Math.abs(offset)
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

function possibleOptions(local: string, zone: string) {
  if (!local || !zone) return []
  try { return getZonedDateTimeOptions(local, zone) } catch { return [] }
}

export function CalendarPage({ userId, timeZone, goals, areas = [], request }: CalendarPageProps) {
  const queryClient = useQueryClient()
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const addEventButtonRef = useRef<HTMLButtonElement>(null)
  const eventDialogRef = useRef<HTMLDialogElement>(null)
  const formTriggerRef = useRef<HTMLElement | null>(null)
  const positionedDayRef = useRef<string | null>(null)
  const dragGestureRef = useRef<DragGesture | null>(null)
  const allDayDragRef = useRef<AllDayDragGesture | null>(null)
  const allDayScrollFrameRef = useRef<number | null>(null)
  const suppressClickRef = useRef<string | null>(null)
  const [dragPreview, setDragPreview] = useState<{ id: string; start: number; end: number } | null>(null)
  const [allDayDragPreview, setAllDayDragPreview] = useState<{ id: string; title: string; minute: number } | null>(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => () => {
    if (allDayScrollFrameRef.current !== null) cancelAnimationFrame(allDayScrollFrameRef.current)
  }, [])
  useEffect(() => {
    const refreshClock = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    const timer = window.setInterval(refreshClock, 60_000)
    document.addEventListener('visibilitychange', refreshClock)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshClock)
    }
  }, [])
  const [month, setMonth] = useState(() => monthString(new Date(), timeZone))
  const [calendarView, setCalendarView] = useState<'day' | 'month'>('day')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => getCalendarDate(new Date(), timeZone))
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Personal')
  const [color, setColor] = useState<EventColor>('sage')
  const [goalId, setGoalId] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [startDate, setStartDate] = useState(() => getCalendarDate(new Date(), timeZone))
  const [endDate, setEndDate] = useState(() => getCalendarDate(new Date(), timeZone))
  const [startLocal, setStartLocal] = useState(() => `${getCalendarDate(new Date(), timeZone)}T09:00`)
  const [endLocal, setEndLocal] = useState(() => `${getCalendarDate(new Date(), timeZone)}T10:00`)
  const [eventTimeZone, setEventTimeZone] = useState(timeZone)
  const [startOffset, setStartOffset] = useState<number | null>(null)
  const [endOffset, setEndOffset] = useState<number | null>(null)

  useEffect(() => {
    const dialog = eventDialogRef.current
    if (!dialog) return
    if (formOpen && !dialog.open) dialog.showModal()
    else if (!formOpen && dialog.open) dialog.close()
  }, [formOpen])

  const dates = useMemo(() => monthGrid(month), [month])
  const visibleWeekDays = useMemo(() => weekDays(selectedDate), [selectedDate])
  const from = dates[0]!
  const to = dates[dates.length - 1]!
  const rangeQuery = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&timeZone=${encodeURIComponent(timeZone)}`
  const events = useQuery({
    queryKey: ['events', userId, from, to, timeZone],
    queryFn: async () => await request(`/events?${rangeQuery}`) as CalendarEvent[],
  })
  const archivedEvents = useQuery({
    queryKey: ['events', 'archived', userId, from, to, timeZone],
    queryFn: async () => await request(`/events?${rangeQuery}&archived=true`) as CalendarEvent[],
  })
  const mutation = useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: string; body?: unknown; successMessage?: string }) => request(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events', userId] }),
        queryClient.invalidateQueries({ queryKey: ['events', 'archived', userId] }),
        queryClient.invalidateQueries({ queryKey: ['reminders', userId] }),
      ])
      toast.success(variables.successMessage ?? 'Cambios guardados.')
      closeForm()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo guardar el evento.'),
  })
  const moveMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof movedEventInput>; kind: 'move' | 'resize' | 'schedule' }) => request(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async (_data, variables) => {
      setDragPreview(null)
      setAllDayDragPreview(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events', userId] }),
        queryClient.invalidateQueries({ queryKey: ['reminders', userId] }),
      ])
      toast.success(variables.kind === 'resize' ? 'Duración del evento actualizada.' : variables.kind === 'schedule' ? 'Evento añadido al horario.' : 'Hora del evento actualizada.')
    },
    onError: (error) => {
      setDragPreview(null)
      setAllDayDragPreview(null)
      toast.error(error instanceof Error ? error.message : 'No se pudo mover el evento.')
    },
  })

  const startOptions = useMemo(() => possibleOptions(startLocal, eventTimeZone), [startLocal, eventTimeZone])
  const endOptions = useMemo(() => possibleOptions(endLocal, eventTimeZone), [endLocal, eventTimeZone])
  const selectedStartOffset = startOffset ?? (startOptions.length === 1 ? startOptions[0]!.offsetMinutes : null)
  const selectedEndOffset = endOffset ?? (endOptions.length === 1 ? endOptions[0]!.offsetMinutes : null)
  const timeInputInvalid = !allDay && (
    startOptions.length === 0 || endOptions.length === 0 || selectedStartOffset === null || selectedEndOffset === null
  )
  const datesInvalid = allDay && endDate < startDate
  const today = getCalendarDate(now, timeZone)

  function closeForm() {
    setFormOpen(false)
    setEditingEvent(null)
    window.setTimeout(() => {
      const trigger = formTriggerRef.current
      const target = trigger?.classList.contains('calendar-hour-hit-area')
        ? timelineScrollRef.current
        : trigger?.isConnected && trigger !== document.body ? trigger : addEventButtonRef.current
      target?.focus()
    }, 0)
  }

  function goToToday() {
    const current = new Date()
    const date = getCalendarDate(current, timeZone)
    const localTime = getLocalDateTimeValue(current.toISOString(), timeZone)
    const minute = Number(localTime.slice(11, 13)) * 60 + Number(localTime.slice(14, 16))
    setNow(current)
    setMonth(date.slice(0, 7))
    setSelectedDate(date)
    requestAnimationFrame(() => {
      scrollToTimelineMinute(minute)
    })
  }

  function scrollToTimelineMinute(minute: number) {
    const timeline = timelineScrollRef.current
    if (!timeline) return
    const pageTop = timeline.getBoundingClientRect().top + window.scrollY
    const contextAbove = Math.min(220, Math.max(120, window.innerHeight * 0.28))
    window.scrollTo({ top: Math.max(0, pageTop + minute - contextAbove), behavior: 'auto' })
  }

  function resetForm(date: string) {
    formTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditingEvent(null)
    setTitle('')
    setDescription('')
    setCategory('Personal')
    setColor('sage')
    setGoalId('')
    setAllDay(true)
    setStartDate(date)
    setEndDate(date)
    setStartLocal(`${date}T09:00`)
    setEndLocal(`${date}T10:00`)
    setEventTimeZone(timeZone)
    setStartOffset(null)
    setEndOffset(null)
    setSelectedDate(date)
    setFormOpen(true)
  }

  function createTimedEvent(date: string, hour: number) {
    resetForm(date)
    const endDateValue = hour === 23 ? addCalendarDays(date, 1) : date
    const endHour = String((hour + 1) % 24).padStart(2, '0')
    setAllDay(false)
    setStartLocal(`${date}T${String(hour).padStart(2, '0')}:00`)
    setEndLocal(`${endDateValue}T${endHour}:00`)
    setEndDate(endDateValue)
    setStartOffset(null)
    setEndOffset(null)
  }

  function editEvent(event: CalendarEvent) {
    formTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditingEvent(event)
    setTitle(event.title)
    setDescription(event.description ?? '')
    setCategory(event.category)
    setColor(event.color)
    setGoalId(event.goalId ?? '')
    setAllDay(event.allDay)
    setStartDate(event.startDate ?? '')
    setEndDate(event.endDate ?? '')
    const zone = event.timeZone ?? timeZone
    setEventTimeZone(zone)
    setStartLocal(event.startAt ? getLocalDateTimeValue(event.startAt, zone) : '')
    setEndLocal(event.endAt ? getLocalDateTimeValue(event.endAt, zone) : '')
    setStartOffset(event.startAt ? getOffsetMinutesAt(event.startAt, zone) : null)
    setEndOffset(event.endAt ? getOffsetMinutesAt(event.endAt, zone) : null)
    setFormOpen(true)
  }

  function moveEvent(event: CalendarEvent, targetMinute: number, kind: 'move' | 'resize' = 'move') {
    try {
      const body = kind === 'resize'
        ? resizedEventInput(event, selectedDate, timeZone, targetMinute)
        : movedEventInput(event, selectedDate, timeZone, targetMinute)
      moveMutation.mutate({ id: event.id, body, kind })
    } catch (error) {
      setDragPreview(null)
      toast.error(error instanceof Error && error.message === 'nonexistent_target_time'
        ? 'Esa hora no existe por el cambio de horario. Elige otra.'
        : 'No se pudo elegir esa hora. Abre el evento para ajustarlo.')
    }
  }

  function startDragging(event: CalendarEvent, pointer: ReactPointerEvent<HTMLButtonElement>) {
    if (moveMutation.isPending || !pointer.isPrimary || (pointer.pointerType === 'mouse' && pointer.button !== 0)) return
    const range = resizableEventRange(event, selectedDate, timeZone)
    if (!range) return
    const bounds = pointer.currentTarget.getBoundingClientRect()
    const mode = range.durationMinutes >= 30 && bounds.height > 0 && pointer.clientY >= bounds.bottom - 18 ? 'resize' : 'move'
    dragGestureRef.current = {
      event, mode, pointerId: pointer.pointerId, startY: pointer.clientY,
      startPageScrollY: window.scrollY,
      startMinute: range.startMinute, endMinute: range.endMinute, durationMinutes: range.durationMinutes, moved: false,
    }
    pointer.currentTarget.setPointerCapture?.(pointer.pointerId)
  }

  function startAllDayDragging(event: CalendarEvent, pointer: ReactPointerEvent<HTMLButtonElement>) {
    if (moveMutation.isPending || event.status !== 'scheduled' || event.startDate !== selectedDate || event.endDate !== selectedDate || !pointer.isPrimary || (pointer.pointerType === 'mouse' && pointer.button !== 0)) return
    allDayDragRef.current = { event, pointerId: pointer.pointerId, startX: pointer.clientX, startY: pointer.clientY, clientX: pointer.clientX, clientY: pointer.clientY, moved: false }
    pointer.currentTarget.setPointerCapture?.(pointer.pointerId)
  }

  function allDayDropMinute(clientX: number, clientY: number) {
    const slots = timelineScrollRef.current?.querySelector('.calendar-time-slots')
    if (!slots) return null
    const bounds = slots.getBoundingClientRect()
    if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null
    return Math.max(0, Math.min(1380, Math.round((clientY - bounds.top) / 15) * 15))
  }

  function continueAllDayDragging(pointer: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = allDayDragRef.current
    if (!gesture || gesture.pointerId !== pointer.pointerId) return
    gesture.clientX = pointer.clientX
    gesture.clientY = pointer.clientY
    if (!gesture.moved && Math.hypot(pointer.clientX - gesture.startX, pointer.clientY - gesture.startY) < 6) return
    gesture.moved = true
    updateAllDayDragPreview(pointer.clientX, pointer.clientY)
    if (allDayScrollFrameRef.current === null) allDayScrollFrameRef.current = requestAnimationFrame(scrollWhileDraggingAllDay)
  }

  function updateAllDayDragPreview(clientX: number, clientY: number) {
    const minute = allDayDropMinute(clientX, clientY)
    const gesture = allDayDragRef.current
    if (!gesture) return
    setAllDayDragPreview(minute === null ? null : { id: gesture.event.id, title: gesture.event.title, minute })
  }

  function scrollWhileDraggingAllDay() {
    allDayScrollFrameRef.current = null
    const gesture = allDayDragRef.current
    if (!gesture?.moved) return
    const direction = gesture.clientY > window.innerHeight - 96 ? 18 : gesture.clientY < 76 ? -18 : 0
    if (!direction) return
    const before = window.scrollY
    window.scrollBy(0, direction)
    updateAllDayDragPreview(gesture.clientX, gesture.clientY)
    if (window.scrollY !== before) allDayScrollFrameRef.current = requestAnimationFrame(scrollWhileDraggingAllDay)
  }

  function stopAllDayDragging(pointer: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const gesture = allDayDragRef.current
    if (!gesture || gesture.pointerId !== pointer.pointerId) return
    allDayDragRef.current = null
    if (allDayScrollFrameRef.current !== null) cancelAnimationFrame(allDayScrollFrameRef.current)
    allDayScrollFrameRef.current = null
    setAllDayDragPreview(null)
    if (!gesture.moved) return
    suppressClickRef.current = gesture.event.id
    window.setTimeout(() => { if (suppressClickRef.current === gesture.event.id) suppressClickRef.current = null }, 0)
    if (cancelled) return
    const minute = allDayDropMinute(pointer.clientX, pointer.clientY)
    if (minute === null) return
    try {
      const body = scheduleAllDayEventInput(gesture.event, selectedDate, timeZone, minute)
      moveMutation.mutate({ id: gesture.event.id, body, kind: 'schedule' })
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'nonexistent_target_time' ? 'Esa hora no existe por el cambio de horario. Elige otra.' : 'No se pudo asignar esa hora al evento.')
    }
  }

  function dragTarget(gesture: DragGesture, clientY: number) {
    const distance = clientY - gesture.startY + window.scrollY - gesture.startPageScrollY
    if (gesture.mode === 'resize') return { start: gesture.startMinute, end: snapEventEnd(gesture.startMinute, gesture.endMinute, distance) }
    const start = snapEventStart(gesture.startMinute, distance, gesture.durationMinutes)
    return { start, end: start + gesture.durationMinutes }
  }

  function continueDragging(pointer: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== pointer.pointerId) return
    if (gesture.moved) {
      if (pointer.clientY < 76) window.scrollBy(0, -18)
      else if (pointer.clientY > window.innerHeight - 96) window.scrollBy(0, 18)
    }
    const distance = pointer.clientY - gesture.startY + window.scrollY - gesture.startPageScrollY
    if (!gesture.moved && Math.abs(distance) < 6) return
    gesture.moved = true
    setDragPreview({ id: gesture.event.id, ...dragTarget(gesture, pointer.clientY) })
  }

  function stopDragging(pointer: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== pointer.pointerId) return
    dragGestureRef.current = null
    if (!gesture.moved || cancelled) { setDragPreview(null); return }
    suppressClickRef.current = gesture.event.id
    window.setTimeout(() => { if (suppressClickRef.current === gesture.event.id) suppressClickRef.current = null }, 0)
    const target = dragTarget(gesture, pointer.clientY)
    if (target.start === gesture.startMinute && target.end === gesture.endMinute) { setDragPreview(null); return }
    setDragPreview({ id: gesture.event.id, ...target })
    moveEvent(gesture.event, gesture.mode === 'resize' ? target.end : target.start, gesture.mode)
  }

  function moveWithKeyboard(event: CalendarEvent, key: string, resize: boolean) {
    const range = resizableEventRange(event, selectedDate, timeZone)
    if (!range || moveMutation.isPending) return
    const direction = key === 'ArrowDown' ? 15 : -15
    const target = resize
      ? { start: range.startMinute, end: snapEventEnd(range.startMinute, range.endMinute, direction) }
      : (() => { const start = snapEventStart(range.startMinute, direction, range.durationMinutes); return { start, end: start + range.durationMinutes } })()
    if (target.start !== range.startMinute || target.end !== range.endMinute) {
      setDragPreview({ id: event.id, ...target })
      moveEvent(event, resize ? target.end : target.start, resize ? 'resize' : 'move')
    }
  }

  function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const shared = { title, description: description || null, category, color, goalId: goalId || null }
    const body = allDay
      ? { ...shared, allDay: true, startDate, endDate }
      : {
          ...shared,
          allDay: false,
          startLocal,
          endLocal,
          timeZone: eventTimeZone,
          startOffsetMinutes: selectedStartOffset,
          endOffsetMinutes: selectedEndOffset,
        }
    mutation.mutate({
      path: editingEvent ? `/events/${editingEvent.id}` : '/events',
      method: editingEvent ? 'PATCH' : 'POST',
      body,
      successMessage: editingEvent ? 'Evento actualizado.' : 'Evento creado.',
    })
  }

  function getEventsForDay(date: string) {
    return (events.data ?? []).filter((event) => eventOccursOnDate(event, date, timeZone))
  }

  function navigateMonth(amount: number) {
    const nextMonth = shiftMonth(month, amount)
    setMonth(nextMonth)
    setSelectedDate(`${nextMonth}-01`)
  }

  function renderEvent(event: CalendarEvent) {
    const timeLabel = event.allDay || !event.startAt || !event.timeZone ? 'Todo el día' : formatTime(event.startAt, timeZone)
    return <button className={`calendar-event calendar-event-${event.color}${event.status === 'completed' ? ' calendar-event-completed' : ''}`} key={event.id} type="button" onClick={() => editEvent(event)} aria-label={`${event.title}, ${timeLabel}`}>
      {!event.allDay && <time>{timeLabel}</time>}<span>{event.title}</span>
    </button>
  }

  const headingMonth = monthLabel(month)
  const selectedDayEvents = getEventsForDay(selectedDate).sort((left, right) => {
    if (left.allDay !== right.allDay) return left.allDay ? -1 : 1
    return (left.startAt ?? '').localeCompare(right.startAt ?? '')
  })
  const allDayEvents = selectedDayEvents.filter((event) => event.allDay)
  const timelineEntries = selectedDayEvents.flatMap((event) => {
    const range = eventTimelineRange(event, selectedDate, timeZone)
    return range ? [{ event, ...range, lane: 0, laneCount: 1 }] : []
  }).sort((left, right) => left.start - right.start)
  const laneEnds: number[] = []
  timelineEntries.forEach((entry) => {
    const availableLane = laneEnds.findIndex((end) => end <= entry.start)
    entry.lane = availableLane < 0 ? laneEnds.length : availableLane
    laneEnds[entry.lane] = entry.end
  })
  timelineEntries.forEach((entry) => {
    entry.laneCount = Math.max(1, ...timelineEntries.filter((other) => other.start < entry.end && entry.start < other.end).map((other) => other.lane + 1))
  })
  const selectedDayLabel = dayLabel(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })
  const timelineHourHeight = 60
  const localNow = getLocalDateTimeValue(now.toISOString(), timeZone)
  const nowMinutes = Number(localNow.slice(11, 13)) * 60 + Number(localNow.slice(14, 16))
  const initialTimelineMinute = selectedDate === today ? nowMinutes : timelineEntries[0]?.start ?? 8 * 60

  useEffect(() => {
    if (calendarView !== 'day') { positionedDayRef.current = null; return }
    if (events.isLoading || events.error) return
    const positionKey = `${selectedDate}:${timeZone}`
    if (positionedDayRef.current === positionKey) return
    const frame = requestAnimationFrame(() => {
      if (timelineScrollRef.current) {
        scrollToTimelineMinute(initialTimelineMinute)
        positionedDayRef.current = positionKey
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [calendarView, events.error, events.isLoading, initialTimelineMinute, selectedDate, timeZone])

  return <section className="calendar-page" aria-label="Agenda">
    <SectionTopbar className="section-topbar-calendar" title="Agenda" icon={CalendarDays} actions={<div className="calendar-view-switch" role="group" aria-label="Vista de agenda">
      <button type="button" className={calendarView === 'day' ? 'calendar-view-current' : ''} aria-pressed={calendarView === 'day'} onClick={() => setCalendarView('day')}><CalendarDays size={15} />Día</button>
      <button type="button" className={calendarView === 'month' ? 'calendar-view-current' : ''} aria-pressed={calendarView === 'month'} onClick={() => setCalendarView('month')}>Mes</button>
    </div>} />

    {calendarView === 'month' && <div className="calendar-toolbar">
      <div className="calendar-month-controls">
        <button type="button" aria-label="Mes anterior" onClick={() => navigateMonth(-1)}><ChevronLeft size={18} /></button>
        <h2>{headingMonth}</h2>
        <button type="button" aria-label="Mes siguiente" onClick={() => navigateMonth(1)}><ChevronRight size={18} /></button>
      </div>
      <button className="calendar-today-button" type="button" onClick={goToToday}>Hoy</button>
    </div>}

    {events.isLoading && <CalendarSkeleton view={calendarView} />}
    {events.error && <div className="error-banner" role="alert"><p>{events.error instanceof Error ? events.error.message : 'No se pudo cargar el calendario.'}</p><button onClick={() => { void events.refetch() }}>Reintentar</button></div>}
    {!events.isLoading && !events.error && <>
      {calendarView === 'day' ? <>
        <div className="calendar-day-controls">
          <button type="button" aria-label="Semana anterior" onClick={() => { const date = addCalendarDays(selectedDate, -7); setSelectedDate(date); setMonth(date.slice(0, 7)) }}><ChevronLeft size={18} /></button>
          <h2>{dayLabel(visibleWeekDays[0]!, { day: 'numeric', month: 'short' })} – {dayLabel(visibleWeekDays[6]!, { day: 'numeric', month: 'short' })}</h2>
          <button type="button" aria-label="Semana siguiente" onClick={() => { const date = addCalendarDays(selectedDate, 7); setSelectedDate(date); setMonth(date.slice(0, 7)) }}><ChevronRight size={18} /></button>
          <button className="calendar-today-button" type="button" onClick={goToToday}>Hoy</button>
        </div>
        <div className="calendar-week-strip" role="group" aria-label="Días de la semana">
          {visibleWeekDays.map((date) => <button type="button" key={date} className={`calendar-week-day${date === selectedDate ? ' calendar-week-day-current' : ''}${date === today ? ' calendar-week-day-today' : ''}`} aria-pressed={date === selectedDate} onClick={() => { setSelectedDate(date); if (!date.startsWith(month)) setMonth(date.slice(0, 7)) }}><span>{weekdayShort(date)}</span><time dateTime={date}>{Number(date.slice(-2))}</time></button>)}
        </div>
        <section className="calendar-day-view" aria-labelledby="calendar-day-title">
          <div className="calendar-day-view-heading"><h2 id="calendar-day-title">{selectedDayLabel}</h2><button ref={addEventButtonRef} className="calendar-agenda-add" type="button" onClick={() => resetForm(selectedDate)}><Plus size={15} />Añadir evento</button></div>
          {selectedDayEvents.length === 0 && <EmptyState icon={Sun} title="Día despejado" description="Puedes dejarlo libre o reservar un momento para lo que importa." compact />}
          {allDayEvents.length > 0 && <div className="calendar-all-day"><span>Todo el día</span>{allDayEvents.map((event) => {
            const schedulable = event.status === 'scheduled' && event.startDate === selectedDate && event.endDate === selectedDate
            return <button key={event.id} type="button" className={`calendar-all-day-event calendar-event-${event.color}${schedulable ? ' calendar-all-day-event-draggable' : ''}`} onPointerDown={(pointer) => startAllDayDragging(event, pointer)} onPointerMove={continueAllDayDragging} onPointerUp={(pointer) => stopAllDayDragging(pointer)} onPointerCancel={(pointer) => stopAllDayDragging(pointer, true)} onClick={() => { if (suppressClickRef.current === event.id) { suppressClickRef.current = null; return } editEvent(event) }} aria-label={`${schedulable ? 'Arrastrar al horario o editar' : 'Editar'} ${event.title}`} title={schedulable ? 'Arrastra al horario para asignar una hora. Toca para editar.' : 'Editar evento'}><strong>{event.title}</strong><small>{event.category}{schedulable ? ' · Arrastra al horario' : ''}</small>{areaForGoal(event.goalId, goals, areas) && <AreaTag name={areaForGoal(event.goalId, goals, areas)!.name} />}</button>
          })}</div>}
          <div className="calendar-time-scroll" ref={timelineScrollRef} role="region" tabIndex={0} aria-label={`Horario del ${selectedDayLabel}`}>
          <div className="calendar-time-grid">
            <div className="calendar-time-labels" aria-hidden="true">{Array.from({ length: 24 }, (_, hour) => <time key={hour} style={{ top: `${hour * timelineHourHeight}px` }}>{String(hour).padStart(2, '0')}:00</time>)}</div>
            <div className="calendar-time-slots">
              {Array.from({ length: 24 }, (_, hour) => <button className="calendar-hour-hit-area" type="button" tabIndex={-1} key={hour} style={{ top: `${hour * timelineHourHeight}px`, height: `${timelineHourHeight}px` }} aria-label={`Crear evento el ${selectedDayLabel} a las ${String(hour).padStart(2, '0')}:00`} onClick={() => createTimedEvent(selectedDate, hour)} />)}
              {Array.from({ length: 24 }, (_, hour) => <div className="calendar-hour-line" key={hour} style={{ top: `${hour * timelineHourHeight}px` }} aria-hidden="true" />)}
              {selectedDate === today && <div className="calendar-current-time" style={{ top: `${nowMinutes}px` }} aria-hidden="true"><span>Ahora · {formatTime(now.toISOString(), timeZone)}</span></div>}
              {allDayDragPreview && <div className="calendar-all-day-drop-preview" style={{ top: `${allDayDragPreview.minute}px` }} aria-hidden="true"><strong>{allDayDragPreview.title}</strong><span>{minuteLabel(allDayDragPreview.minute)} – {minuteLabel(allDayDragPreview.minute + 60)}</span></div>}
              {timelineEntries.map(({ event, start, end, lane, laneCount }) => {
                const range = resizableEventRange(event, selectedDate, timeZone)
                const movable = range !== null
                const resizable = Boolean(range && range.durationMinutes >= 30)
                const previewStart = dragPreview?.id === event.id ? dragPreview.start : start
                const previewEnd = dragPreview?.id === event.id ? dragPreview.end : end
                const label = dragPreview?.id === event.id
                  ? `${minuteLabel(previewStart)} – ${minuteLabel(previewEnd)}`
                  : `${formatTime(event.startAt!, timeZone)} – ${formatTime(event.endAt!, timeZone)}`
                return <button key={event.id} type="button" className={`calendar-time-event calendar-event-${event.color}${event.status === 'completed' ? ' calendar-event-completed' : ''}${movable ? ' calendar-time-event-movable' : ''}${resizable ? ' calendar-time-event-resizable' : ''}${dragPreview?.id === event.id ? ' calendar-time-event-dragging' : ''}`} style={{ top: `${previewStart / 60 * timelineHourHeight}px`, height: `${Math.max(38, (previewEnd - previewStart) / 60 * timelineHourHeight - 4)}px`, left: `${lane * 100 / laneCount}%`, width: `${100 / laneCount}%` }} onPointerDown={(pointer) => startDragging(event, pointer)} onPointerMove={continueDragging} onPointerUp={(pointer) => stopDragging(pointer)} onPointerCancel={(pointer) => stopDragging(pointer, true)} onKeyDown={(key) => { if (key.altKey && (key.key === 'ArrowUp' || key.key === 'ArrowDown')) { key.preventDefault(); moveWithKeyboard(event, key.key, key.shiftKey) } }} onClick={() => { if (suppressClickRef.current === event.id) { suppressClickRef.current = null; return } editEvent(event) }} aria-label={`Editar ${event.title}, ${dragPreview?.id === event.id ? minuteLabel(previewStart) : formatTime(event.startAt!, timeZone)} a ${dragPreview?.id === event.id ? minuteLabel(previewEnd) : formatTime(event.endAt!, timeZone)}`} aria-keyshortcuts={movable ? 'Alt+ArrowUp Alt+ArrowDown Alt+Shift+ArrowUp Alt+Shift+ArrowDown' : undefined} title={movable ? 'Arrastra para mover. Arrastra el borde inferior para cambiar la duración. Alt + flechas mueve; Alt + Mayús + flechas cambia la duración.' : 'Editar evento'}><strong>{event.title}</strong><span>{label}</span>{areaForGoal(event.goalId, goals, areas) && <AreaTag name={areaForGoal(event.goalId, goals, areas)!.name} />}</button>
              })}
            </div>
          </div>
          </div>
        </section>
      </> : <>
      <div className="calendar-weekdays" aria-hidden="true">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid" aria-label={`Calendario de ${headingMonth}`}>
        {dates.map((date) => {
          const inMonth = date.startsWith(month)
          const eventsForDay = getEventsForDay(date)
          return <section className={`calendar-day${inMonth ? '' : ' calendar-day-outside'}${date === today ? ' calendar-day-today' : ''}${date === selectedDate ? ' calendar-day-selected' : ''}`} key={date} aria-label={dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}>
            <button className="calendar-day-number" type="button" aria-pressed={date === selectedDate} onClick={() => { setSelectedDate(date); if (!inMonth) setMonth(date.slice(0, 7)) }} aria-label={`Ver agenda del ${dayLabel(date, { day: 'numeric', month: 'long' })}${eventsForDay.length ? `, ${eventsForDay.length} ${eventsForDay.length === 1 ? 'evento' : 'eventos'}` : ''}`}><time dateTime={date}>{Number(date.slice(-2))}</time>{eventsForDay.length > 0 && <span className="calendar-day-indicators" aria-hidden="true">{eventsForDay.slice(0, 3).map((event) => <span className={`calendar-day-indicator calendar-day-indicator-${event.color}`} key={event.id} />)}{eventsForDay.length > 3 && <span className="calendar-day-count">+{eventsForDay.length - 3}</span>}</span>}</button>
            <div className="calendar-day-events">{eventsForDay.slice(0, 3).map(renderEvent)}{eventsForDay.length > 3 && <span className="calendar-more">+{eventsForDay.length - 3} más</span>}</div>
          </section>
        })}
      </div>
      <section className="calendar-agenda" aria-labelledby="calendar-agenda-title">
        <div className="calendar-agenda-heading"><h2 id="calendar-agenda-title">{selectedDayLabel}</h2><button ref={addEventButtonRef} type="button" className="calendar-agenda-add" onClick={() => resetForm(selectedDate)}><Plus size={15} />Añadir evento</button></div>
        {selectedDayEvents.length === 0 ? <EmptyState icon={Sun} title="Un día para respirar" description="Puedes dejarlo libre o añadir un plan con intención." compact /> : <div className="calendar-agenda-list">{selectedDayEvents.map((event) => <button className={`calendar-agenda-item calendar-event-${event.color}${event.status === 'completed' ? ' calendar-event-completed' : ''}`} key={event.id} type="button" onClick={() => editEvent(event)} aria-label={`Editar ${event.title}`}>
          <time>{event.allDay || !event.startAt || !event.timeZone ? 'Todo el día' : formatTime(event.startAt, timeZone)}</time><span><strong>{event.title}</strong><small>{event.category}{event.status === 'completed' ? ' · Completado' : event.status === 'cancelled' ? ' · Cancelado' : ''}</small>{areaForGoal(event.goalId, goals, areas) && <AreaTag name={areaForGoal(event.goalId, goals, areas)!.name} />}</span><ChevronRight size={16} aria-hidden="true" />
        </button>)}</div>}
      </section>
      </>}
    </>}

    <dialog ref={eventDialogRef} className="calendar-event-dialog" aria-label={editingEvent ? 'Editar evento' : 'Crear evento'} onCancel={(event) => { event.preventDefault(); closeForm() }} onClick={(event) => { if (event.target === event.currentTarget) closeForm() }}>
    {formOpen && <form className="calendar-event-form" onSubmit={submitEvent}>
      <div className="calendar-form-heading"><div><p className="setup-eyebrow">{editingEvent ? 'Actualizar' : 'Planifica'}</p><h2>{editingEvent ? 'Editar evento' : 'Nuevo evento'}</h2></div><button type="button" className="calendar-close" aria-label="Cerrar formulario" onClick={closeForm}><X size={17} /></button></div>
      {!editingEvent && <div className="calendar-presets"><span>¿Qué vas a planificar?</span><div>{eventPresets.map((preset) => <button key={preset.name} type="button" aria-pressed={category === preset.name} onClick={() => { setCategory(preset.name); setColor(preset.color); setAllDay(false) }}><span className={`color-swatch-dot color-swatch-${preset.color}`} aria-hidden="true" />{preset.name}</button>)}</div></div>}
      <label>Título<input autoFocus required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="¿Qué tienes en tu agenda?" /></label>
      <div className="calendar-form-row">
        <label>Tipo<select value={allDay ? 'all-day' : 'timed'} onChange={(event) => setAllDay(event.target.value === 'all-day')}><option value="all-day">Todo el día</option><option value="timed">Con hora</option></select></label>
        <label>Categoría<input required maxLength={40} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Personal, estudio…" /></label>
      </div>
      {allDay ? <div className="calendar-form-row">
        <label>Desde<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>Hasta<input type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      </div> : <>
        <label>Zona horaria del evento<input required maxLength={100} value={eventTimeZone} onChange={(event) => { setEventTimeZone(event.target.value); setStartOffset(null); setEndOffset(null) }} aria-describedby="calendar-time-zone-help" placeholder="America/La_Paz" /><span className="calendar-help" id="calendar-time-zone-help">Usa un identificador IANA, por ejemplo America/La_Paz.</span></label>
        <div className="calendar-form-row">
          <label>Empieza<input type="datetime-local" required value={startLocal} onChange={(event) => { setStartLocal(event.target.value); setStartOffset(null) }} /></label>
          <label>Termina<input type="datetime-local" required value={endLocal} onChange={(event) => { setEndLocal(event.target.value); setEndOffset(null) }} /></label>
        </div>
        {(startOptions.length > 1 || endOptions.length > 1) && <div className="calendar-form-row">
          {startOptions.length > 1 && <label>Desfase de inicio<select required value={startOffset ?? ''} onChange={(event) => setStartOffset(Number(event.target.value))}><option value="">Elige una hora</option>{startOptions.map((option) => <option key={option.instant} value={option.offsetMinutes}>{formatOffset(option.offsetMinutes)}</option>)}</select></label>}
          {endOptions.length > 1 && <label>Desfase de fin<select required value={endOffset ?? ''} onChange={(event) => setEndOffset(Number(event.target.value))}><option value="">Elige una hora</option>{endOptions.map((option) => <option key={option.instant} value={option.offsetMinutes}>{formatOffset(option.offsetMinutes)}</option>)}</select></label>}
        </div>}
        {startOptions.length === 0 && <p className="calendar-form-error" role="alert">La hora de inicio no existe en esa zona por un cambio de horario.</p>}
        {endOptions.length === 0 && <p className="calendar-form-error" role="alert">La hora final no existe en esa zona por un cambio de horario.</p>}
        {startOptions.length > 1 && selectedStartOffset === null && <p className="calendar-help" role="status">La hora de inicio ocurre dos veces; elige el desfase correcto.</p>}
        {endOptions.length > 1 && selectedEndOffset === null && <p className="calendar-help" role="status">La hora final ocurre dos veces; elige el desfase correcto.</p>}
      </>}
      <div className="calendar-form-row">
        <fieldset className="color-choice"><legend>Color</legend><div>{eventColors.map((option) => <button key={option.value} type="button" className="color-swatch-button" aria-label={`Color ${option.label}`} aria-pressed={color === option.value} title={option.label} onClick={() => setColor(option.value)}><span className={`color-swatch-dot color-swatch-${option.value}`} /></button>)}</div></fieldset>
        <label>Meta relacionada<select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">Sin meta</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
      </div>
      <label>Notas del evento<textarea maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      {datesInvalid && <p className="calendar-form-error" role="alert">La fecha final debe ser igual o posterior a la inicial.</p>}
      {timeInputInvalid && startOptions.length > 0 && endOptions.length > 0 && <p className="calendar-form-error" role="alert">Revisa la zona horaria y selecciona los desfases para horas ambiguas.</p>}
      <div className="calendar-form-actions">
        {editingEvent && <>
          {editingEvent.status !== 'completed' && <button className="calendar-secondary-action" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ path: `/events/${editingEvent.id}/complete`, successMessage: 'Evento completado.' })}><Check size={15} />Completar</button>}
          {editingEvent.status !== 'cancelled' && <button className="calendar-secondary-action" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ path: `/events/${editingEvent.id}/cancel`, successMessage: 'Evento cancelado.' })}>Cancelar evento</button>}
          <button className="calendar-secondary-action" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ path: `/events/${editingEvent.id}/archive`, successMessage: 'Evento archivado.' })}><Archive size={15} />Archivar</button>
        </>}
        <button className="calendar-save-button" type="submit" disabled={mutation.isPending || datesInvalid || timeInputInvalid}>{mutation.isPending ? 'Guardando…' : editingEvent ? 'Guardar cambios' : 'Guardar evento'}</button>
      </div>
    </form>}
    </dialog>

    <details className="calendar-archived">
      <summary>Eventos archivados ({archivedEvents.data?.length ?? 0})</summary>
      {archivedEvents.isLoading && <LoadingState compact label="Cargando eventos archivados…" />}
      {archivedEvents.error && <div className="archived-area-error" role="alert"><p>No se pudieron cargar los eventos archivados.</p><button className="area-action" type="button" onClick={() => { void archivedEvents.refetch() }}>Reintentar</button></div>}
      {!archivedEvents.isLoading && !archivedEvents.error && (archivedEvents.data ?? []).length === 0 && <p className="empty-message">No hay eventos archivados.</p>}
      {(archivedEvents.data ?? []).map((event) => <div className="archived-area-row" key={event.id}><span>{event.title}</span><button className="area-action" type="button" aria-label={`Restaurar ${event.title}`} disabled={mutation.isPending} onClick={() => mutation.mutate({ path: `/events/${event.id}/restore`, successMessage: 'Evento restaurado.' })}><RotateCcw size={14} />Restaurar</button></div>)}
    </details>
  </section>
}
