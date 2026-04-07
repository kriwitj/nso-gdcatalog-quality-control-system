import Redis from 'ioredis'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    })
    _redis.on('error', (err) => console.error('[Redis]', err.message))
  }
  return _redis
}

export const QUEUE_RESOURCE_CHECK = 'ogd:queue:resource_check'
export const QUEUE_SCORE_CALC     = 'ogd:queue:score_calc'

export interface ResourceCheckJob {
  jobId: string
  resourceId: string
  resourceCkanId: string
  resourceUrl: string
  resourceFormat: string | null
  packageId: string
  datasetCkanId: string
  metadataModified: string | null
  updateFrequency: string | null
  datasetResourceCount: number  // จำนวน resource ทั้งหมดของ dataset นี้
}

export interface ScoreCalcJob {
  jobId: string
  datasetId: string
}

export async function enqueueResourceCheck(job: ResourceCheckJob) {
  await getRedis().lpush(QUEUE_RESOURCE_CHECK, JSON.stringify(job))
}

export async function enqueueScoreCalc(job: ScoreCalcJob) {
  await getRedis().lpush(QUEUE_SCORE_CALC, JSON.stringify(job))
}

export async function getQueueLengths() {
  const redis = getRedis()
  const [resourceQueue, scoreQueue] = await Promise.all([
    redis.llen(QUEUE_RESOURCE_CHECK),
    redis.llen(QUEUE_SCORE_CALC),
  ])
  return { resourceQueue, scoreQueue }
}