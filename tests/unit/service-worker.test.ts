import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

type SwEvent = { waitUntil?: (work: Promise<unknown>) => void; respondWith?: (work: Promise<Response>) => void; request?: Request; data?: { json: () => unknown }; notification?: { data?: { destination?: string }; close: () => void } }

function createWorker() {
  const listeners = new Map<string, (event: SwEvent) => void>()
  const cache = { addAll: vi.fn(async () => {}), put: vi.fn(async () => {}), match: vi.fn(async () => undefined as Response | undefined) }
  const caches = { open: vi.fn(async () => cache), match: vi.fn(async () => undefined as Response | undefined), keys: vi.fn(async () => [] as string[]), delete: vi.fn(async () => true) }
  const fetch = vi.fn<(request: string | Request) => Promise<Response>>()
  const self = { location: { origin: 'https://app.example' }, addEventListener: (type: string, callback: (event: SwEvent) => void) => listeners.set(type, callback), skipWaiting: vi.fn(async () => {}), registration: { showNotification: vi.fn(async () => {}) }, clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => [] as Array<{ url: string; navigate?: (url: string) => Promise<void>; focus: () => Promise<void> }>), openWindow: vi.fn(async () => {}) } }
  runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, caches, fetch, URL, Response, Request, Promise, Set, Error })
  return { listeners, cache, caches, fetch, self }
}

describe('PWA public cache', () => {
  it('pre-caches the actual Vite entry script, stylesheet and preload with the shell', async () => {
    const worker = createWorker()
    worker.fetch.mockResolvedValue(new Response('<script src="/assets/index--TaMT7jN.js"></script><link href="/assets/rolldown-runtime-CbXtAM7H.js"><link href="/assets/index-C0Fb5Kzn.css">'))
    let work: Promise<unknown> | undefined
    worker.listeners.get('install')?.({ waitUntil: (value) => { work = value } })
    await work

    expect(worker.cache.addAll).toHaveBeenCalledWith(expect.arrayContaining([
      '/assets/index--TaMT7jN.js', '/assets/rolldown-runtime-CbXtAM7H.js', '/assets/index-C0Fb5Kzn.css',
      '/theme-bootstrap.js', '/fonts/manrope-latin-wght-normal.woff2',
    ]))
    expect(worker.cache.put).toHaveBeenCalledWith('/', expect.any(Response))
    expect(worker.self.skipWaiting).toHaveBeenCalledOnce()
  })

  it('caches versioned assets on demand but never intercepts private API requests', async () => {
    const worker = createWorker()
    const assetResponse = new Response('script')
    Object.defineProperty(assetResponse, 'type', { value: 'basic' })
    worker.fetch.mockResolvedValue(assetResponse)
    let response: Promise<Response> | undefined
    const respondWith = (value: Promise<Response>) => { response = value }
    worker.listeners.get('fetch')?.({ request: new Request('https://app.example/assets/calendar-page-AbCdEf12.js'), respondWith })
    await response
    expect(worker.cache.put).toHaveBeenCalledOnce()

    const privateResponse = vi.fn()
    worker.listeners.get('fetch')?.({ request: new Request('https://app.example/api/v1/tasks'), respondWith: privateResponse })
    expect(privateResponse).not.toHaveBeenCalled()
  })

  it('returns a standalone public offline page for an offline navigation', async () => {
    const worker = createWorker()
    worker.fetch.mockRejectedValue(new Error('offline'))
    let response: Promise<Response> | undefined
    const request = new Request('https://app.example/plan')
    Object.defineProperty(request, 'mode', { value: 'navigate' })
    worker.listeners.get('fetch')?.({ request, respondWith: (value) => { response = value } })
    const offlineResponse = await response
    expect(offlineResponse?.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    const offlineHtml = await offlineResponse?.text()
    expect(offlineHtml).toContain('<h1>Sin conexión</h1>')
    expect(offlineHtml).toMatch(/href="\/\?retry=\d+-\d+#home"/)
    expect(worker.caches.match).not.toHaveBeenCalled()

    let nextResponse: Promise<Response> | undefined
    worker.listeners.get('fetch')?.({ request, respondWith: (value) => { nextResponse = value } })
    const nextHtml = await (await nextResponse)?.text()
    expect(nextHtml?.match(/href="([^"]+)"/)?.[1]).not.toBe(offlineHtml?.match(/href="([^"]+)"/)?.[1])
  })

  it('shows safe push content and opens only an allowed app destination', async () => {
    const worker = createWorker()
    let pushed: Promise<unknown> | undefined
    worker.listeners.get('push')?.({ data: { json: () => ({ title: 'Planifica hoy', body: 'Revisa tus prioridades.', destination: 'https://other.example/' }) }, waitUntil: (value) => { pushed = value } })
    await pushed
    expect(worker.self.registration.showNotification).toHaveBeenCalledWith('Planifica hoy', expect.objectContaining({ body: 'Revisa tus prioridades.', data: { destination: '#home' } }))

    let clicked: Promise<unknown> | undefined
    const close = vi.fn()
    worker.listeners.get('notificationclick')?.({ notification: { data: { destination: '#calendar' }, close }, waitUntil: (value) => { clicked = value } })
    await clicked
    expect(close).toHaveBeenCalledOnce()
    expect(worker.self.clients.openWindow).toHaveBeenCalledWith('https://app.example/#calendar')
  })
})
