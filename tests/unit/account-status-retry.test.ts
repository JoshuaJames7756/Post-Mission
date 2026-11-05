import { describe, expect, it } from 'vitest'
import { retryAccountStatus } from '../../src/account-status-retry.js'

describe('account status recovery', () => {
  it('retries temporary read failures without retrying authentication or validation errors', () => {
    expect(retryAccountStatus(0, new TypeError('network unavailable'))).toBe(true)
    expect(retryAccountStatus(1, Object.assign(new Error('server'), { status: 503 }))).toBe(true)
    expect(retryAccountStatus(2, new TypeError('network unavailable'))).toBe(false)
    expect(retryAccountStatus(0, Object.assign(new Error('unauthenticated'), { status: 401 }))).toBe(false)
    expect(retryAccountStatus(0, Object.assign(new Error('invalid'), { status: 400 }))).toBe(false)
  })
})
