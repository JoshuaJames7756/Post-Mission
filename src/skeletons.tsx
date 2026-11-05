export function SkeletonRows({ label, rows = 3 }: { label: string; rows?: number }) {
  return <div className="skeleton-rows" role="status" aria-label={`Cargando ${label}`} aria-busy="true">
    <span className="visually-hidden">Cargando {label}</span>
    {Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index} aria-hidden="true">
      <span className="skeleton-shape skeleton-avatar" />
      <span className="skeleton-copy"><span className="skeleton-shape skeleton-line skeleton-line-primary" /><span className="skeleton-shape skeleton-line skeleton-line-secondary" /></span>
      <span className="skeleton-shape skeleton-action" />
    </div>)}
  </div>
}

export function CalendarSkeleton({ view }: { view: 'day' | 'month' }) {
  if (view === 'month') return <div className="calendar-skeleton calendar-skeleton-month" role="status" aria-label="Cargando agenda" aria-busy="true">
    <span className="visually-hidden">Cargando agenda</span>
    {Array.from({ length: 35 }, (_, index) => <span className="skeleton-shape" key={index} aria-hidden="true" />)}
  </div>
  return <div className="calendar-skeleton" role="status" aria-label="Cargando agenda" aria-busy="true">
    <span className="visually-hidden">Cargando agenda</span>
    <div className="calendar-skeleton-days" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <span className="skeleton-shape" key={index} />)}</div>
    <div className="calendar-skeleton-title skeleton-shape" aria-hidden="true" />
    <div className="calendar-skeleton-timeline" aria-hidden="true">
      <div className="calendar-skeleton-hours">{Array.from({ length: 5 }, (_, index) => <span className="skeleton-shape" key={index} />)}</div>
      <div className="calendar-skeleton-lines">{Array.from({ length: 5 }, (_, index) => <span className="skeleton-shape" key={index} />)}</div>
    </div>
  </div>
}
