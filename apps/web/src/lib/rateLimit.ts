import { getRedis } from './queue'

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super('Too many requests')
  }
}

/**
 * Sliding-window rate limiter backed by Redis.
 * Throws RateLimitError when the limit is exceeded.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number,
): Promise<void> {
  const redis = getRedis()
  const redisKey = `ogd:ratelimit:${key}`
  const count = await redis.incr(redisKey)
  if (count === 1) {
    await redis.expire(redisKey, windowSec)
  }
  if (count > maxRequests) {
    const ttl = await redis.ttl(redisKey)
    throw new RateLimitError(ttl > 0 ? ttl : windowSec)
  }
}
