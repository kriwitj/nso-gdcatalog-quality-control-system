/**
 * @jest-environment node
 *
 * Integration tests for GET /api/stats
 * Mocks Prisma and verifyAccessToken — tests business logic without a real DB.
 */

// Polyfill Web Request/Response for Next.js API routes in Node env
import 'next/dist/server/web/globals'

import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  verifyAccessToken: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    dataset:      { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
    resource:     { count: jest.fn() },
    organization: { count: jest.fn() },
    ckanSource:   { findMany: jest.fn() },
    user:         { findUnique: jest.fn() },
    scanJob:      { findFirst: jest.fn(), count: jest.fn() },
  },
}))

import { verifyAccessToken } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { GET } from '@/app/api/stats/route'

const mockVerify   = verifyAccessToken as jest.Mock
const mockDataset  = prisma.dataset  as jest.Mocked<typeof prisma.dataset>
const mockResource = prisma.resource as jest.Mocked<typeof prisma.resource>
const mockOrg      = prisma.organization as jest.Mocked<typeof prisma.organization>
const mockSource   = prisma.ckanSource as jest.Mocked<typeof prisma.ckanSource>
const mockScanJob  = prisma.scanJob  as jest.Mocked<typeof prisma.scanJob>

function makeRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/stats', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function setupAdminMocks() {
  mockVerify.mockReturnValue({ userId: 'user-1', role: 'admin' })
  mockDataset.count.mockResolvedValue(42)
  mockResource.count.mockResolvedValue(100)
  mockOrg.count.mockResolvedValue(5)
  mockDataset.groupBy.mockResolvedValue([])
  mockDataset.aggregate.mockResolvedValue({ _avg: { overallScore: 75.5 } })
  mockDataset.findMany.mockResolvedValue([])
  mockScanJob.findFirst.mockResolvedValue(null)
  mockScanJob.count.mockResolvedValue(0)
  mockSource.findMany.mockResolvedValue([])
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('GET /api/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockRejectedValue(new Error('no network in tests'))
  })

  // ── Auth guard ───────────────────────────────────────────────────
  test('returns 401 when no Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('returns 401 when token is invalid', async () => {
    mockVerify.mockImplementation(() => { throw new Error('bad token') })
    const res = await GET(makeRequest('bad-token'))
    expect(res.status).toBe(401)
  })

  // ── Happy path ───────────────────────────────────────────────────
  test('returns 200 with correct shape for admin', async () => {
    setupAdminMocks()
    const res = await GET(makeRequest('valid-token'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toMatchObject({
      totalDatasets:               42,
      totalResources:              100,
      totalOrganizations:          expect.any(Number),
      avgScore:                    75.5,
      gradeDistribution:           expect.any(Array),
      machineReadableDistribution: expect.any(Array),
      timelinessDistribution:      expect.any(Array),
      topDatasets:                 expect.any(Array),
      lowDatasets:                 expect.any(Array),
      pendingJobs:                 0,
    })
  })

  test('gradeDistribution has entries for all grades A-F and ?', async () => {
    setupAdminMocks()
    const res = await GET(makeRequest('valid-token'))
    const { gradeDistribution } = await res.json()
    const grades = gradeDistribution.map((g: { grade: string }) => g.grade)
    expect(grades).toEqual(expect.arrayContaining(['A','B','C','D','F','?']))
  })

  test('machineReadableDistribution has 4 status keys', async () => {
    setupAdminMocks()
    const res = await GET(makeRequest('valid-token'))
    const { machineReadableDistribution } = await res.json()
    expect(machineReadableDistribution).toHaveLength(4)
  })

  test('timelinessDistribution has 4 status keys', async () => {
    setupAdminMocks()
    const res = await GET(makeRequest('valid-token'))
    const { timelinessDistribution } = await res.json()
    expect(timelinessDistribution).toHaveLength(4)
  })

  // ── Non-admin scope ──────────────────────────────────────────────
  test('non-admin with no division sees empty data', async () => {
    mockVerify.mockReturnValue({ userId: 'user-2', role: 'viewer' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ divisionId: null })
    mockDataset.count.mockResolvedValue(0)
    mockResource.count.mockResolvedValue(0)
    mockOrg.count.mockResolvedValue(0)
    mockDataset.groupBy.mockResolvedValue([])
    mockDataset.aggregate.mockResolvedValue({ _avg: { overallScore: null } })
    mockDataset.findMany.mockResolvedValue([])
    mockScanJob.findFirst.mockResolvedValue(null)
    mockScanJob.count.mockResolvedValue(0)
    mockSource.findMany.mockResolvedValue([])

    const res = await GET(makeRequest('scoped-token'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalDatasets).toBe(0)
  })

  // ── sanitize: BigInt ─────────────────────────────────────────────
  test('BigInt values are serialised as numbers (not throw)', async () => {
    setupAdminMocks()
    mockDataset.count.mockResolvedValue(BigInt(10) as unknown as number)
    const res = await GET(makeRequest('valid-token'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.totalDatasets).toBe('number')
  })
})
