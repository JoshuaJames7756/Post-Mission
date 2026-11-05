import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare2, FileText, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import './quick-add.css'

type Request = <T>(path: string, options?: RequestInit) => Promise<T>
type Capture = { kind: 'task' | 'note'; title: string; content: string }
const emptyLinks = { goalIds: [], taskIds: [], eventIds: [], personIds: [], placeIds: [] }

export function QuickAdd({ userId, request, online, disabled = false }: { userId: string; request: Request; online: boolean; disabled?: boolean }) {
  const cache = useQueryClient()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'task' | 'note'>('task')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const mutation = useMutation({
    mutationFn: (capture: Capture) => request(capture.kind === 'task' ? '/tasks' : '/notes', { method: 'POST', body: JSON.stringify(capture.kind === 'task' ? { title: capture.title, priority: 'normal' } : { title: capture.title, content: capture.content, links: emptyLinks }) }),
    onSuccess: (_result, capture) => {
      void cache.invalidateQueries({ queryKey: [capture.kind === 'task' ? 'tasks' : 'notes', userId] })
      toast.success(capture.kind === 'task' ? 'Tarea añadida.' : 'Nota guardada.')
      setTitle(''); setContent(''); setOpen(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No pudimos guardar. Inténtalo de nuevo.'),
  })

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      titleInput.current?.focus()
    }
    if (!open && element.open) element.close()
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!online || !title.trim() || mutation.isPending) return
    mutation.mutate({ kind, title: title.trim(), content: content.trim() })
  }

  return <>
    <button className="quick-add-fab" type="button" aria-label="Captura rápida" title="Captura rápida" disabled={disabled} onClick={() => setOpen(true)}><Plus size={24} aria-hidden="true" /></button>
    <dialog ref={dialog} className="quick-add-sheet" aria-labelledby="quick-add-title" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="quick-add-heading"><div><p>Guarda lo que importa</p><h2 id="quick-add-title">Captura rápida</h2></div><button type="button" aria-label="Cerrar captura rápida" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="quick-add-types" role="group" aria-label="Tipo de captura"><button type="button" aria-pressed={kind === 'task'} disabled={mutation.isPending} onClick={() => { setKind('task'); titleInput.current?.focus() }}><CheckSquare2 size={17} />Tarea rápida</button><button type="button" aria-pressed={kind === 'note'} disabled={mutation.isPending} onClick={() => { setKind('note'); titleInput.current?.focus() }}><FileText size={17} />Nota o impresión</button></div>
      <form onSubmit={submit}><label>{kind === 'task' ? '¿Qué harás?' : 'Título de la nota'}<input ref={titleInput} required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'task' ? 'Un paso pequeño…' : 'Una idea para recordar…'} /></label>{kind === 'note' && <label>Tu impresión<textarea maxLength={20_000} rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escríbela aquí…" /></label>}{!online && <p className="quick-add-offline" role="status">Conéctate para guardar esta captura.</p>}<button className="quick-add-save" type="submit" disabled={!online || mutation.isPending}>{mutation.isPending ? 'Guardando…' : kind === 'task' ? 'Añadir tarea' : 'Guardar nota'}</button></form>
    </dialog>
  </>
}
