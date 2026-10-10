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
      console.error('Institutions fetch error:', error.message)
      return NextResponse.json({ success: false, error: error.message, institutions: [] }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      institutions: institutions || [],
    })
  } catch (err: any) {
    console.error('Institutions service unavailable:', err.message)
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to fetch institutions',
      institutions: [],
    }, { status: 500 })
  }
}
