import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { memoryCache, publicCacheHeaders } from '@/lib/cache/memory-cache'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.trim()

    if (!code) {
      return NextResponse.json(
        { error: 'Event code is required' },
        { status: 400 }
      )
    }

    const cleanCode = code.toUpperCase()
    const cacheKey = `event:code:${cleanCode}`

    const cachedData = memoryCache.get<any>(cacheKey)
    if (cachedData) {
      return NextResponse.json(
        { success: true, event: cachedData, source: 'cache' },
        { headers: publicCacheHeaders(60, 300) }
      )
    }

    const serviceClient = getServiceSupabase()

    // Search by event_code, slug, or ID
    let query = serviceClient
      .from('events')
      .select('id, title, slug, event_code, description, status, registration_fee, upi_id, upi_name, institutions(name)')

    // UUID check
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)

    if (isUuid) {
      query = query.or(`id.eq.${code},event_code.ilike.${code},slug.ilike.${code}`)
    } else {
      query = query.or(`event_code.ilike.${code},slug.ilike.${code}`)
    }

    const { data: dbEvents, error: dbErr } = await query.limit(1)

    if (dbErr) {
      return NextResponse.json(
        { error: dbErr.message || 'Database query failed' },
        { status: 500 }
      )
    }

    if (dbEvents && dbEvents.length > 0) {
      const ev = dbEvents[0]
      const formattedEvent = {
        id: ev.id,
        title: ev.title,
        slug: ev.slug,
        eventCode: ev.event_code || ev.slug?.toUpperCase() || cleanCode,
        description: ev.description,
        registrationFee: Number(ev.registration_fee) || 0,
        upiId: ev.upi_id,
        upiName: ev.upi_name,
        institutionName: (ev.institutions as any)?.name || 'FairPitch Partner Organization',
        tracks: [
          'AI & Machine Learning',
          'Web3 & Fintech',
          'Open Innovation',
          'Healthcare & Biotech',
          'Smart Cities & IoT',
        ],
        status: ev.status,
      }

      // Cache for 60 seconds with tag for invalidation when event is modified
      memoryCache.set(cacheKey, formattedEvent, 60, ['events', `event:${ev.id}`])

      return NextResponse.json(
        {
          success: true,
          event: formattedEvent,
        },
        {
          headers: publicCacheHeaders(60, 300),
        }
      )
    }

    return NextResponse.json(
      {
        error: `No event found with code "${code}". Please double check the code on your flyer or announcement.`,
      },
      { status: 404 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to verify event code' },
      { status: 500 }
    )
  }
}

