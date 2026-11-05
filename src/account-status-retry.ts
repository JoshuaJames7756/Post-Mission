export function retryAccountStatus(attempt: number, error: unknown) {
  if (attempt >= 2) return false
  if (error instanceof TypeError) return true
  return error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status >= 500
}
