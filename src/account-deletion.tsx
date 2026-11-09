import { useEffect, useState, type FormEvent } from 'react'
import { useAuth, useClerk, useReverification } from '@clerk/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import './account-deletion.css'

export type AccountDeletionStatus = { state: 'none' | 'requested' | 'data_deleted'; nextAttemptAt?: string }
type DeletionReply = { data?: { state: AccountDeletionStatus['state'] | 'complete' }; error?: { message?: string } }

function useDeletionAction(userId: string) {
  const { getToken } = useAuth()
  const clerk = useClerk()
  const cache = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const send = useReverification(async () => {
    const token = await getToken()
    const response = await fetch('/api/v1/account-deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ confirmation: 'BORRAR MI CUENTA' }),
    })
    return response.json() as Promise<DeletionReply>
  })

  async function run() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const body = await send()
      if (!body) return
      if (body.error || !body.data) throw new Error(body.error?.message ?? 'No se pudo iniciar la eliminación.')
      if (body.data?.state === 'complete') {
        cache.clear()
        await clerk.signOut({ redirectUrl: '/' })
      } else {
        await cache.invalidateQueries({ queryKey: ['account-deletion', userId] })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos confirmar el estado. Inténtalo de nuevo.')
      await cache.invalidateQueries({ queryKey: ['account-deletion', userId] })
    } finally { setPending(false) }
  }
  return { run, pending, error }
}

export function AccountDeletionSettings({ userId }: { userId: string }) {
  const [phrase, setPhrase] = useState('')
  const action = useDeletionAction(userId)
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (phrase === 'BORRAR MI CUENTA') void action.run() }
  return <details className="account-deletion-settings">
    <summary>Eliminar cuenta y datos</summary>
    <div className="account-deletion-content">
      <p>Esta acción elimina permanentemente tus metas, tareas, eventos, personas, lugares, notas, revisiones y tu identidad de acceso. No hay periodo de recuperación.</p>
      <p>Si un servicio falla, el proceso seguirá pendiente y se reintentará. No se mostrará como terminado hasta completar los pasos esenciales.</p>
      <form onSubmit={submit}>
        <label htmlFor="delete-confirmation">Escribe <strong>BORRAR MI CUENTA</strong> para confirmar</label>
        <input id="delete-confirmation" value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" spellCheck={false} />
        <button type="submit" disabled={action.pending || phrase !== 'BORRAR MI CUENTA'}>{action.pending ? 'Procesando…' : 'Eliminar mi cuenta definitivamente'}</button>
      </form>
      {action.error && <p className="account-deletion-error" role="alert">{action.error}</p>}
    </div>
  </details>
}

export function AccountDeletionPendingScreen({ userId, status }: { userId: string; status: AccountDeletionStatus }) {
  const action = useDeletionAction(userId)
  const { getToken } = useAuth()
  const clerk = useClerk()
  const cache = useQueryClient()
  useEffect(() => {
    let active = true
    async function checkCompletion() {
      try {
        const token = await getToken({ skipCache: true })
        if (!token || !active) return
        const response = await fetch('/api/v1/account-deletion', { headers: { Authorization: `Bearer ${token}` } })
        if (!active) return
        const completed = response.status === 401 || (response.ok && (await response.json() as { data?: AccountDeletionStatus }).data?.state === 'none')
        if (completed && active) {
          cache.clear()
          await clerk.signOut({ redirectUrl: '/' })
        }
      } catch { /* Keep the pending state; the next check can recover from a network error. */ }
    }
    const interval = window.setInterval(() => { void checkCompletion() }, 30_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [cache, clerk, getToken])
  return <main className="account-deletion-pending">
    <div className="account-deletion-pending-mark"><AlertTriangle size={24} /></div>
    <h1>El cierre de tu cuenta sigue en curso.</h1>
    <p>{status.state === 'requested' ? 'Aún estamos retirando tus datos. No puedes guardar cambios mientras se completa esta etapa.' : 'Tus datos de Post Mission ya se retiraron. Falta cerrar tu acceso y verificar la limpieza final.'}</p>
    <p>El sistema reintentará el paso pendiente automáticamente. También puedes intentarlo ahora.</p>
    <button type="button" onClick={() => { void action.run() }} disabled={action.pending}><RotateCcw size={16} />{action.pending ? 'Reintentando…' : 'Reintentar ahora'}</button>
    {action.error && <p className="account-deletion-error" role="alert">{action.error}</p>}
  </main>
}
