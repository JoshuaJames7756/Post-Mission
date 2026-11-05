import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react'
import { addCalendarDays, getCalendarDate } from './date-utils.js'
import './onboarding.css'

type Profile = { displayName: string; returnDate: string | null; journeyDisplayMode: 'elapsed' | 'days'; timezone: string; themePreference: 'system' | 'light' | 'dark'; onboardingCompletedAt: string | null }
type Area = { id: string; name: string }
type Goal = { id: string; title: string }
type Request = <T>(path: string, options?: RequestInit) => Promise<T>

const suggestedAreas = ['Familia', 'Amistades', 'Fe', 'Bienestar', 'Estudios', 'Trabajo']

export function OnboardingFlow({ profile, areas, goals, request, refresh }: {
  profile: Profile | null; areas: Area[]; goals: Goal[]; request: Request; refresh: () => Promise<void>
}) {
  const [step, setStep] = useState(() => !profile ? 0 : areas.length ? 3 : 1)
  const [name, setName] = useState(profile?.displayName ?? '')
  const [returnDate, setReturnDate] = useState(profile?.returnDate ?? '')
  const [displayMode, setDisplayMode] = useState<Profile['journeyDisplayMode']>(profile?.journeyDisplayMode ?? 'elapsed')
  const [areaName, setAreaName] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalSaved, setGoalSaved] = useState(goals.length > 0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const today = getCalendarDate(new Date(), profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/La_Paz')

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError('')
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Inténtalo de nuevo.') }
    finally { setPending(false) }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      await request('/me', { method: 'PATCH', body: JSON.stringify({ displayName: name.trim(), timezone: profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/La_Paz', themePreference: profile?.themePreference ?? 'system' }) })
      await refresh()
      setStep(1)
    })
  }

  function saveJourney(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      await request('/journey', { method: 'PATCH', body: JSON.stringify({ returnDate: returnDate || null, displayMode }) })
      await refresh()
      setStep(2)
    })
  }

  function saveArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!areaName.trim()) { setError('Elige o escribe un área para continuar.'); return }
    void run(async () => {
      await request('/life-areas', { method: 'POST', body: JSON.stringify({ name: areaName.trim() }) })
      await refresh()
      setStep(3)
    })
  }

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      if (goalTitle.trim() && !goalSaved) {
        await request('/goals', { method: 'POST', body: JSON.stringify({ title: goalTitle.trim(), periodType: 'month', startDate: today, targetDate: addCalendarDays(today, 30), lifeAreaId: areas[0]?.id ?? null }) })
        setGoalSaved(true)
        await refresh()
      }
      await request('/me/onboarding/complete', { method: 'POST' })
      await refresh()
    })
  }

  return <section className="onboarding" aria-labelledby="onboarding-title">
    <div className="onboarding-mark"><Compass size={22} /></div>
    <p className="setup-eyebrow">Tu espacio empieza aquí · {step + 1} de 4</p>
    <div className="onboarding-progress" aria-hidden="true">{[0, 1, 2, 3].map((index) => <span key={index} className={index <= step ? 'onboarding-progress-active' : ''} />)}</div>
    {step === 0 && <form onSubmit={saveProfile}>
      <h2 id="onboarding-title">Bienvenido a Post Mission.</h2>
      <p>Un lugar tranquilo para convertir lo que importa en pasos concretos. Empecemos por tu nombre.</p>
      <label htmlFor="onboarding-name">¿Cómo quieres que te llamemos?</label>
      <input id="onboarding-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoComplete="given-name" placeholder="Tu nombre" />
      <button className="onboarding-primary" disabled={pending}>Guardar y continuar <ArrowRight size={17} /></button>
    </form>}
    {step === 1 && <form onSubmit={saveJourney}>
      <h2 id="onboarding-title">Tu camino continúa.</h2>
      <p>Si quieres, guarda cuándo regresaste de tu misión. También puedes dejar la fecha vacía.</p>
      <label htmlFor="onboarding-return">Fecha de regreso <span>opcional</span></label>
      <input id="onboarding-return" type="date" max={today} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
      <label htmlFor="onboarding-mode">Mostrar Journey como</label>
      <select id="onboarding-mode" value={displayMode} onChange={(event) => setDisplayMode(event.target.value as Profile['journeyDisplayMode'])}><option value="elapsed">Tiempo transcurrido</option><option value="days">Días transcurridos</option></select>
      <div className="onboarding-actions"><button type="button" className="onboarding-back" onClick={() => setStep(0)} disabled={pending}><ArrowLeft size={16} /> Atrás</button><button className="onboarding-primary" disabled={pending}>Guardar y continuar <ArrowRight size={17} /></button></div>
    </form>}
    {step === 2 && <form onSubmit={saveArea}>
      <h2 id="onboarding-title">Elige un área de vida.</h2>
      <p>Empieza con una. Podrás añadir, editar y ordenar las demás desde Plan.</p>
      <div className="onboarding-suggestions" role="group" aria-label="Áreas sugeridas">{suggestedAreas.map((suggestion) => <button type="button" key={suggestion} aria-pressed={areaName === suggestion} onClick={() => setAreaName(suggestion)}>{suggestion}</button>)}</div>
      <label htmlFor="onboarding-area">O escribe la tuya</label>
      <input id="onboarding-area" value={areaName} onChange={(event) => setAreaName(event.target.value)} maxLength={60} placeholder="Por ejemplo: Comunidad" />
      <div className="onboarding-actions"><button type="button" className="onboarding-back" onClick={() => setStep(1)} disabled={pending}><ArrowLeft size={16} /> Atrás</button><button className="onboarding-primary" disabled={pending}>Guardar área <ArrowRight size={17} /></button></div>
    </form>}
    {step === 3 && <form onSubmit={finish}>
      <h2 id="onboarding-title">Listo para comenzar.</h2>
      <p>{goalSaved || goals.length ? 'Tu primera meta ya está guardada. Puedes seguir con el plan.' : 'Si tienes una primera meta en mente, escríbela. También puedes empezar sin ella.'}</p>
      {!goalSaved && goals.length === 0 && <><label htmlFor="onboarding-goal">Primera meta <span>opcional</span></label><input id="onboarding-goal" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} maxLength={120} placeholder="Por ejemplo: Cuidar mis amistades" /></>}
      <div className="onboarding-actions"><button type="button" className="onboarding-back" onClick={() => setStep(2)} disabled={pending}><ArrowLeft size={16} /> Atrás</button><button className="onboarding-primary" disabled={pending}>{pending ? 'Guardando…' : 'Entrar a mi espacio'} <ArrowRight size={17} /></button></div>
    </form>}
    {error && <p className="onboarding-error" role="alert">{error}</p>}
  </section>
}
