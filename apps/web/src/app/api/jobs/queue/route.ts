import { NextResponse } from 'next/server'
import { getQueueLengths } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET() {
  const lengths = await getQueueLengths()
  return NextResponse.json(lengths)
}
