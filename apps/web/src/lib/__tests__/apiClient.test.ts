/**
 * @jest-environment node
 *
 * Unit tests for apiClient.ts — JWT decode helpers + apiFetch behaviour.
 * Runs in Node env (Node 22 has built-in Response/fetch globals).
 */

function makeJwt(exp: number): string {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'test', exp })).toString('base64url')
  return `${header}.${payload}.sig`
}

describe('JWT expiry helpers (via apiFetch behaviour)', () => {
  const nowSec = () => Math.floor(Date.now() / 1000)

  let getItemMock: jest.Mock
  let setItemMock: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'))
    jest.resetModules()

    getItemMock = jest.fn()
    setItemMock = jest.fn()

    // In Node env, window is undefined — mock it so apiFetch reads localStorage
    Object.defineProperty(global, 'window', {
      value: {
        location: { href: '' },
        localStorage: {
          getItem:    getItemMock,
          setItem:    setItemMock,
          removeItem: jest.fn(),
        },
      },
      writable:     true,
      configurable: true,
    })

    // Expose localStorage at global level too (matches typeof window check)
    Object.defineProperty(global, 'localStorage', {
      value: (global as typeof globalThis & { window: { localStorage: object } }).window.localStorage,
      writable:     true,
      configurable: true,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    // Clean up window mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).localStorage
  })

  test('valid non-expiring token is attached to request', async () => {
    const futureToken = makeJwt(nowSec() + 3600)
    getItemMock.mockReturnValue(futureToken)

    const mockFetch = jest.fn().mockResolvedValue(
      new Response('{}', { status: 200 })
    )
    global.fetch = mockFetch as typeof fetch

    const { apiFetch } = await import('../apiClient')
    await apiFetch('/api/test')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(callHeaders['Authorization']).toBe(`Bearer ${futureToken}`)
  })

  test('no token: request sent without Authorization header', async () => {
    getItemMock.mockReturnValue(null)

    const mockFetch = jest.fn().mockResolvedValue(
      new Response('{}', { status: 200 })
    )
    global.fetch = mockFetch as typeof fetch

    const { apiFetch } = await import('../apiClient')
    await apiFetch('/api/test')

    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(callHeaders['Authorization']).toBeUndefined()
  })

  test('network error returns 503 response without throwing', async () => {
    getItemMock.mockReturnValue(null)
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as typeof fetch

    const { apiFetch } = await import('../apiClient')
    const res = await apiFetch('/api/test')

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('expiring token (within 60s) triggers proactive refresh', async () => {
    const expiringToken = makeJwt(nowSec() + 30)
    const newToken      = makeJwt(nowSec() + 3600)
    getItemMock.mockReturnValue(expiringToken)

    const mockFetch = jest.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: newToken }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    global.fetch = mockFetch as typeof fetch

    const { apiFetch } = await import('../apiClient')
    const res = await apiFetch('/api/data')

    expect(mockFetch.mock.calls[0][0]).toBe('/api/auth/refresh')
    expect(res.status).toBe(200)
  })
})

// ── makeJwt helper self-test ─────────────────────────────────────────
describe('makeJwt test helper', () => {
  test('creates a valid 3-part JWT', () => {
    expect(makeJwt(9999999999).split('.')).toHaveLength(3)
  })

  test('payload contains correct exp', () => {
    const exp   = 9999999999
    const token = makeJwt(exp)
    const b64   = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    expect(JSON.parse(Buffer.from(b64, 'base64').toString()).exp).toBe(exp)
  })
})
