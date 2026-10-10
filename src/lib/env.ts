/**
 * FairPitch Environment Configuration Validator
 * Ensures consistent runtime configuration contract across local development and production deployments.
 */

export interface EnvConfig {
  isProduction: boolean
  isDemoAllowed: boolean
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey?: string
    isConfigured: boolean
  }
  gemini: {
    apiKey?: string
    model: string
    isConfigured: boolean
  }
  appUrl: string
  resend?: {
    apiKey?: string
    fromEmail: string
  }
  razorpay?: {
    keyId?: string
    keySecret?: string
  }
}

/**
 * Returns typed runtime environment configuration.
 */
export function getEnvConfig(): EnvConfig {
  const isProduction = process.env.NODE_ENV === 'production'
  const isDemoAllowed = false

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  const isSupabaseConfigured =
    Boolean(supabaseUrl) &&
    !supabaseUrl.includes('your-project-id') &&
    Boolean(supabaseAnonKey) &&
    !supabaseAnonKey.includes('your-anon-key')

  return {
    isProduction,
    isDemoAllowed,
    supabase: {
      url: supabaseUrl || 'http://127.0.0.1:54321',
      anonKey: supabaseAnonKey || 'dummy-anon-key',
      serviceRoleKey: serviceRoleKey || undefined,
      isConfigured: isSupabaseConfigured,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      isConfigured: Boolean(
        process.env.GEMINI_API_KEY &&
          !process.env.GEMINI_API_KEY.includes('your_') &&
          process.env.GEMINI_API_KEY.trim().length > 0
      ),
    },
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    resend: {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM || 'FairPitch <audits@fairpitch.io>',
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
    },
  }
}

/**
 * Validates production environment readiness.
 * Returns array of missing or invalid configuration warnings.
 */
export function validateProductionReadiness(): { isValid: boolean; issues: string[] } {
  const issues: string[] = []
  const config = getEnvConfig()

  if (config.isProduction) {
    if (!config.supabase.isConfigured) {
      issues.push(
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured with a live Supabase project in production.'
      )
    }

    if (!config.supabase.serviceRoleKey) {
      issues.push(
        'SUPABASE_SERVICE_ROLE_KEY is required in production for elevated audit ledger commitments and RLS bypass triggers.'
      )
    }

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      issues.push(
        'NEXT_PUBLIC_DEMO_MODE must be set to "false" in production environments.'
      )
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  }
}
