import { NextResponse } from 'next/server'
import { getQueueLengths } from '@/lib/queue'
import { withAuth } from '@/lib/withAuth'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async () => {
  const lengths = await getQueueLengths()
  return NextResponse.json(lengths)
})
