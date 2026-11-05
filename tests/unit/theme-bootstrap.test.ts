import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync('public/theme-bootstrap.js', 'utf8')

function boot(saved: string | null, systemDark: boolean) {
  const root = { dataset: {} as Record<string, string> }
  const meta = { content: '', setAttribute(_name: string, value: string) { this.content = value } }
  runInNewContext(script, {
    localStorage: { getItem: () => saved },
    window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: root, querySelector: () => meta },
  })
  return { theme: root.dataset.theme, meta: meta.content }
}

describe('theme before React starts', () => {
  it('uses a saved theme before falling back to the device preference', () => {
    expect(boot('light', true)).toEqual({ theme: 'light', meta: '#f4f0e8' })
    expect(boot('dark', false)).toEqual({ theme: 'dark', meta: '#243447' })
    expect(boot('system', true)).toEqual({ theme: 'dark', meta: '#243447' })
    expect(boot(null, false)).toEqual({ theme: 'light', meta: '#f4f0e8' })
  })

  it('loads before the splash and uses a compass vector without an image background', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html.indexOf('/theme-bootstrap.js')).toBeLessThan(html.indexOf('id="app-launch"'))
    expect(html).toMatch(/id="app-launch"[^>]*><svg/)
    expect(html).not.toMatch(/id="app-launch"[^>]*><img/)
    expect(html).toContain("html[data-theme='dark'] #app-launch{background:#243447;color:#f4f0e8}")
  })
})
