import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import './empty-state.css'

export function EmptyState({ icon: Icon, title, description, children, compact = false }: { icon: LucideIcon; title: string; description: string; children?: ReactNode; compact?: boolean }) {
  return <div className={`warm-empty${compact ? ' warm-empty-compact' : ''}`} role="status">
    <span className="warm-empty-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.7} /></span>
    <strong>{title}</strong>
    <p>{description}</p>
    {children}
  </div>
}
