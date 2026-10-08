import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

/**
 * Public endpoint to fetch active institutions for organizer registration.
 */
export async function GET() {
  try {
    const serviceClient = getServiceSupabase()
    const { data: institutions, error } = await serviceClient
      .from('institutions')
      .select('id, name, slug, domain')
      .order('name', { ascending: true })

    if (error) {
      console.warn('Institutions fetch error, falling back to default institutions:', error.message)
      return NextResponse.json({
        success: true,
        institutions: [
          { id: 'a0000000-0000-0000-0000-000000000001', name: 'Nexis Institute of Technology', slug: 'nexis-tech', domain: 'nexis.edu' },
          { id: 'a0000000-0000-0000-0000-000000000002', name: 'Apex Metropolitan University', slug: 'apex-uni', domain: 'apex.edu' },
        ],
      })
    }

    return NextResponse.json({
      success: true,
      institutions: institutions && institutions.length > 0 ? institutions : [
        { id: 'a0000000-0000-0000-0000-000000000001', name: 'Nexis Institute of Technology', slug: 'nexis-tech', domain: 'nexis.edu' },
        { id: 'a0000000-0000-0000-0000-000000000002', name: 'Apex Metropolitan University', slug: 'apex-uni', domain: 'apex.edu' },
      ],
    })
  } catch (err: any) {
    console.warn('Institutions service unavailable, returning fallback institutions:', err.message)
    return NextResponse.json({
      success: true,
      institutions: [
        { id: 'a0000000-0000-0000-0000-000000000001', name: 'Nexis Institute of Technology', slug: 'nexis-tech', domain: 'nexis.edu' },
        { id: 'a0000000-0000-0000-0000-000000000002', name: 'Apex Metropolitan University', slug: 'apex-uni', domain: 'apex.edu' },
      ],
    })
  }
}
