import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { memoryCache, publicCacheHeaders } from '@/lib/cache/memory-cache'

/**
 * Public endpoint to fetch active institutions for organizer registration.
 * Cached at Vercel Edge CDN for 1 hour (TTL: 3600s, SWR: 86400s) + in-memory cache-aside.
 */
export async function GET() {
  try {
    const institutions = await memoryCache.getOrSet(
      'institutions:all',
      async () => {
        const serviceClient = getServiceSupabase()
        const { data, error } = await serviceClient
          .from('institutions')
          .select('id, name, slug, domain')
          .order('name', { ascending: true })

        if (error) {
          throw new Error(error.message)
        }
        return data || []
      },
      3600,
      ['institutions']
    )

    return NextResponse.json(
      {
        success: true,
        institutions,
      },
      {
        headers: publicCacheHeaders(3600, 86400),
      }
    )
  } catch (err: any) {
    console.error('Institutions service unavailable:', err.message)
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch institutions',
        institutions: [],
      },
      { status: 500 }
    )
  }
}

