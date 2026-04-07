import axios, { AxiosInstance } from 'axios'

const DEFAULT_URL     = process.env.CKAN_BASE_URL || ''
const DEFAULT_API_KEY = process.env.CKAN_API_KEY  || ''
const PAGE_SIZE       = 50   // ลดลงจาก 100 เพื่อความเสถียร

export interface CkanPackage {
  id: string
  name: string
  title: string
  notes: string
  license_title: string
  tags: { name: string }[]
  groups: { name: string }[]
  organization: {
    id: string; name: string; title: string
    description: string; image_url: string
  } | null
  resources: CkanResource[]
  metadata_created: string
  metadata_modified: string
  update_frequency?: string
  isopen: boolean
  num_resources: number
}

export interface CkanResource {
  id: string
  package_id: string
  name: string
  description: string
  format: string
  url: string
  size: number | null
  mimetype: string | null
  hash: string | null
  metadata_modified: string
}

export interface CkanClientOptions {
  baseUrl?: string
  apiKey?:  string
}

function makeClient(opts?: CkanClientOptions): AxiosInstance {
  const url    = opts?.baseUrl || DEFAULT_URL
  const apiKey = opts?.apiKey  || DEFAULT_API_KEY
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'OGD-Quality-System/1.0',
  }
  if (apiKey) headers['Authorization'] = apiKey
  return axios.create({
    baseURL: `${url}/api/3/action`,
    timeout: 30000,
    headers,
  })
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn() }
    catch (err: unknown) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
    }
  }
  throw new Error('unreachable')
}

/**
 * Fetch all packages with pagination
 * หมายเหตุ: ไม่ใช้ fl= เพราะ CKAN บางรุ่นไม่ support ครบ
 */
export async function fetchAllPackages(opts?: CkanClientOptions): Promise<CkanPackage[]> {
  const client = makeClient(opts)
  const all: CkanPackage[] = []
  let start = 0

  while (true) {
    const res = await withRetry(() =>
      client.get('/package_search', {
        params: {
          rows: PAGE_SIZE,
          start,
          include_private: false,
          // ไม่ใส่ fl เพื่อให้ได้ response เต็ม
        },
      })
    )

    if (!res.data?.success) {
      throw new Error(`CKAN API error: ${JSON.stringify(res.data?.error)}`)
    }

    const result = res.data.result
    const packages: CkanPackage[] = result?.results || []

    // ถ้า resources ไม่มาใน package_search ให้ดึงแยกด้วย package_show
    for (const pkg of packages) {
      if (!Array.isArray(pkg.resources) || pkg.resources.length === 0) {
        if ((pkg.num_resources || 0) > 0) {
          try {
            const detail = await fetchPackage(pkg.id, opts)
            pkg.resources = detail.resources || []
          } catch (e) {
            console.warn(`[ckan] cannot fetch resources for ${pkg.id}: ${e}`)
            pkg.resources = []
          }
        } else {
          pkg.resources = []
        }
      }
    }

    all.push(...packages)
    console.log(`[ckan] fetched ${all.length} / ${result?.count ?? '?'}`)

    if (!result?.count || all.length >= result.count || packages.length === 0) break
    start += PAGE_SIZE
  }

  return all
}

/**
 * Fetch single package with full resource list
 */
export async function fetchPackage(id: string, opts?: CkanClientOptions): Promise<CkanPackage> {
  const client = makeClient(opts)
  const res = await withRetry(() =>
    client.get('/package_show', { params: { id } })
  )
  if (!res.data?.success) throw new Error(`package_show failed: ${JSON.stringify(res.data?.error)}`)
  return res.data.result
}