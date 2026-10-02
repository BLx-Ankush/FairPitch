import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client.
 * CAUTION: Bypasses Row Level Security (RLS).
 * MUST ONLY be called inside server actions, route handlers, or background jobs.
 * NEVER expose this or import it into client-side code.
 */
export function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-service-key'

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
