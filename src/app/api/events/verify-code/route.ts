import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { DEMO_EVENTS } from '@/lib/demo-store'

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

    // 1. Check Demo Events first if matching
    const demoMatch = DEMO_EVENTS.find(
      (e) =>
        e.event_code?.toUpperCase() === cleanCode ||
        e.slug?.toUpperCase() === cleanCode ||
        e.id === code ||
        e.title?.toUpperCase().includes(cleanCode)
    )

    // 2. Query Database
    try {
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

      if (!dbErr && dbEvents && dbEvents.length > 0) {
        const ev = dbEvents[0]
        return NextResponse.json({
          success: true,
          event: {
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
          },
        })
      }
    } catch {
      // Supabase unavailable, continue to demo check
    }

    // 3. Fallback to Demo Match if DB didn't find it
    if (demoMatch) {
      return NextResponse.json({
        success: true,
        event: {
          id: demoMatch.id,
          title: demoMatch.title,
          slug: demoMatch.slug,
          eventCode: demoMatch.event_code || 'HACK-2026',
          description: demoMatch.description,
          registrationFee: Number(demoMatch.registration_fee) || 500,
          upiId: demoMatch.upi_id || 'hacknexis@upi',
          upiName: demoMatch.upi_name || 'HackNexis Organizer Desk',
          institutionName: demoMatch.institutions?.name || 'Nexis Institute of Technology',
          tracks: [
            'AI & Machine Learning',
            'Web3 & Fintech',
            'Open Innovation',
            'Healthcare & Biotech',
            'Smart Cities & IoT',
          ],
          status: demoMatch.status,
        },
      })
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
