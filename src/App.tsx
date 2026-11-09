import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ClerkProvider, Show, SignIn, UserButton, useAuth, useClerk, useUser } from '@clerk/react-router'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { Archive, ArrowDown, ArrowRight, ArrowUp, CalendarDays, Check, Circle, Compass, House, LockKeyhole, Map as MapIcon, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Settings2, Smartphone, Sunrise, Users, WifiOff, X } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { getTodayFocusTasks } from './home.js'
import { moveDueAtToToday, pendingDayLabel } from './soft-rollover.js'
import { filterTasks, type TaskPriorityFilter } from './task-filters.js'
import { SectionBoundary } from './section-boundary.js'
import { GoalTree } from './goal-tree.js'
import { LoadingState } from './loading-state.js'
import { CalendarSkeleton, SkeletonRows } from './skeletons.js'
import { SectionTopbar } from './section-topbar.js'
import { EmptyState } from './empty-state.js'
import { QuickAdd } from './quick-add.js'
import { AreaTag } from './area-tag.js'
import { areaForGoal, areaTone } from './area-colors.js'
import { offerRemindersAfterFirstTask } from './push-permission.js'
import { retryAccountStatus } from './account-status-retry.js'
import { applyPendingTasks, readPendingTasks, upsertPendingTask, writePendingTasks, type PendingTask } from './task-sync-queue.js'
import { AppLaunchGate } from './app-launch.js'
import { OnboardingFlow } from './onboarding.js'
import type { AccountDeletionStatus } from './account-deletion.js'
import { addCalendarDays, getCalendarDate, isoDateTimeToLocalInput, localInputToIsoDateTime } from './date-utils.js'
import './App.css'
import './visual-refresh.css'
import './journey.css'
import './home-layout.css'
import './plan-layout.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const CalendarPage = lazy(() => import('./calendar-page.js').then((module) => ({ default: module.CalendarPage })))
const PeoplePage = lazy(() => import('./people-page.js').then((module) => ({ default: module.PeoplePage })))
const MapPage = lazy(() => import('./map-page.js').then((module) => ({ default: module.MapPage })))
const JourneyPage = lazy(() => import('./journey-page.js').then((module) => ({ default: module.JourneyPage })))
const NotesPage = lazy(() => import('./notes-page.js').then((module) => ({ default: module.NotesPage })))
const ReviewsPage = lazy(() => import('./reviews-page.js').then((module) => ({ default: module.ReviewsPage })))
const ArchivePage = lazy(() => import('./archive-page.js').then((module) => ({ default: module.ArchivePage })))
const AccountDeletionSettings = lazy(() => import('./account-deletion.js').then((module) => ({ default: module.AccountDeletionSettings })))
const AccountDeletionPendingScreen = lazy(() => import('./account-deletion.js').then((module) => ({ default: module.AccountDeletionPendingScreen })))
type Area = { id: string; name: string; icon: string | null }
type Goal = { id: string; title: string; periodType: 'year' | 'month' | 'week' | 'day'; startDate: string; targetDate: string; status: 'active' | 'completed'; lifeAreaId: string | null; parentGoalId: string | null }
type Task = { id: string; title: string; status: 'open' | 'completed'; priority: 'low' | 'normal' | 'high'; dueAt: string | null; completedAt: string | null; goalId: string | null }
type HomeEvent = { id: string; title: string; allDay: boolean; startDate: string | null; startAt: string | null; goalId: string | null; status: 'scheduled' | 'completed' | 'cancelled' }
type Profile = { displayName: string; purpose: string | null; returnDate: string | null; journeyDisplayMode: 'elapsed' | 'days'; timezone: string; themePreference: 'system' | 'light' | 'dark'; onboardingCompletedAt: string | null }
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: (attempt) => Math.min(500 * (attempt + 1), 1500), staleTime: 20_000 } } })

function AuthSetup() {
  return <main className="setup-page"><div className="setup-mark"><Compass size={21} strokeWidth={1.7} /></div><p className="setup-eyebrow">POST MISSION · ESPACIO PRIVADO</p><h1>The mission ended.<br /><em>Your purpose continues.</em></h1><p className="setup-copy">Tu espacio de planificación está en preparación. Configura la autenticación antes de mostrar información privada.</p><div className="setup-note"><LockKeyhole size={17} /><span>Los datos solo se cargarán cuando el servidor verifique tu cuenta.</span></div><p className="setup-footnote">Añade la clave pública de Clerk a <code>.env.local</code> y las claves privadas al archivo local del Worker.</p></main>
}

function SignInPage() {
  return <main className="sign-in-page"><div className="sign-in-copy"><div className="setup-mark"><Compass size={21} strokeWidth={1.7} /></div><p className="setup-eyebrow">POST MISSION</p><h1>Make room for<br /><em>what comes next.</em></h1><p className="setup-copy">Tu misión fue un capítulo. Este es un lugar para planear el siguiente con intención y a tu propio ritmo.</p></div><div className="sign-in-panel"><SignIn /></div></main>
}

async function apiRequest<T>(getToken: (options?: { skipCache?: boolean }) => Promise<string | null>, path: string, options: RequestInit = {}): Promise<T> {
  const send = (token: string | null) => fetch(`/api/v1${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  let token = await getToken()
  let response = await send(token)
  if (response.status === 401) {
    await new Promise<void>((resolve) => setTimeout(resolve, 600))
    const freshToken = await getToken({ skipCache: true })
    if (freshToken) {
      token = freshToken
      response = await send(token)
    }
  }
  const body = await response.json() as { data?: T; error?: { message?: string } }
  if (!response.ok) throw Object.assign(new Error(body.error?.message ?? 'No se pudo completar la solicitud.'), { status: response.status })
  return body.data as T
}

function priorityLabel(priority: Task['priority']) {
  return priority === 'high' ? 'Alta' : priority === 'low' ? 'Baja' : 'Normal'
}

function formatTaskDate(value: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es', { ...options, timeZone }).format(new Date(value))
}

function loadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
    return 'No pudimos conectar con tu espacio. Revisa tu conexión e inténtalo de nuevo.'
  }
  return error instanceof Error ? error.message : fallback
}

function isExpiredSession(error: unknown) {
  return error instanceof Error && 'status' in error && error.status === 401
}

function currentPlanSection() {
  return window.location.hash === '#goals' ? 'goals' : window.location.hash === '#areas' ? 'areas' : 'tasks'
}

function isReviewsHash() {
  return window.location.hash === '#reviews' || /^#reviews\/(daily|weekly)\/\d{4}-\d{2}-\d{2}$/.test(window.location.hash)
}

function PlanSectionNav({ activeSection }: { activeSection: 'tasks' | 'goals' | 'areas' }) {
  return <nav className="plan-shortcuts plan-section-nav" aria-label="Secciones del plan">
    <a href="#tasks" aria-current={activeSection === 'tasks' ? 'location' : undefined}>Tareas</a>
    <a href="#goals" aria-current={activeSection === 'goals' ? 'location' : undefined}>Metas</a>
    <a href="#areas" aria-current={activeSection === 'areas' ? 'location' : undefined}>Áreas</a>
  </nav>
}

function Workspace() {
  const { getToken, userId, isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [areaName, setAreaName] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalPeriod, setGoalPeriod] = useState<Goal['periodType']>('month')
  const [goalParent, setGoalParent] = useState('')
  const [goalArea, setGoalArea] = useState('')
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editingGoalTitle, setEditingGoalTitle] = useState('')
  const [editingGoalPeriod, setEditingGoalPeriod] = useState<Goal['periodType']>('month')
  const [editingGoalStartDate, setEditingGoalStartDate] = useState('')
  const [editingGoalTargetDate, setEditingGoalTargetDate] = useState('')
  const [editingGoalParent, setEditingGoalParent] = useState('')
  const [editingGoalArea, setEditingGoalArea] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskGoal, setTaskGoal] = useState('')
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('normal')
  const [taskDueAt, setTaskDueAt] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<TaskPriorityFilter>('all')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskTitle, setEditingTaskTitle] = useState('')
  const [editingTaskPriority, setEditingTaskPriority] = useState<Task['priority']>('normal')
  const [editingTaskDueAt, setEditingTaskDueAt] = useState('')
  const [editingTaskGoalId, setEditingTaskGoalId] = useState('')
  const [profileName, setProfileName] = useState('')
  const [editingPurpose, setEditingPurpose] = useState(false)
  const [purposeDraft, setPurposeDraft] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const settingsPanelRef = useRef<HTMLElement>(null)
  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    window.setTimeout(() => settingsTriggerRef.current?.focus(), 0)
  }, [])
  const trapSettingsFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return
    const panel = settingsPanelRef.current
    if (!panel) return
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden')
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (document.activeElement === panel || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault()
      const next = event.shiftKey ? last : first
      next.focus()
    }
  }
  const [settingsName, setSettingsName] = useState<string | null>(null)
  const [settingsTheme, setSettingsTheme] = useState<Profile['themePreference'] | null>(null)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')
  const [archivingAreaId, setArchivingAreaId] = useState<string | null>(null)
  const [planSection, setPlanSection] = useState<'tasks' | 'goals' | 'areas'>(currentPlanSection)
  const [view, setView] = useState<'home' | 'plan' | 'calendar' | 'people' | 'map' | 'journey' | 'notes' | 'reviews' | 'archive'>(() => window.location.hash === '#home' ? 'home' : window.location.hash === '#calendar' ? 'calendar' : window.location.hash === '#people' ? 'people' : window.location.hash === '#map' ? 'map' : window.location.hash === '#journey' ? 'journey' : window.location.hash === '#notes' ? 'notes' : isReviewsHash() ? 'reviews' : window.location.hash === '#archive' ? 'archive' : 'plan')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([])
  const pendingTasksRef = useRef<PendingTask[]>([])
  const syncingTasksRef = useRef(false)
  const syncBlockedRef = useRef(false)
  const syncUserRef = useRef(userId)
  const [syncVersion, setSyncVersion] = useState(0)
  const [celebratingTaskIds, setCelebratingTaskIds] = useState<string[]>([])
  const previousViewRef = useRef(view)
  useEffect(() => {
    if (!settingsOpen) return
    const previousBodyOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    settingsPanelRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeSettings() }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousRootOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [settingsOpen, closeSettings])
  useEffect(() => {
    const syncView = () => { setView(window.location.hash === '#home' ? 'home' : window.location.hash === '#calendar' ? 'calendar' : window.location.hash === '#people' ? 'people' : window.location.hash === '#map' ? 'map' : window.location.hash === '#journey' ? 'journey' : window.location.hash === '#notes' ? 'notes' : isReviewsHash() ? 'reviews' : window.location.hash === '#archive' ? 'archive' : 'plan'); setPlanSection(currentPlanSection()) }
    window.addEventListener('hashchange', syncView)
    return () => window.removeEventListener('hashchange', syncView)
  }, [])
  useEffect(() => {
    if (previousViewRef.current === view) return
    previousViewRef.current = view
    window.scrollTo(0, 0)
  }, [view])
  useEffect(() => { if (view === 'plan') window.scrollTo(0, 0) }, [planSection, view])
  const keys = useMemo(() => ({ areas: ['areas', userId], archivedAreas: ['archived-areas', userId], goals: ['goals', userId], archivedGoals: ['archived-goals', userId], tasks: ['tasks', userId], archivedTasks: ['archived-tasks', userId], profile: ['profile', userId] }), [userId])
  const authReady = isLoaded && isSignedIn && Boolean(userId)
  useEffect(() => {
    syncUserRef.current = userId
    const saved = readPendingTasks(userId ?? '')
    pendingTasksRef.current = saved
    let active = true
    queueMicrotask(() => { if (active) setPendingTasks(saved) })
    return () => { active = false }
  }, [userId])
  useEffect(() => {
    const update = () => { if (navigator.onLine) syncBlockedRef.current = false; setIsOnline(navigator.onLine) }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  const areas = useQuery({ queryKey: keys.areas, queryFn: () => apiRequest<Area[]>(getToken, '/life-areas'), enabled: authReady })
  const archivedAreas = useQuery({ queryKey: keys.archivedAreas, queryFn: () => apiRequest<Area[]>(getToken, '/life-areas?archived=true'), enabled: authReady })
  const goals = useQuery({ queryKey: keys.goals, queryFn: () => apiRequest<Goal[]>(getToken, '/goals'), enabled: authReady })
  const archivedGoals = useQuery({ queryKey: keys.archivedGoals, queryFn: () => apiRequest<Goal[]>(getToken, '/goals?archived=true'), enabled: authReady })
  const tasks = useQuery({ queryKey: keys.tasks, queryFn: () => apiRequest<Task[]>(getToken, '/tasks'), enabled: authReady })
  const archivedTasks = useQuery({ queryKey: keys.archivedTasks, queryFn: () => apiRequest<Task[]>(getToken, '/tasks?archived=true'), enabled: authReady })
  const profile = useQuery({ queryKey: keys.profile, queryFn: () => apiRequest<Profile | null>(getToken, '/me'), enabled: authReady })
  const accountDeletion = useQuery({ queryKey: ['account-deletion', userId], queryFn: () => apiRequest<AccountDeletionStatus>(getToken, '/account-deletion'), enabled: authReady, retry: retryAccountStatus, refetchOnMount: 'always' })
  const expiredSession = isExpiredSession(profile.error) || isExpiredSession(accountDeletion.error)
  useEffect(() => {
    if (authReady && expiredSession) void clerk.signOut({ redirectUrl: '/' }).catch(() => { /* The recovery button stays available if sign-out fails. */ })
  }, [authReady, clerk, expiredSession])
  useEffect(() => {
    if (!profile.data) return
    const preference = profile.data.themePreference
    try { localStorage.setItem('postmission:theme-preference', preference) } catch { /* The theme still works for this session. */ }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
      document.documentElement.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171c1a' : '#f4f0e8')
    }
    applyTheme()
    if (preference === 'system') media.addEventListener('change', applyTheme)
    return () => { if (preference === 'system') media.removeEventListener('change', applyTheme) }
  }, [profile.data])
  const mutation = useMutation({ mutationFn: ({ path, body, method = 'POST' }: { path: string; body?: unknown; method?: string }) => apiRequest(getToken, path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['areas', userId] }); void queryClient.invalidateQueries({ queryKey: ['archived-areas', userId] }); void queryClient.invalidateQueries({ queryKey: ['goals', userId] }); void queryClient.invalidateQueries({ queryKey: ['archived-goals', userId] }); void queryClient.invalidateQueries({ queryKey: ['tasks', userId] }); void queryClient.invalidateQueries({ queryKey: ['archived-tasks', userId] }); void queryClient.invalidateQueries({ queryKey: ['events', userId] }); void queryClient.invalidateQueries({ queryKey: ['profile', userId] }); toast.success('Cambios guardados.') }, onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo guardar.') })
  const rolloverMutation = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) => apiRequest<Task>(getToken, `/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ dueAt }) }),
    onMutate: async ({ id, dueAt }) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks })
      const previous = queryClient.getQueryData<Task[]>(keys.tasks)
      queryClient.setQueryData<Task[]>(keys.tasks, (current) => current?.map((task) => task.id === id ? { ...task, dueAt } : task))
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(keys.tasks, context.previous)
      toast.error(error instanceof Error ? error.message : 'No pudimos mover la tarea. Inténtalo de nuevo.')
    },
    onSuccess: () => toast.success('Tarea movida a hoy.'),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: keys.tasks }) },
  })
  const taskStatusMutation = useMutation({
    mutationFn: ({ id, status }: PendingTask) => apiRequest<Task>(getToken, `/tasks/${id}/${status === 'completed' ? 'complete' : 'reopen'}`, { method: 'POST' }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks })
      const previous = queryClient.getQueryData<Task[]>(keys.tasks)
      queryClient.setQueryData<Task[]>(keys.tasks, (current) => current && applyPendingTasks(current, [{ id, status }]))
      return { previous, queued: false }
    },
    onError: (error, variables, context) => {
      const networkError = !navigator.onLine || error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')
      if (networkError && userId) {
        const next = upsertPendingTask(pendingTasksRef.current, variables)
        if (writePendingTasks(userId, next)) {
          pendingTasksRef.current = next
          setPendingTasks(next)
          if (context) context.queued = true
          return
        }
      }
      if (context?.previous) queryClient.setQueryData(keys.tasks, context.previous)
      toast.error(error instanceof Error && !networkError ? error.message : 'No pudimos guardar este cambio. Inténtalo de nuevo.')
    },
    onSettled: (_data, _error, _variables, context) => { if (!context?.queued) void queryClient.invalidateQueries({ queryKey: keys.tasks }) },
  })
  const syncPendingTasks = useCallback(async () => {
    if (!userId || !navigator.onLine || syncingTasksRef.current || syncBlockedRef.current || pendingTasksRef.current.length === 0) return
    syncingTasksRef.current = true
    let synchronized = false
    let networkBlocked = false
    const batch = [...pendingTasksRef.current]
    try {
      for (const item of batch) {
        if (!navigator.onLine || syncUserRef.current !== userId) break
        try {
          await apiRequest(getToken, `/tasks/${item.id}/${item.status === 'completed' ? 'complete' : 'reopen'}`, { method: 'POST' })
          if (syncUserRef.current !== userId) break
          queryClient.setQueryData<Task[]>(['tasks', userId], (current) => current && applyPendingTasks(current, [item]))
          synchronized = true
        } catch (error) {
          const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined
          if (!navigator.onLine || error instanceof TypeError || (status !== 400 && status !== 404)) { networkBlocked = true; syncBlockedRef.current = true; break }
          toast.error(error instanceof Error ? error.message : 'No pudimos sincronizar una tarea.')
        }
        if (pendingTasksRef.current.some((pending) => pending.id === item.id && pending.status === item.status)) {
          const remaining = pendingTasksRef.current.filter((pending) => pending.id !== item.id)
          if (writePendingTasks(userId, remaining)) { pendingTasksRef.current = remaining; setPendingTasks(remaining) }
        }
      }
      if (synchronized) await queryClient.invalidateQueries({ queryKey: ['tasks', userId] })
    } finally {
      syncingTasksRef.current = false
      if (!networkBlocked && pendingTasksRef.current.some((item) => !batch.some((sent) => sent.id === item.id && sent.status === item.status))) setSyncVersion((value) => value + 1)
    }
  }, [getToken, queryClient, userId])
  useEffect(() => {
    if (isOnline && authReady && pendingTasks.length > 0 && celebratingTaskIds.length === 0) void syncPendingTasks()
  }, [authReady, celebratingTaskIds.length, isOnline, pendingTasks.length, syncPendingTasks, syncVersion])

  function submit(event: FormEvent<HTMLFormElement>, body: unknown, path: string, reset: () => void) {
    event.preventDefault()
    mutation.mutate({ path, body }, { onSuccess: reset })
  }
  function toggleTask(task: Task) {
    if (!userId) return
    if (navigator.onLine && pendingTasksRef.current.every((pending) => pending.id !== task.id)) {
      taskStatusMutation.mutate({ id: task.id, status: task.status === 'open' ? 'completed' : 'open' })
      if (task.status === 'open') {
        setCelebratingTaskIds((current) => [...current, task.id])
        window.setTimeout(() => setCelebratingTaskIds((current) => current.filter((id) => id !== task.id)), 260)
        offerRemindersAfterFirstTask(userId)
      }
      return
    }
    const next = upsertPendingTask(pendingTasksRef.current, { id: task.id, status: task.status === 'open' ? 'completed' : 'open' })
    if (!writePendingTasks(userId, next)) { toast.error('No pudimos guardar este cambio en el dispositivo.'); return }
    pendingTasksRef.current = next
    setPendingTasks(next)
    if (task.status === 'open') {
      setCelebratingTaskIds((current) => [...current, task.id])
      window.setTimeout(() => setCelebratingTaskIds((current) => current.filter((id) => id !== task.id)), 260)
      offerRemindersAfterFirstTask(userId)
    }
  }
  function savePurpose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile.data) return
    mutation.mutate({ path: '/me', method: 'PATCH', body: {
      displayName: profile.data.displayName,
      purpose: purposeDraft.trim() || null,
      timezone: profile.data.timezone,
      themePreference: profile.data.themePreference,
    } }, { onSuccess: () => setEditingPurpose(false) })
  }
  function startEditingTask(task: Task) {
    setEditingTaskId(task.id)
    setEditingTaskTitle(task.title)
    setEditingTaskPriority(task.priority)
    setEditingTaskDueAt(task.dueAt ? isoDateTimeToLocalInput(task.dueAt) : '')
    setEditingTaskGoalId(task.goalId ?? '')
  }
  function startEditingGoal(goalId: string) {
    const goal = (goals.data ?? []).find((item) => item.id === goalId)
    if (!goal) return
    setEditingGoal(goal)
    setEditingGoalTitle(goal.title)
    setEditingGoalPeriod(goal.periodType)
    setEditingGoalStartDate(goal.startDate)
    setEditingGoalTargetDate(goal.targetDate)
    setEditingGoalParent(goal.parentGoalId ?? '')
    setEditingGoalArea(goal.lifeAreaId ?? '')
  }
  async function shareOnPhone() {
    const url = `${window.location.origin}/#home`
    try {
      if (navigator.share) await navigator.share({ title: 'Post Mission', text: 'Continúa tu planificación en tu teléfono.', url })
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        toast.success('Enlace copiado. Ábrelo en tu teléfono.')
      } else toast.error('Este navegador no permite compartir ni copiar el enlace.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url)
          toast.success('Enlace copiado. Ábrelo en tu teléfono.')
          return
        } catch { /* Show the fallback error below. */ }
      }
      toast.error('No se pudo compartir el enlace desde este navegador.')
    }
  }
  function moveArea(areaId: string, direction: -1 | 1) {
    const orderedAreas = [...(areas.data ?? [])]
    const index = orderedAreas.findIndex((area) => area.id === areaId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= orderedAreas.length) return
    const selectedArea = orderedAreas[index]
    const adjacentArea = orderedAreas[target]
    if (!selectedArea || !adjacentArea) return
    orderedAreas[index] = adjacentArea
    orderedAreas[target] = selectedArea
    mutation.mutate({ path: '/life-areas/order', method: 'PATCH', body: { areaIds: orderedAreas.map((area) => area.id) } })
  }

  const activeGoals = (goals.data ?? []).filter((goal) => goal.status === 'active')
  const profileTimeZone = profile.data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz'
  const todayDate = getCalendarDate(new Date(), profileTimeZone)
  const taskPendingLabel = (task: Task) => task.status === 'open' ? pendingDayLabel(task.dueAt, todayDate, profileTimeZone) : null
  const moveTaskToToday = (task: Task) => rolloverMutation.mutate({ id: task.id, dueAt: moveDueAtToToday(new Date()) })
  const homeEvents = useQuery({ queryKey: ['events', userId, todayDate, todayDate, profileTimeZone], queryFn: () => apiRequest<HomeEvent[]>(getToken, `/events?${new URLSearchParams({ from: todayDate, to: todayDate, timeZone: profileTimeZone })}`), enabled: authReady && view === 'home' && Boolean(profile.data) })
  const completedGoals = (goals.data ?? []).filter((goal) => goal.status === 'completed')
  const visibleTasks = applyPendingTasks(tasks.data ?? [], pendingTasks.filter((item) => !celebratingTaskIds.includes(item.id)))
  const openTasks = visibleTasks.filter((task) => task.status === 'open')
  const visibleOpenTasks = filterTasks(openTasks, taskSearch, taskPriorityFilter)
  const taskFiltersActive = taskSearch.trim().length > 0 || taskPriorityFilter !== 'all'
  const focusEvents = (homeEvents.data ?? []).filter((event) => event.status === 'scheduled').sort((left, right) => Number(left.allDay) === Number(right.allDay) ? (left.startAt ?? '').localeCompare(right.startAt ?? '') : left.allDay ? -1 : 1).slice(0, 2)
  const focusTasks = getTodayFocusTasks(visibleTasks, todayDate, profileTimeZone, 4 - focusEvents.length)
  const settingsNameValue = settingsName ?? profile.data?.displayName ?? ''
  const settingsThemeValue = settingsTheme ?? profile.data?.themePreference ?? 'system'
  const busy = areas.isLoading || goals.isLoading || tasks.isLoading || profile.isLoading
  const failure = !isOnline && areas.data && goals.data && tasks.data && profile.data ? null : areas.error ?? goals.error ?? tasks.error ?? profile.error

  function renderTaskRow(task: Task, completed = false) {
    if (editingTaskId === task.id) return <form className="task-edit-form" key={task.id} onSubmit={(event) => {
      event.preventDefault()
      mutation.mutate({ path: `/tasks/${task.id}`, method: 'PATCH', body: { title: editingTaskTitle, priority: editingTaskPriority, dueAt: localInputToIsoDateTime(editingTaskDueAt), goalId: editingTaskGoalId || null } }, { onSuccess: () => setEditingTaskId(null) })
    }}>
      <input aria-label={`Título de ${task.title}`} value={editingTaskTitle} onChange={(event) => setEditingTaskTitle(event.target.value)} required maxLength={160} />
      <select aria-label={`Prioridad de ${task.title}`} value={editingTaskPriority} onChange={(event) => setEditingTaskPriority(event.target.value as Task['priority'])}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select>
      <input aria-label={`Fecha límite de ${task.title}`} type="datetime-local" value={editingTaskDueAt} onChange={(event) => setEditingTaskDueAt(event.target.value)} />
      <select aria-label={`Meta de ${task.title}`} value={editingTaskGoalId} onChange={(event) => setEditingTaskGoalId(event.target.value)}><option value="">Sin meta</option>{activeGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select>
      <div className="task-edit-actions"><button disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar'}</button><button type="button" onClick={() => setEditingTaskId(null)}>Cancelar</button></div>
    </form>
    const pendingLabel = taskPendingLabel(task)
    return <div className={`task-row${completed ? ' completed-row' : ''}${celebratingTaskIds.includes(task.id) ? ' task-row-celebrating' : ''}`} key={task.id}>
      {completed ? <Check size={18} /> : <button className="task-check" aria-label={`Completar ${task.title}`} onClick={() => toggleTask(task)} disabled={taskStatusMutation.isPending || celebratingTaskIds.includes(task.id)}>{celebratingTaskIds.includes(task.id) ? <Check size={19} /> : <Circle size={19} />}</button>}
      <div className="task-main"><span className="task-title">{task.title}</span><div className="task-meta"><span className={`task-priority task-priority-${task.priority}`}>Prioridad {priorityLabel(task.priority).toLowerCase()}</span>{task.dueAt && <time dateTime={task.dueAt} className={pendingLabel ? 'task-deadline-pending' : undefined}>{pendingLabel ? `${pendingLabel} · ` : ''}{formatTaskDate(task.dueAt, profileTimeZone, { day: 'numeric', month: 'short' })}</time>}</div></div>
      <div className="task-actions">{pendingLabel && <button className="task-rollover" type="button" aria-label={`Mover ${task.title} a hoy`} onClick={() => moveTaskToToday(task)} disabled={rolloverMutation.isPending || !isOnline || Boolean(accountDeletion.isError)}><RotateCcw size={15} aria-hidden="true" /><span>Mover a hoy</span></button>}
      <details className="task-menu area-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label={`Acciones de ${task.title}`} title="Acciones"><MoreHorizontal size={18} aria-hidden="true" /></summary><div className="area-menu-panel">{completed && <button type="button" onClick={(event) => { event.currentTarget.closest('details')!.open = false; toggleTask(task) }} disabled={taskStatusMutation.isPending}><RotateCcw size={15} aria-hidden="true" />Reabrir</button>}<button type="button" onClick={(event) => { event.currentTarget.closest('details')!.open = false; startEditingTask(task) }} disabled={mutation.isPending}><Pencil size={15} aria-hidden="true" />Editar</button><button type="button" className="area-menu-archive" onClick={(event) => { event.currentTarget.closest('details')!.open = false; mutation.mutate({ path: `/tasks/${task.id}/archive` }) }} disabled={mutation.isPending}><Archive size={15} aria-hidden="true" />Archivar</button></div></details></div>
    </div>
  }

  if (accountDeletion.data && accountDeletion.data.state !== 'none') return <Suspense fallback={<SkeletonRows label="cierre de cuenta" rows={2} />}><AccountDeletionPendingScreen userId={userId ?? ''} status={accountDeletion.data} /></Suspense>

  if (authReady && !profile.data?.onboardingCompletedAt) {
    const onboardingLoading = profile.isLoading || areas.isLoading || goals.isLoading || accountDeletion.isLoading
    const onboardingError = profile.error ?? areas.error ?? goals.error ?? accountDeletion.error
    if (onboardingLoading) return <main className="onboarding-shell onboarding-shell-status"><SkeletonRows label="tu bienvenida" rows={3} /></main>
    if (onboardingError) return <main className="onboarding-shell onboarding-shell-status"><div className="error-banner" role="alert"><p>{isExpiredSession(onboardingError) ? 'Tu sesión terminó. Vuelve a entrar para continuar.' : loadErrorMessage(onboardingError, 'No pudimos preparar tu bienvenida.')}</p><button type="button" onClick={() => { if (isExpiredSession(onboardingError)) void clerk.signOut({ redirectUrl: '/' }); else void queryClient.invalidateQueries() }}>{isExpiredSession(onboardingError) ? 'Volver a iniciar sesión' : 'Intentar de nuevo'}</button></div></main>
    return <OnboardingFlow profile={profile.data ?? null} areas={areas.data ?? []} goals={goals.data ?? []} request={(path, options) => apiRequest(getToken, path, options)} refresh={async () => { await queryClient.invalidateQueries() }} onComplete={() => { window.location.hash = '#home' }} />
  }

  return <main className="plan-page" id="plan">
    {(!isOnline || pendingTasks.length > 0) && <div className="connection-badge" role="status"><WifiOff size={14} aria-hidden="true" /><span>{!isOnline ? `Trabajando sin conexión${pendingTasks.length ? ` · ${pendingTasks.length} cambio${pendingTasks.length === 1 ? '' : 's'} pendiente${pendingTasks.length === 1 ? '' : 's'}` : ''}` : `${pendingTasks.length} cambio${pendingTasks.length === 1 ? '' : 's'} por sincronizar`}</span>{isOnline && pendingTasks.length > 0 && <button type="button" onClick={() => { syncBlockedRef.current = false; void syncPendingTasks() }}>Reintentar</button>}</div>}
    {accountDeletion.isError && <div className="error-banner" role="alert"><p>No pudimos comprobar el estado de tu cuenta. Tus datos siguen visibles; vuelve a intentar antes de guardar cambios.</p><button type="button" onClick={() => { void accountDeletion.refetch() }}>Reintentar</button></div>}
    {view === 'home' && <button ref={settingsTriggerRef} type="button" inert={settingsOpen} className={`settings-account-trigger${settingsOpen ? ' settings-account-trigger-open' : ''}`} aria-label="Cuenta y ajustes" title="Cuenta y ajustes" aria-expanded={settingsOpen} aria-controls="profile-settings" onClick={() => setSettingsOpen((open) => !open)}><Settings2 size={19} /><span className="settings-account-label">Cuenta</span></button>}
    {settingsOpen && <><button type="button" className="settings-backdrop" tabIndex={-1} aria-label="Cerrar ajustes" onClick={closeSettings} /><section ref={settingsPanelRef} tabIndex={-1} onKeyDown={trapSettingsFocus} className="settings-panel" id="profile-settings" aria-labelledby="settings-title" role="dialog" aria-modal="true"><div className="settings-heading"><div><p className="setup-eyebrow">Tu espacio</p><h2 id="settings-title">Ajustes y cuenta</h2></div><div className="settings-heading-actions"><span className="settings-panel-account"><UserButton /></span><button className="area-action" aria-label="Cerrar ajustes" onClick={closeSettings}><X size={16} /></button></div></div><form className="settings-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ path: '/me', method: 'PATCH', body: { displayName: settingsNameValue, timezone: profileTimeZone, themePreference: settingsThemeValue } }) }}><label htmlFor="settings-name">Nombre</label><input id="settings-name" value={settingsNameValue} onChange={(event) => setSettingsName(event.target.value)} required maxLength={80} /><label htmlFor="settings-theme">Tema</label><select id="settings-theme" value={settingsThemeValue} onChange={(event) => setSettingsTheme(event.target.value as Profile['themePreference'])}><option value="system">Usar el tema del dispositivo</option><option value="light">Claro</option><option value="dark">Oscuro</option></select><p className="settings-help">La preferencia se guarda en tu perfil.</p><button className="settings-save" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar cambios'}</button></form><Suspense fallback={<SkeletonRows label="ajustes de cuenta" rows={1} />}><AccountDeletionSettings userId={userId ?? ''} /></Suspense></section></>}
    <div className="app-view" key={view} inert={settingsOpen}>
    <SectionBoundary><Suspense fallback={view === 'calendar' ? <CalendarSkeleton view="day" /> : <SkeletonRows label={view === 'people' ? 'personas' : view === 'notes' ? 'notas' : view === 'journey' ? 'tu recorrido' : view === 'reviews' ? 'revisiones' : view === 'archive' ? 'archivo' : 'lugares'} rows={view === 'people' ? 4 : 3} />}>
    {view === 'calendar' && (profile.isLoading || goals.isLoading
      ? <CalendarSkeleton view="day" />
      : profile.error || goals.error
        ? <div className="error-banner" role="alert"><p>No pudimos preparar el calendario con tus preferencias y metas.</p><button onClick={() => { void profile.refetch(); void goals.refetch() }}>Intentar de nuevo</button></div>
        : profile.data === null
          ? <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />
          : <CalendarPage userId={userId ?? ''} timeZone={profile.data?.timezone || 'America/La_Paz'} goals={activeGoals} areas={areas.data ?? []} request={(path, options) => apiRequest(getToken, path, options)} />)}
    {view === 'people' && (profile.isLoading
      ? <SkeletonRows label="personas" rows={4} />
      : profile.error
        ? <div className="error-banner" role="alert"><p>No pudimos preparar tu espacio de personas.</p><button onClick={() => { void profile.refetch() }}>Intentar de nuevo</button></div>
        : profile.data === null
          ? <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />
          : <PeoplePage userId={userId ?? ''} timeZone={profile.data?.timezone || 'America/La_Paz'} request={(path, options) => apiRequest(getToken, path, options)} />)}
    {view === 'map' && (profile.isLoading
      ? <SkeletonRows label="lugares" rows={3} />
      : profile.error
        ? <div className="error-banner" role="alert"><p>No pudimos preparar tu mapa.</p><button onClick={() => { void profile.refetch() }}>Intentar de nuevo</button></div>
        : profile.data === null
          ? <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />
          : <MapPage userId={userId ?? ''} timeZone={profile.data?.timezone || 'America/La_Paz'} request={(path, options) => apiRequest(getToken, path, options)} />)}
    {view === 'journey' && (profile.isLoading
      ? <SkeletonRows label="tu recorrido" rows={3} />
      : profile.error
        ? <div className="error-banner" role="alert"><p>No pudimos preparar tu recorrido.</p><button onClick={() => { void profile.refetch() }}>Intentar de nuevo</button></div>
        : profile.data === null
          ? <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />
          : <JourneyPage userId={userId ?? ''} request={(path, options) => apiRequest(getToken, path, options)} />)}
    {view === 'notes' && (profile.isLoading
      ? <SkeletonRows label="notas" rows={3} />
      : profile.error
        ? <div className="error-banner" role="alert"><p>No pudimos preparar tus notas.</p><button onClick={() => { void profile.refetch() }}>Intentar de nuevo</button></div>
        : profile.data === null
          ? <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />
          : <NotesPage userId={userId ?? ''} request={(path, options) => apiRequest(getToken, path, options)} />)}
    {view === 'reviews' && (profile.isLoading
      ? <SkeletonRows label="revisiones" rows={4} />
      : profile.error
        ? <div className="error-banner" role="alert"><p>No pudimos preparar tus revisiones.</p><button onClick={() => { void profile.refetch() }}>Intentar de nuevo</button></div>
        : profile.data === null
          ? <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />
          : <ReviewsPage userId={userId ?? ''} timeZone={profile.data?.timezone || 'America/La_Paz'} request={(path, options) => apiRequest(getToken, path, options)} />)}
    {view === 'archive' && (profile.isLoading
      ? <SkeletonRows label="archivo" rows={4} />
      : profile.error
        ? <div className="error-banner" role="alert"><p>No pudimos preparar tu archivo.</p><button onClick={() => { void profile.refetch() }}>Intentar de nuevo</button></div>
        : profile.data === null
          ? <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />
          : <ArchivePage userId={userId ?? ''} timeZone={profile.data?.timezone || 'America/La_Paz'} request={(path, options) => apiRequest(getToken, path, options)} />)}
    {view === 'home' && <>
      <section className="plan-intro home-intro"><div className="home-greeting"><span className="home-avatar" aria-hidden="true">{user?.imageUrl ? <img src={user.imageUrl} alt="" /> : (profile.data?.displayName ?? user?.firstName ?? 'P').trim().charAt(0).toLocaleUpperCase()}</span><div><h1>{profile.data?.displayName ? `Hola, ${profile.data.displayName}.` : 'Un paso a la vez.'}</h1><p className="home-date">{new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: profileTimeZone }).format(new Date())}</p></div></div></section>
      {busy && <SkeletonRows label="tu inicio" rows={2} />}
      {failure && <div className="error-banner" role="alert"><p>{loadErrorMessage(failure, 'No se pudo cargar tu espacio.')}</p><button onClick={() => { void queryClient.invalidateQueries() }}>Intentar de nuevo</button></div>}
      {!busy && !failure && <>
        {profile.data && <section className="home-purpose" aria-labelledby="home-purpose-title">
          <div className="home-purpose-heading"><div><p className="setup-eyebrow">Tu dirección</p><h2 id="home-purpose-title">Mi propósito</h2></div>{!editingPurpose && <button type="button" onClick={() => { setPurposeDraft(profile.data?.purpose ?? ''); setEditingPurpose(true) }}>{profile.data.purpose ? 'Editar' : 'Añadir'}</button>}</div>
          {editingPurpose ? <form onSubmit={savePurpose}><label htmlFor="purpose-draft">¿Qué quieres cuidar en esta etapa?</label><textarea id="purpose-draft" value={purposeDraft} onChange={(event) => setPurposeDraft(event.target.value)} maxLength={500} rows={3} placeholder="Por ejemplo: cuidar mis relaciones y seguir aprendiendo." /><div className="home-purpose-actions"><button type="button" onClick={() => setEditingPurpose(false)}>Cancelar</button><button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar propósito'}</button></div></form> : <p className={profile.data.purpose ? 'home-purpose-text' : 'home-purpose-empty'}>{profile.data.purpose || 'Escribe una frase que te recuerde lo importante para ti.'}</p>}
        </section>}
        <section className="home-focus" aria-labelledby="home-focus-title">
          <div className="home-focus-heading"><div><h2 id="home-focus-title">Foco de hoy</h2><p>Tareas y eventos que merecen tu atención.</p></div><a href="#calendar">Ver agenda <ArrowRight size={15} /></a></div>
          {homeEvents.isLoading && <SkeletonRows label="eventos de hoy" rows={2} />}
          {homeEvents.isError && <div className="home-focus-error" role="status">No pudimos cargar los eventos. <button type="button" onClick={() => void homeEvents.refetch()}>Reintentar</button></div>}
          <div className="home-focus-list">
            {focusEvents.map((event) => { const area = areaForGoal(event.goalId, goals.data ?? [], areas.data ?? []); return <label className="home-focus-item" key={`event-${event.id}`}><input type="checkbox" checked={false} aria-label={`Completar evento ${event.title}`} disabled={mutation.isPending || Boolean(accountDeletion.isError)} onChange={() => mutation.mutate({ path: `/events/${event.id}/complete` })} /><span className="home-focus-copy"><span className="home-focus-titleline"><strong>{event.title}</strong>{area && <AreaTag name={area.name} />}</span><small>Evento · {event.allDay ? 'Todo el día' : event.startAt ? formatTaskDate(event.startAt, profileTimeZone, { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}</small></span></label> })}
            {focusTasks.map((task) => { const area = areaForGoal(task.goalId, goals.data ?? [], areas.data ?? []); const pendingLabel = taskPendingLabel(task); return <div className={`home-focus-item${celebratingTaskIds.includes(task.id) ? ' home-focus-item-celebrating' : ''}`} key={`task-${task.id}`}><label className="home-focus-task-control"><input type="checkbox" checked={celebratingTaskIds.includes(task.id)} aria-label={`Completar tarea ${task.title}`} disabled={taskStatusMutation.isPending || Boolean(accountDeletion.isError) || celebratingTaskIds.includes(task.id)} onChange={() => toggleTask(task)} /><span className="home-focus-copy"><span className="home-focus-titleline"><strong>{task.title}</strong>{area && <AreaTag name={area.name} />}</span><small className={pendingLabel ? 'task-deadline-pending' : undefined}>Tarea · {task.dueAt ? pendingLabel ?? `Para hoy, ${formatTaskDate(task.dueAt, profileTimeZone, { hour: '2-digit', minute: '2-digit' })}` : `Prioridad ${priorityLabel(task.priority).toLowerCase()}`}</small></span></label>{pendingLabel && <button className="home-rollover" type="button" aria-label={`Mover ${task.title} a hoy`} title="Mover a hoy" onClick={() => moveTaskToToday(task)} disabled={rolloverMutation.isPending || !isOnline || Boolean(accountDeletion.isError)}><RotateCcw size={15} aria-hidden="true" /><span className="home-rollover-label">Hoy</span></button>}</div> })}
            {!homeEvents.isLoading && !homeEvents.isError && focusEvents.length === 0 && focusTasks.length === 0 && <div className="home-focus-clear" role="status"><span className="home-focus-clear-icon" aria-hidden="true"><Sunrise size={21} strokeWidth={1.7} /></span><div><strong>Día despejado</strong><p>Nada urgente por ahora. Elige un paso pequeño cuando quieras.</p></div></div>}
          </div>
          <a className="home-focus-plan-link" href="#tasks">Ver todas las tareas <ArrowRight size={15} /></a>
        </section>
        {profile.data && <nav className="home-quick-grid" aria-label="Accesos rápidos"><a href="#journey"><Compass size={18} aria-hidden="true" /><span><strong>Journey</strong><small>Tu recorrido</small></span><ArrowRight size={15} aria-hidden="true" /></a><a href="#notes"><Pencil size={18} aria-hidden="true" /><span><strong>Notas</strong><small>Ideas y recuerdos</small></span><ArrowRight size={15} aria-hidden="true" /></a><a href="#reviews"><Check size={18} aria-hidden="true" /><span><strong>Revisiones</strong><small>Reflexiona</small></span><ArrowRight size={15} aria-hidden="true" /></a><a href="#goals"><Compass size={18} aria-hidden="true" /><span><strong>Metas</strong><small>{activeGoals.length} activas</small></span><ArrowRight size={15} aria-hidden="true" /></a></nav>}
        {profile.data && <a className="home-archive-link" href="#archive"><Archive size={15} /> Ver archivo <ArrowRight size={15} /></a>}
      </>}
    </>}
    {view === 'plan' && <>
    <SectionTopbar className="section-topbar-plan" title="Plan" icon={Compass} />
    <PlanSectionNav activeSection={planSection} />
    {busy && <SkeletonRows label="tu plan" rows={4} />}
    {failure && <div className="error-banner" role="alert"><p>{loadErrorMessage(failure, 'No se pudo cargar tu plan.')}</p><button onClick={() => { void queryClient.invalidateQueries() }}>Intentar de nuevo</button></div>}
    {!busy && !failure && <>
      {profile.data === null && <ProfileSetup profileName={profileName} setProfileName={setProfileName} mutation={mutation} />}
      <div className="plan-view">
        {planSection === 'tasks' &&
          <section className="plan-section" id="tasks"><div className="section-heading"><h2>Pendientes</h2><span className="count-mark">{openTasks.length}</span></div>
            <form className="quick-form plan-create-form" onSubmit={(event) => submit(event, { title: taskTitle, priority: taskPriority, dueAt: localInputToIsoDateTime(taskDueAt), ...(taskGoal ? { goalId: taskGoal } : {}) }, '/tasks', () => { setTaskTitle(''); setTaskGoal(''); setTaskPriority('normal'); setTaskDueAt('') })}>
              <input aria-label="Nueva tarea" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Añade el siguiente paso…" required maxLength={160} />
              <select aria-label="Meta relacionada" value={taskGoal} onChange={(event) => setTaskGoal(event.target.value)}><option value="">Sin meta</option>{activeGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select>
              <details className="task-create-details"><summary>Detalles</summary><div className="task-create-fields"><label>Prioridad<select aria-label="Prioridad de la nueva tarea" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Task['priority'])}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select></label><label>Fecha límite<input aria-label="Fecha límite de la nueva tarea" type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} /></label></div></details>
              <button aria-label="Añadir tarea" disabled={mutation.isPending}><Plus size={16} />Añadir tarea</button>
            </form>
            {openTasks.length > 0 && <div className="task-filters">
              <label className="task-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="Buscar tareas por nombre" placeholder="Buscar tareas…" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} /></label>
              <label className="task-priority-filter"><select aria-label="Filtrar tareas por prioridad" value={taskPriorityFilter} onChange={(event) => setTaskPriorityFilter(event.target.value as TaskPriorityFilter)}><option value="all">Toda prioridad</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baja</option></select></label>
              {taskFiltersActive && <button className="task-filter-reset" type="button" onClick={() => { setTaskSearch(''); setTaskPriorityFilter('all') }}>Limpiar</button>}
            </div>}
            <div className="task-list">{openTasks.length === 0 ? <EmptyState icon={Sunrise} title="Un buen momento para comenzar" description="Elige un paso pequeño para avanzar hoy." /> : visibleOpenTasks.length === 0 ? <p className="empty-message" role="status">No encontramos tareas con esos filtros.</p> : visibleOpenTasks.map((task) => renderTaskRow(task))}</div>
            {visibleTasks.some((task) => task.status === 'completed') && <details className="completed-details"><summary>Ver tareas completadas</summary>{visibleTasks.filter((task) => task.status === 'completed').map((task) => renderTaskRow(task, true))}</details>}
            <details className="archived-area-details">
              <summary>Tareas archivadas ({archivedTasks.data?.length ?? 0})</summary>
              {archivedTasks.isLoading && <LoadingState compact label="Cargando tareas archivadas…" />}
              {archivedTasks.error && <div className="archived-area-error" role="alert"><p>No pudimos cargar las tareas archivadas.</p><button className="area-action" onClick={() => { void archivedTasks.refetch() }}>Reintentar</button></div>}
              {!archivedTasks.isLoading && !archivedTasks.error && (archivedTasks.data ?? []).length === 0 && <p className="empty-message">No hay tareas archivadas.</p>}
              {(archivedTasks.data ?? []).map((task) => <div className="archived-area-row" key={task.id}><span>{task.title}</span><button className="area-action" aria-label={`Restaurar ${task.title}`} onClick={() => mutation.mutate({ path: `/tasks/${task.id}/restore` })} disabled={mutation.isPending}><RotateCcw size={14} />Restaurar</button></div>)}
            </details>
          </section>}
        {planSection === 'goals' &&
          <section className="plan-section" id="goals"><div className="section-heading"><div><h2>Metas en curso</h2><p>Las submetas aparecen bajo su meta superior.</p></div><span className="count-mark">{activeGoals.length}</span></div>
            <form className="goal-form plan-create-form" onSubmit={(event) => { const startDate = todayDate; const target = addCalendarDays(startDate, goalPeriod === 'year' ? 365 : goalPeriod === 'month' ? 30 : goalPeriod === 'week' ? 7 : 1); const parent = activeGoals.find((goal) => goal.id === goalParent); const targetDate = parent && parent.targetDate < target ? parent.targetDate : target; submit(event, { title: goalTitle, periodType: goalPeriod, startDate, targetDate, ...(goalParent ? { parentGoalId: goalParent } : {}), ...(goalArea ? { lifeAreaId: goalArea } : {}) }, '/goals', () => { setGoalTitle(''); setGoalParent(''); setGoalArea('') }) }}><input aria-label="Nueva meta" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="¿Qué quieres lograr?" required maxLength={120} /><select aria-label="Periodo de la meta" value={goalPeriod} onChange={(event) => { setGoalPeriod(event.target.value as Goal['periodType']); setGoalParent('') }}><option value="year">Este año</option><option value="month">Este mes</option><option value="week">Esta semana</option><option value="day">Hoy</option></select><select aria-label="Meta superior" value={goalParent} onChange={(event) => setGoalParent(event.target.value)}><option value="">Sin meta superior</option>{activeGoals.filter((goal) => ({ year: 'month', month: 'week', week: 'day' } as Record<string, string>)[goal.periodType] === goalPeriod).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><select aria-label="Área de vida" value={goalArea} onChange={(event) => setGoalArea(event.target.value)}><option value="">Sin área</option>{areas.data?.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><button disabled={mutation.isPending}><Plus size={16} />Añadir meta</button></form>
            {activeGoals.length === 0 ? <EmptyState icon={Compass} title="Tu próximo rumbo empieza aquí" description="Escribe una meta que quieras cuidar esta semana." /> : <GoalTree goals={activeGoals.map((goal) => ({ ...goal, hasChildren: (goals.data ?? []).some((candidate) => candidate.parentGoalId === goal.id) }))} todayDate={todayDate} pending={mutation.isPending} onComplete={(goalId) => mutation.mutate({ path: `/goals/${goalId}/complete` })} onArchive={(goalId) => mutation.mutate({ path: `/goals/${goalId}/archive` })} onEdit={startEditingGoal} />}
            {editingGoal && <form className="goal-form goal-edit-form" aria-label={`Editar meta ${editingGoal.title}`} onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate({ path: `/goals/${editingGoal.id}`, method: 'PATCH', body: { title: editingGoalTitle, periodType: editingGoalPeriod, startDate: editingGoalStartDate, targetDate: editingGoalTargetDate, parentGoalId: editingGoalParent || null, lifeAreaId: editingGoalArea || null } }, { onSuccess: () => setEditingGoal(null) })
            }}>
              <input aria-label="Título de la meta" value={editingGoalTitle} onChange={(event) => setEditingGoalTitle(event.target.value)} required maxLength={120} />
              <select aria-label="Periodo de la meta" value={editingGoalPeriod} onChange={(event) => { setEditingGoalPeriod(event.target.value as Goal['periodType']); setEditingGoalParent('') }}><option value="year">Este año</option><option value="month">Este mes</option><option value="week">Esta semana</option><option value="day">Hoy</option></select>
              <label>Inicio <input aria-label="Inicio de la meta" type="date" value={editingGoalStartDate} onChange={(event) => setEditingGoalStartDate(event.target.value)} required /></label>
              <label>Fecha objetivo <input aria-label="Fecha objetivo de la meta" type="date" value={editingGoalTargetDate} onChange={(event) => setEditingGoalTargetDate(event.target.value)} required /></label>
              <select aria-label="Meta superior" value={editingGoalParent} onChange={(event) => setEditingGoalParent(event.target.value)}><option value="">Sin meta superior</option>{(goals.data ?? []).filter((goal) => goal.id !== editingGoal.id && ({ year: 'month', month: 'week', week: 'day' } as Record<string, string>)[goal.periodType] === editingGoalPeriod && (goal.status === 'active' || goal.id === editingGoal.parentGoalId)).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select>
              <select aria-label="Área de vida" value={editingGoalArea} onChange={(event) => setEditingGoalArea(event.target.value)}><option value="">Sin área</option>{areas.data?.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
              <div className="task-edit-actions"><button disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar meta'}</button><button type="button" onClick={() => setEditingGoal(null)}>Cancelar</button></div>
            </form>}
            {completedGoals.length > 0 && <details className="completed-details"><summary>Metas completadas ({completedGoals.length})</summary>{completedGoals.map((goal) => {
              const hasChildren = (goals.data ?? []).some((candidate) => candidate.parentGoalId === goal.id)
              return <div className="archived-area-row completed-goal-row" key={goal.id}><span>{goal.title}</span><button className="area-action" aria-label={`Editar ${goal.title}`} onClick={() => startEditingGoal(goal.id)}><Pencil size={14} />Editar</button><button className="area-action" aria-label={`Reabrir ${goal.title}`} onClick={() => mutation.mutate({ path: `/goals/${goal.id}/reopen` })} disabled={mutation.isPending}><RotateCcw size={14} />Reabrir</button><button className="area-action" aria-label={`Archivar ${goal.title}`} title={hasChildren ? 'Archiva primero las submetas' : 'Archivar meta'} onClick={() => mutation.mutate({ path: `/goals/${goal.id}/archive` })} disabled={mutation.isPending || hasChildren}><Archive size={14} />Archivar</button></div>
            })}</details>}
            <details className="archived-area-details archived-goal-details">
              <summary>Metas archivadas ({archivedGoals.data?.length ?? 0})</summary>
              {archivedGoals.isLoading && <LoadingState compact label="Cargando metas archivadas…" />}
              {archivedGoals.error && <div className="archived-area-error" role="alert"><p>No pudimos cargar las metas archivadas.</p><button className="area-action" onClick={() => { void archivedGoals.refetch() }}>Reintentar</button></div>}
              {!archivedGoals.isLoading && !archivedGoals.error && (archivedGoals.data ?? []).length === 0 && <p className="empty-message">No hay metas archivadas.</p>}
              {(archivedGoals.data ?? []).map((goal) => <div className="archived-area-row" key={goal.id}><span>{goal.title}</span><button className="area-action" aria-label={`Restaurar ${goal.title}`} onClick={() => mutation.mutate({ path: `/goals/${goal.id}/restore` })} disabled={mutation.isPending}><RotateCcw size={14} />Restaurar</button></div>)}
            </details>
          </section>}
        {planSection === 'areas' &&
          <section className="plan-section" id="areas">
            <div className="section-heading"><div><h2>Áreas de vida</h2><p>Lo importante para ti, en conjunto.</p></div></div>
            <form className="area-form plan-create-form" onSubmit={(event) => submit(event, { name: areaName }, '/life-areas', () => setAreaName(''))}>
              <input aria-label="Nueva área" value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="Añadir un área" required maxLength={60} />
              <button aria-label="Añadir área" disabled={mutation.isPending}><Plus size={16} />Añadir área</button>
            </form>
            <ul className="area-list">
              {(areas.data ?? []).length === 0 ? <li className="empty-message">Añade las áreas que quieres cuidar.</li> : areas.data?.map((area, index) => (
                <li className="area-row" key={area.id}>
                  {editingAreaId === area.id ? (
                    <form className="area-edit-form" onSubmit={(event) => {
                      event.preventDefault()
                      mutation.mutate({ path: `/life-areas/${area.id}`, method: 'PATCH', body: { name: editingAreaName } }, { onSuccess: () => { setEditingAreaId(null); setEditingAreaName('') } })
                    }}>
                      <input aria-label={`Nombre del área ${area.name}`} value={editingAreaName} onChange={(event) => setEditingAreaName(event.target.value)} required maxLength={60} />
                      <button className="area-action" disabled={mutation.isPending}>Guardar</button>
                      <button className="area-action" type="button" aria-label={`Cancelar edición de ${area.name}`} onClick={() => { setEditingAreaId(null); setEditingAreaName('') }}><X size={15} /></button>
                    </form>
                  ) : <>
                    <span className={`area-dot area-dot-${areaTone(area.name)}`} aria-hidden="true" />
                    <span className="area-row-name">{area.name}</span>
                    <details className="area-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
                      <summary aria-label={`Acciones de ${area.name}`}><MoreHorizontal size={19} aria-hidden="true" /></summary>
                      <div className="area-menu-panel">
                        <button type="button" aria-label={`Editar ${area.name}`} onClick={(event) => { event.currentTarget.closest('details')!.open = false; setEditingAreaId(area.id); setEditingAreaName(area.name); setArchivingAreaId(null) }} disabled={mutation.isPending}><Pencil size={15} />Editar</button>
                        <button type="button" aria-label={`Mover arriba ${area.name}`} onClick={(event) => { event.currentTarget.closest('details')!.open = false; moveArea(area.id, -1) }} disabled={mutation.isPending || index === 0}><ArrowUp size={15} />Mover arriba</button>
                        <button type="button" aria-label={`Mover abajo ${area.name}`} onClick={(event) => { event.currentTarget.closest('details')!.open = false; moveArea(area.id, 1) }} disabled={mutation.isPending || index === (areas.data?.length ?? 0) - 1}><ArrowDown size={15} />Mover abajo</button>
                        <button className="area-menu-archive" type="button" aria-label={`Archivar ${area.name}`} onClick={(event) => { event.currentTarget.closest('details')!.open = false; setEditingAreaId(null); setArchivingAreaId(area.id) }} disabled={mutation.isPending}><Archive size={15} />Archivar</button>
                      </div>
                    </details>
                  </>}
                  {archivingAreaId === area.id && <div className="area-archive-confirm" role="group" aria-label={`Confirmar archivado de ${area.name}`}>
                    <span>Sus metas vinculadas se conservarán.</span>
                    <button className="area-action area-action-archive" onClick={() => mutation.mutate({ path: `/life-areas/${area.id}/archive` }, { onSuccess: () => setArchivingAreaId(null) })} disabled={mutation.isPending}>Archivar área</button>
                    <button className="area-action" onClick={() => setArchivingAreaId(null)}>Cancelar</button>
                  </div>}
                </li>
              ))}
            </ul>
            <details className="archived-area-details">
              <summary>Áreas archivadas ({archivedAreas.data?.length ?? 0})</summary>
              {archivedAreas.isLoading && <LoadingState compact label="Cargando áreas archivadas…" />}
              {archivedAreas.error && <div className="archived-area-error" role="alert"><p>No pudimos cargar las áreas archivadas.</p><button className="area-action" onClick={() => { void archivedAreas.refetch() }}>Reintentar</button></div>}
              {!archivedAreas.isLoading && !archivedAreas.error && (archivedAreas.data ?? []).length === 0 && <p className="empty-message">No hay áreas archivadas.</p>}
              {(archivedAreas.data ?? []).map((area) => <div className="archived-area-row" key={area.id}><span>{area.name}</span><button className="area-action" aria-label={`Restaurar ${area.name}`} onClick={() => mutation.mutate({ path: `/life-areas/${area.id}/restore` })} disabled={mutation.isPending}><RotateCcw size={14} />Restaurar</button></div>)}
            </details>
          </section>}
      </div>
    </>}
    </>}
    {import.meta.env.PROD && <aside className="desktop-phone-invite"><div className="phone-invite-icon"><Smartphone size={19} /></div><div><p className="setup-eyebrow">En tu teléfono</p><h2>Tu próximo paso cabe en el bolsillo.</h2><p>Comparte el enlace para abrir Post Mission desde tu teléfono.</p></div><button onClick={() => { void shareOnPhone() }}>Compartir enlace <ArrowRight size={15} /></button></aside>}
    </Suspense></SectionBoundary>
    </div>
    {profile.data?.onboardingCompletedAt && !settingsOpen && <QuickAdd userId={userId ?? ''} request={(path, options) => apiRequest(getToken, path, options)} online={isOnline} disabled={Boolean(accountDeletion.isError)} />}
    <nav className="app-navigation" inert={settingsOpen} aria-label="Navegación principal"><a href="#home" title="Inicio" aria-current={view === 'home' || view === 'journey' || view === 'notes' || view === 'reviews' || view === 'archive' ? 'page' : undefined} className={view === 'home' || view === 'journey' || view === 'notes' || view === 'reviews' || view === 'archive' ? 'app-nav-current' : ''}><House size={20} /><span>Inicio</span></a><a href="#plan" title="Plan" aria-current={view === 'plan' ? 'page' : undefined} className={view === 'plan' ? 'app-nav-current' : ''}><Compass size={20} /><span>Plan</span></a><a href="#calendar" title="Agenda" aria-current={view === 'calendar' ? 'page' : undefined} className={view === 'calendar' ? 'app-nav-current' : ''}><CalendarDays size={20} /><span>Agenda</span></a><a href="#people" title="Personas" aria-current={view === 'people' ? 'page' : undefined} className={view === 'people' ? 'app-nav-current' : ''}><Users size={20} /><span>Personas</span></a><a href="#map" title="Mapa" aria-current={view === 'map' ? 'page' : undefined} className={view === 'map' ? 'app-nav-current' : ''}><MapIcon size={20} /><span>Mapa</span></a></nav>
    <Toaster position="bottom-right" mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))', left: 16, right: 16 }} richColors />
  </main>
}

function ProfileSetup({ profileName, setProfileName, mutation }: { profileName: string; setProfileName: (name: string) => void; mutation: UseMutationResult<unknown, Error, { path: string; body?: unknown; method?: string }> }) {
  return <form className="profile-setup" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ path: '/me', method: 'PATCH', body: { displayName: profileName, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz', themePreference: 'system' } }, { onSuccess: () => setProfileName('') }) }}><label htmlFor="profile-name">¿Cómo quieres que te llamemos?</label><div><input id="profile-name" required maxLength={80} value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Tu nombre" /><button disabled={mutation.isPending}>Guardar perfil</button></div></form>
}

function App() {
  if (!publishableKey) return <AuthSetup />
  return <ClerkProvider publishableKey={publishableKey}><QueryClientProvider client={queryClient}><AppLaunchGate /><CachePrivacyGuard /><Show when="signed-in"><Workspace /></Show><Show when="signed-out"><SignInPage /></Show></QueryClientProvider></ClerkProvider>
}

function CachePrivacyGuard() {
  const { isLoaded, isSignedIn } = useAuth()
  const cache = useQueryClient()
  useEffect(() => { if (isLoaded && !isSignedIn) cache.removeQueries() }, [cache, isLoaded, isSignedIn])
  return null
}

export default App

