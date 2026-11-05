import { useEffect } from 'react'
import { useAuth } from '@clerk/react-router'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { dismissAppLaunch } from './launch-screen.js'

export function AppLaunchGate() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const fetching = useIsFetching()
  const cache = useQueryClient()

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn && (fetching > 0 || !cache.getQueryState(['profile', userId]))) return
    const frame = requestAnimationFrame(() => {
      if (!isSignedIn || cache.isFetching() === 0) dismissAppLaunch()
    })
    return () => cancelAnimationFrame(frame)
  }, [cache, fetching, isLoaded, isSignedIn, userId])

  return null
}
