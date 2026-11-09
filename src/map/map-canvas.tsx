import { useEffect, useRef } from 'react'
import { openStreetMapStandard, type MapTileProvider } from './map-provider.js'

export type MapPoint = { id: string; name: string; latitude: number; longitude: number; type: string }

export function MapCanvas({ places, defaultCenter = [0, 0], defaultZoom = 2, focusPoint, userLocation, selectionActive = false, provider = openStreetMapStandard, onMarkerClick, onMapClick, onTileError }: {
  places: MapPoint[]
  defaultCenter?: [number, number]
  defaultZoom?: number
  focusPoint?: [number, number] | null
  userLocation?: [number, number] | null
  selectionActive?: boolean
  provider?: MapTileProvider
  onMarkerClick: (placeId: string) => void
  onMapClick: (latitude: number, longitude: number) => void
  onTileError: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const markerCallback = useRef(onMarkerClick)
  const mapCallback = useRef(onMapClick)
  const errorCallback = useRef(onTileError)
  const focusedPoint = useRef(focusPoint)
  const locationPoint = useRef(userLocation)
  const selectionEnabled = useRef(selectionActive)
  const mapInstance = useRef<import('leaflet').Map | null>(null)
  const userMarker = useRef<import('leaflet').CircleMarker | null>(null)
  useEffect(() => {
    markerCallback.current = onMarkerClick
    mapCallback.current = onMapClick
    errorCallback.current = onTileError
  }, [onMarkerClick, onMapClick, onTileError])

  useEffect(() => {
    focusedPoint.current = focusPoint
    if (focusPoint) mapInstance.current?.setView(focusPoint, 16)
  }, [focusPoint])

  useEffect(() => {
    locationPoint.current = userLocation
    const map = mapInstance.current
    if (!map || !userLocation) return
    if (userMarker.current) userMarker.current.setLatLng(userLocation)
    else {
      void import('leaflet').then((leaflet) => {
        if (mapInstance.current !== map) return
        userMarker.current = leaflet.circleMarker(userLocation, { radius: 8, color: '#fff', weight: 3, fillColor: '#245fba', fillOpacity: 1 }).addTo(map).bindTooltip('Tu ubicación aproximada')
      })
    }
  }, [userLocation])

  useEffect(() => { selectionEnabled.current = selectionActive }, [selectionActive])

  useEffect(() => {
    let disposed = false
    let map: import('leaflet').Map | undefined
    let draftMarker: import('leaflet').CircleMarker | undefined

    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([leaflet]) => {
      if (disposed || !host.current) return
      map = leaflet.map(host.current, { zoomControl: true, attributionControl: false })
      mapInstance.current = map
      userMarker.current = null
      if (locationPoint.current) userMarker.current = leaflet.circleMarker(locationPoint.current, { radius: 8, color: '#fff', weight: 3, fillColor: '#245fba', fillOpacity: 1 }).addTo(map).bindTooltip('Tu ubicación aproximada')
      leaflet.control.attribution({ position: 'topright', prefix: false }).addTo(map)
      leaflet.tileLayer(provider.tileUrl, { maxZoom: provider.maxZoom, attribution: provider.attribution }).addTo(map)
        .on('tileerror', () => errorCallback.current())
      const markers = places.map((place) => {
        const marker = leaflet.circleMarker([place.latitude, place.longitude], {
          radius: 8, color: '#263f37', weight: 2, fillColor: '#a8c4a8', fillOpacity: 0.95,
        }).addTo(map!)
        marker.bindTooltip(place.name, { direction: 'top', offset: [0, -7] })
        marker.on('click', () => markerCallback.current(place.id))
        return marker
      })
      if (focusedPoint.current) map.setView(focusedPoint.current, 16)
      else if (markers.length === 1 && markers[0]) map.setView(markers[0].getLatLng(), 13)
      else if (markers.length > 1) map.fitBounds(leaflet.featureGroup(markers).getBounds().pad(0.22), { maxZoom: 13 })
      else map.setView(defaultCenter, defaultZoom)
      map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
        if (!selectionEnabled.current) return
        const point: [number, number] = [event.latlng.lat, event.latlng.lng]
        if (draftMarker) draftMarker.setLatLng(point)
        else draftMarker = leaflet.circleMarker(point, { radius: 10, color: '#80582b', weight: 3, fillColor: '#e8bd78', fillOpacity: 1 }).addTo(map!).bindTooltip('Punto por guardar', { direction: 'top', offset: [0, -8] })
        mapCallback.current(event.latlng.lat, event.latlng.lng)
      })
      requestAnimationFrame(() => map?.invalidateSize())
    }).catch(() => errorCallback.current())

    return () => {
      disposed = true
      map?.remove()
      mapInstance.current = null
      userMarker.current = null
    }
  }, [places, provider, defaultCenter, defaultZoom])

  return <div className="map-canvas" ref={host} aria-label="Mapa interactivo de lugares guardados" role="application" />
}
