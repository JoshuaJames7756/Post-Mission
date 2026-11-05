import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function SectionTopbar({ title, icon: Icon, actions, className }: { title: string; icon: LucideIcon; actions?: ReactNode; className?: string }) {
  return <header className={`section-topbar${className ? ` ${className}` : ''}`}>
    <span className="section-topbar-spacer" aria-hidden="true" />
    <div className="section-topbar-heading"><span className="section-topbar-icon" aria-hidden="true"><Icon size={18} strokeWidth={2} /></span><h1>{title}</h1></div>
    <div className="section-topbar-actions">{actions}</div>
  </header>
}
