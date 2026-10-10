import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { CURRENT_CONSENT_VERSION } from '@/lib/auth/roles'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { consentText, consentVersion = CURRENT_CONSENT_VERSION } = body

    if (!consentText) {
      return NextResponse.json(
        { error: 'Consent text agreement is required' },
        { status: 400 }
      )
    }

    // Determine institution_id from user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('institution_id')
      .eq('id', user.id)
      .single()

    let institutionId = profile?.institution_id

    const serviceClient = getServiceSupabase()
    if (!institutionId) {
      // Fallback to default or primary institution if not yet bound
      const { data: inst } = await serviceClient
        .from('institutions')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (inst?.id) {
        institutionId = inst.id
      } else {
        // Auto-provision default foundation institution so consent is NEVER blocked on clean DB
        const defaultInstId = 'a0000000-0000-0000-0000-000000000001'
        await serviceClient.from('institutions').upsert({
          id: defaultInstId,
          name: 'FairPitch Platform Foundation',
          slug: 'fairpitch-foundation',
          contact_email: 'compliance@fairpitch.io',
        })
        institutionId = defaultInstId
      }
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

    const { data: consentRecord, error: insertErr } = await serviceClient
      .from('consents')
      .insert({
        user_id: user.id,
        institution_id: institutionId,
        consent_version: consentVersion,
        consent_text: consentText,
        ip_address: ip,
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json(
        { error: `Failed to record consent: ${insertErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      consent: consentRecord,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
