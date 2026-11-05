export function getLifeAreaOrderUpdates(currentIds: string[], requestedIds: string[]) {
  const current = new Set(currentIds)
  const requested = new Set(requestedIds)

  if (requestedIds.length !== currentIds.length || requested.size !== requestedIds.length) return null
  if (current.size !== currentIds.length || [...requested].some((id) => !current.has(id))) return null

  return requestedIds.map((id, sortOrder) => ({ id, sortOrder }))
}
