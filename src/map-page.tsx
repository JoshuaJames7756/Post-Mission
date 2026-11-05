import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowRight, List, Map as MapIcon, MapPin, MoreHorizontal, Pencil, RotateCcw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { addCalendarDays, getCalendarDate } from './date-utils.js'
import { LoadingState } from './loading-state.js'
import { SkeletonRows } from './skeletons.js'
import { SectionTopbar } from './section-topbar.js'
import { useDebouncedValue } from './use-debounced-value.js'
import { MapCanvas, type MapPoint } from './map/map-canvas.js'

type PlaceType = 'home' | 'church' | 'work' | 'school' | 'community' | 'other'
type Place = { id: string; name: string; type: PlaceType; address: string | null; latitude: number | null; longitude: number | null }
type EventSummary = { id: string; title: string; allDay: boolean; startDate: string | null; startAt: string | null; timeZone: string | null }
type Request = <T>(path: string, options?: RequestInit) => Promise<T>

const typeLabels: Record<PlaceType, string> = { home: 'Casa', church: 'Iglesia', work: 'Trabajo', school: 'Estudios', community: 'Comunidad', other: 'Otro' }
const emptyForm = { name: '', type: 'other' as PlaceType, address: '', latitude: '', longitude: '' }

export function MapPage({ userId, timeZone, request }: { userId: string; timeZone: string; request: Request }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const searchQuery = useDebouncedValue(search.trim())
  const [form, setForm] = useState(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlace, setEditingPlace] = useState<Place | null>(null)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [mapConsent, setMapConsent] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [mapAttempt, setMapAttempt] = useState(0)
  const [mapSelectionActive, setMapSelectionActive] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null)
  const [selectedEventIds, setSelectedEventIds] = useState<string[] | null>(null)
  const [mapCoordinateNotice, setMapCoordinateNotice] = useState(false)
  const from = getCalendarDate(new Date(), timeZone)
  const to = addCalendarDays(from, 89)
  const defaultMapCenter = useMemo<[number, number]>(() => timeZone === 'America/La_Paz' ? [-16.5, -68.15] : [0, 0], [timeZone])
  const placesQuery = useQuery({ queryKey: ['places', userId, searchQuery], queryFn: () => request<Place[]>(`/places${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`), placeholderData: (previous, query) => query?.queryKey[1] === userId ? previous : undefined })
  const searching = search.trim() !== searchQuery || (placesQuery.isFetching && !placesQuery.isLoading)
  const archivedQuery = useQuery({ queryKey: ['places-archived', userId], queryFn: () => request<Place[]>('/places?archived=true') })
  const eventsQuery = useQuery({ queryKey: ['place-events-options', userId, from, to], queryFn: () => request<EventSummary[]>(`/events?from=${from}&to=${to}&timeZone=${encodeURIComponent(timeZone)}`) })
  const linkedQuery = useQuery({ queryKey: ['place-linked-events', userId, expandedPlaceId], queryFn: () => request<EventSummary[]>(`/places/${expandedPlaceId}/events`), enabled: Boolean(expandedPlaceId) })
  const selectedIds = selectedEventIds ?? linkedQuery.data?.map((event) => event.id) ?? []

  const mutation = useMutation({
    mutationFn: ({ path, body, method = 'POST' }: { path: string; body?: unknown; method?: string }) => request<unknown>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['places', userId] }),
        queryClient.invalidateQueries({ queryKey: ['places-archived', userId] }),
        queryClient.invalidateQueries({ queryKey: ['place-linked-events', userId] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No pudimos guardar los cambios.'),
  })

  const mappedPlaces = useMemo<MapPoint[]>(() => (placesQuery.data ?? []).flatMap((place) =>
    place.latitude === null || place.longitude === null ? [] : [{ id: place.id, name: place.name, type: place.type, latitude: place.latitude, longitude: place.longitude }]), [placesQuery.data])
  const selectedPlace = placesQuery.data?.find((place) => place.id === selectedPlaceId)
  const focusPoint = useMemo<[number, number] | null>(() => selectedPlace?.latitude == null || selectedPlace.longitude == null ? null : [selectedPlace.latitude, selectedPlace.longitude], [selectedPlace])
  const archivePlace = async (place: Place) => {
    try {
      await mutation.mutateAsync({ path: `/places/${place.id}/archive` })
      setSelectedPlaceId((current) => current === place.id ? null : current)
      setExpandedPlaceId((current) => current === place.id ? null : current)
      toast.success(`${place.name}: lugar archivado.`, {
        duration: 8000,
        action: { label: 'Deshacer', onClick: () => {
          void mutation.mutateAsync({ path: `/places/${place.id}/restore` })
            .then(() => { toast.success('Lugar restaurado.') })
            .catch(() => { /* The mutation displays the recoverable error. */ })
        } },
      })
    } catch { /* The mutation displays the recoverable error. */ }
  }

  const submitPlace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const latitude = form.latitude.trim() ? Number(form.latitude) : null
    const longitude = form.longitude.trim() ? Number(form.longitude) : null
    if ((latitude === null) !== (longitude === null)) {
      toast.error('Indica latitud y longitud juntas, o deja ambas vacías.')
      return
    }
    const body = { name: form.name, type: form.type, address: form.address || null, latitude, longitude }
    const wasEditing = Boolean(editingPlace)
    mutation.mutate({ path: editingPlace ? `/places/${editingPlace.id}` : '/places', method: editingPlace ? 'PATCH' : 'POST', body }, {
      onSuccess: () => {
        setForm(emptyForm)
        setEditingPlace(null)
        setFormOpen(false)
        setMapSelectionActive(false)
        setMapCoordinateNotice(false)
        toast.success(wasEditing ? 'Lugar actualizado.' : 'Lugar guardado.')
      },
    })
  }

  const editPlace = (place: Place) => {
    setEditingPlace(place)
    setFormOpen(true)
    setForm({ name: place.name, type: place.type, address: place.address ?? '', latitude: place.latitude?.toString() ?? '', longitude: place.longitude?.toString() ?? '' })
    setMapCoordinateNotice(false)
    window.setTimeout(() => document.querySelector('.place-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const showPlaceCard = (place: Place) => {
    setView('list')
    setExpandedPlaceId(place.id)
    setSelectedEventIds(null)
    window.setTimeout(() => document.getElementById(`place-card-${place.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const handleMapClick = (latitude: number, longitude: number) => {
    if (!mapSelectionActive) return
    setSelectedPlaceId(null)
    setFormOpen(true)
    setForm((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }))
    setMapCoordinateNotice(true)
  }

  const openPointPicker = (place?: Place) => {
    if (place) editPlace(place)
    else setFormOpen(true)
    setView('map')
    setMapSelectionActive(true)
    setMapCoordinateNotice(false)
    window.setTimeout(() => document.querySelector('.map-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 0)
  }

  const startNewPlace = () => {
    setView('list')
    setEditingPlace(null)
    setForm(emptyForm)
    setMapSelectionActive(false)
    setMapCoordinateNotice(false)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingPlace(null)
    setForm(emptyForm)
    setMapSelectionActive(false)
    setMapCoordinateNotice(false)
  }

  const toggleEvent = (eventId: string) => setSelectedEventIds((current) => {
    const selected = current ?? linkedQuery.data?.map((event) => event.id) ?? []
    return selected.includes(eventId) ? selected.filter((id) => id !== eventId) : [...selected, eventId]
  })

  const locatePlace = (place: Place) => {
    if (place.latitude === null || place.longitude === null) {
      openPointPicker(place)
      return
    }
    setSelectedPlaceId(place.id)
    setView('map')
    window.setTimeout(() => document.getElementById('map-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
  }

  return <section className="map-page" aria-label="Mapa">
    <SectionTopbar className="section-topbar-map" title="Mapa" icon={MapIcon} actions={<button type="button" className="map-add-button" onClick={startNewPlace}><MapPin size={15} />Añadir lugar</button>} />
    <div className="map-mode-switch" role="group" aria-label="Vista de lugares"><button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} aria-hidden="true" />Lista</button><button type="button" aria-pressed={view === 'map'} onClick={() => { setMapError(false); setView('map') }}><MapIcon size={16} aria-hidden="true" />Mapa</button></div>
    {view === 'map' && <section className="map-panel" id="map-panel" aria-label="Mapa interactivo">
      {!mapConsent && <div className="map-privacy-notice"><p>La dirección es una referencia privada y no se convierte sola en un punto. Al cargar OpenStreetMap, el proveedor recibe solo la zona visible para entregar el mapa, no los nombres ni las direcciones guardados aquí.</p><button className="map-load-button" onClick={() => { setMapError(false); setMapConsent(true) }}>Cargar mapa de OpenStreetMap</button><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Licencia y privacidad</a></div>}
      {mapConsent && <>
        <div className="map-canvas-wrap">
        <MapCanvas key={mapAttempt} places={mappedPlaces} defaultCenter={defaultMapCenter} defaultZoom={timeZone === 'America/La_Paz' ? 12 : 2} focusPoint={focusPoint} selectionActive={mapSelectionActive} onMarkerClick={setSelectedPlaceId} onMapClick={handleMapClick} onTileError={() => setMapError(true)} />
        {selectedPlace && <div className="map-selected-place" role="region" aria-label={`Lugar seleccionado: ${selectedPlace.name}`}><div className="map-selected-info"><strong>{selectedPlace.name}</strong><span>{selectedPlace.address || typeLabels[selectedPlace.type]}</span></div><button type="button" className="map-selected-open" onClick={() => showPlaceCard(selectedPlace)}>Ver ficha <ArrowRight size={14} /></button><button type="button" className="map-selected-edit" aria-label={`Editar ${selectedPlace.name}`} onClick={() => editPlace(selectedPlace)}><Pencil size={14} /></button><button type="button" aria-label="Cerrar detalle del lugar" onClick={() => setSelectedPlaceId(null)}><X size={14} /></button></div>}
        </div>
        {mapError && <div className="map-tile-error" role="alert"><p>No pudimos cargar algunas imágenes del mapa. Tus lugares siguen disponibles.</p><div><button type="button" onClick={() => { setMapError(false); setMapAttempt((attempt) => attempt + 1) }}>Reintentar mapa</button><button type="button" onClick={() => setView('list')}>Ver lista</button></div></div>}
        {mapSelectionActive && <p className="map-click-help" role="status">{mapCoordinateNotice ? 'Punto seleccionado. Puedes tocar otro lugar para moverlo.' : 'Toca el punto exacto que quieres guardar.'}</p>}
        {mapCoordinateNotice && <p className="map-coordinate-status" role="status">Punto listo. <button type="button" onClick={() => document.querySelector('.place-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Volver al formulario y guardar</button></p>}
        {!mapSelectionActive && mappedPlaces.length > 0 && <p className="map-click-help">Elige “Marcar en mapa” en un lugar o edítalo para cambiar su punto.</p>}
      </>}
    </section>}

    {formOpen && <form className="place-form" onSubmit={submitPlace} aria-label={editingPlace ? 'Editar lugar' : 'Añadir lugar'}>
      <div className="place-form-heading"><div><p className="setup-eyebrow">{editingPlace ? 'Actualizar' : 'Nuevo lugar'}</p><h2>{editingPlace ? 'Editar lugar' : 'Añade un lugar importante'}</h2></div><button type="button" className="place-icon-action" aria-label="Cerrar formulario" onClick={closeForm}><X size={16} /></button></div>
      <div className="place-form-grid">
        <label>Nombre<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Por ejemplo, mi comunidad" /></label>
        <label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PlaceType })}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="place-address-field">Dirección <span>(solo referencia; no se convierte en punto automáticamente)</span><input maxLength={240} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Dirección o referencia" /></label>
        <div className="place-point-picker"><button type="button" className="place-pick-point" onClick={() => openPointPicker()}><MapPin size={15} />{form.latitude && form.longitude ? 'Cambiar punto en el mapa' : 'Elegir punto en el mapa'}</button><p>{form.latitude && form.longitude ? 'Ya seleccionaste un punto. Puedes moverlo en el mapa.' : 'Abre el mapa, toca tu ubicación y luego guarda el lugar.'}</p></div>
        <details className="place-manual-coordinates"><summary>Introducir coordenadas manualmente</summary><div className="place-coordinate-fields"><label>Latitud <span>(opcional)</span><input type="number" step="any" min="-90" max="90" inputMode="decimal" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="-16.5000" /></label><label>Longitud <span>(opcional)</span><input type="number" step="any" min="-180" max="180" inputMode="decimal" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="-68.1500" /></label></div></details>
      </div>
      <button className="place-save" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : editingPlace ? 'Guardar cambios' : 'Guardar lugar'}</button>
    </form>}

    {view === 'list' && <div className="places-list-view"><div className="places-toolbar"><div><h2>Lugares guardados</h2></div><label className="places-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Buscar lugares" placeholder="Buscar por nombre, dirección o tipo…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    <p className="search-feedback" role="status">{searching ? "Buscando lugares…" : ""}</p>
    {placesQuery.isLoading && <SkeletonRows label="lugares" rows={3} />}
    {placesQuery.error && <div className="error-banner" role="alert"><p>No pudimos cargar tus lugares.</p><button onClick={() => { void placesQuery.refetch() }}>Reintentar</button></div>}
    {!searching && !placesQuery.isLoading && !placesQuery.error && (placesQuery.data?.length ?? 0) === 0 && <p className="places-empty">{search.trim() ? 'No encontramos lugares con esa búsqueda.' : 'Aún no has guardado lugares. Puedes añadir uno sin dirección ni coordenadas.'}</p>}
    <div className="places-grid" aria-busy={searching}>{placesQuery.data?.map((place) => <article className={`place-card${place.id === selectedPlaceId ? ' place-card-selected' : ''}`} id={`place-card-${place.id}`} key={place.id}>
      <div className="place-card-head"><button type="button" className="place-card-main" aria-label={`${place.name}, ${place.latitude !== null && place.longitude !== null ? 'ver en mapa' : 'marcar en mapa'}`} onClick={() => locatePlace(place)}><span className="place-symbol"><MapPin size={17} aria-hidden="true" /></span><span className="place-card-identity"><strong role="heading" aria-level={3}>{place.name}</strong><span>{typeLabels[place.type]}{place.latitude === null || place.longitude === null ? ' · Sin punto' : ''}</span>{place.address && <span className="place-address">{place.address}</span>}</span><ArrowRight size={15} aria-hidden="true" /></button><details className="place-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label={`Acciones de ${place.name}`} title="Acciones"><MoreHorizontal size={18} aria-hidden="true" /></summary><div className="place-menu-popover"><button type="button" aria-label={`Editar ${place.name}`} onClick={(event) => { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; editPlace(place) }}><Pencil size={15} aria-hidden="true" />Editar</button><button type="button" aria-label={`Archivar ${place.name}`} disabled={mutation.isPending} onClick={(event) => { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; void archivePlace(place) }}><Archive size={15} aria-hidden="true" />Archivar</button></div></details></div>
      <div className="place-card-actions"><button className="place-link-toggle" aria-expanded={expandedPlaceId === place.id} onClick={() => { setExpandedPlaceId((current) => current === place.id ? null : place.id); setSelectedEventIds(null) }}>Eventos</button></div>
      {expandedPlaceId === place.id && <div className="place-event-links"><h4>Eventos próximos</h4>{eventsQuery.isLoading || linkedQuery.isLoading ? <LoadingState compact label="Cargando eventos…" /> : eventsQuery.error || linkedQuery.error ? <p role="alert">No pudimos cargar los eventos. <button onClick={() => { void eventsQuery.refetch(); void linkedQuery.refetch() }}>Reintentar</button></p> : (eventsQuery.data ?? []).length === 0 ? <p>No hay eventos en los próximos 90 días.</p> : <div className="place-event-options">{eventsQuery.data?.map((event) => <label key={event.id}><input type="checkbox" checked={selectedIds.includes(event.id)} onChange={() => toggleEvent(event.id)} /><span>{event.title}</span><small>{event.allDay && event.startDate ? event.startDate : event.startAt ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: event.timeZone ?? timeZone }).format(new Date(event.startAt)) : ''}</small></label>)}</div>}<button className="place-save place-events-save" onClick={() => mutation.mutate({ path: `/places/${place.id}/events`, method: 'PUT', body: { eventIds: selectedIds } })} disabled={mutation.isPending || linkedQuery.isLoading || Boolean(linkedQuery.error) || Boolean(eventsQuery.error)}>Guardar eventos</button></div>}
    </article>)}</div>

    <details className="places-archived"><summary>Lugares archivados ({archivedQuery.data?.length ?? 0})</summary>{archivedQuery.isLoading && <LoadingState compact label="Cargando archivo…" />}{archivedQuery.error && <div className="error-banner" role="alert"><p>No pudimos cargar el archivo.</p><button onClick={() => { void archivedQuery.refetch() }}>Reintentar</button></div>}{!archivedQuery.isLoading && !archivedQuery.error && (archivedQuery.data?.length ?? 0) === 0 && <p className="empty-message">No hay lugares archivados.</p>}{archivedQuery.data?.map((place) => <div className="places-archived-row" key={place.id}><span>{place.name}</span><button className="place-link-toggle" onClick={() => mutation.mutate({ path: `/places/${place.id}/restore` })} disabled={mutation.isPending}><RotateCcw size={14} />Restaurar</button></div>)}</details></div>}
  </section>
}
