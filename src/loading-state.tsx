import { LoaderCircle } from 'lucide-react'

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return <p className={`loading-state${compact ? ' loading-state-compact' : ''}`} role="status" aria-live="polite">
    <LoaderCircle className="loading-spinner" size={compact ? 15 : 18} aria-hidden="true" />
    <span>{label}</span>
  </p>
}
