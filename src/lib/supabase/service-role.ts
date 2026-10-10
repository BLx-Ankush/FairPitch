import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cachedServiceClient: SupabaseClient | null = null

/**
 * Service-role Supabase client.
 * CAUTION: Bypasses Row Level Security (RLS).
 * MUST ONLY be called inside server actions, route handlers, or background jobs.
 * NEVER expose this or import it into client-side code.
 * 
 * Performance: Uses a persistent singleton client to preserve HTTP keep-alive
 * connections and avoid socket exhaustion under heavy concurrent load.
 */
export function getServiceSupabase(): SupabaseClient {
  if (cachedServiceClient) {
    return cachedServiceClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-service-key'

  cachedServiceClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-application-name': 'fairpitch-engine',
        Connection: 'keep-alive',
      },
    },
  })

  return cachedServiceClient
}
