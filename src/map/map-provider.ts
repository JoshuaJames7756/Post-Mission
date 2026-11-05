export type MapTileProvider = {
  id: string
  tileUrl: string
  attribution: string
  maxZoom: number
}

// OSM Standard tiles are user-initiated only. Keep this object injectable so a
// production tile provider can be substituted without changing place records.
export const openStreetMapStandard: MapTileProvider = {
  id: 'openstreetmap-standard',
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  maxZoom: 19,
}
