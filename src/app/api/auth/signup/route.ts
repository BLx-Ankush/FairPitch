import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      fullName,
      accountType, // 'institution_admin' | 'organizer' | 'participant'
      institutionId,
      institutionName,
      institutionDomain,
    } = body

    if (!email || !password || !fullName || !accountType) {
      return NextResponse.json(
        { error: 'Email, password, full name, and account type are required' },
        { status: 400 }
      )
    }

    const serviceClient = getServiceSupabase()
    let assignedInstitutionId = institutionId || null
    let globalRole: 'platform_owner' | 'institution_admin' | 'user' = 'user'
    let organizerStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none'

    // Handle Institution Admin creation
    if (accountType === 'institution_admin') {
      globalRole = 'institution_admin'
      organizerStatus = 'approved'

      if (!assignedInstitutionId && institutionName) {
        // Create new institution
        const slug = institutionName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        const { data: inst, error: instErr } = await serviceClient
          .from('institutions')
          .insert({
            name: institutionName,
            slug: `${slug}-${Math.floor(Math.random() * 10000)}`,
            domain: institutionDomain || null,
            contact_email: email,
          })
          .select()
          .single()

        if (instErr) {
          return NextResponse.json({ error: `Failed to create institution: ${instErr.message}` }, { status: 400 })
        }
        assignedInstitutionId = inst.id
      }
    } else if (accountType === 'organizer') {
      globalRole = 'user'
      organizerStatus = 'pending' // Held in pending approval state until institution admin approves
    } else {
      globalRole = 'user'
      organizerStatus = 'none'
    }

    // Sign up with Supabase Auth
    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (authErr || !authData.user) {
      return NextResponse.json(
        { error: authErr?.message || 'Failed to create user account' },
        { status: 400 }
      )
    }

    // Insert or update profile via service role
    const { error: profileErr } = await serviceClient
      .from('profiles')
      .upsert({
        id: authData.user.id,
        institution_id: assignedInstitutionId,
        full_name: fullName,
        email,
        role: globalRole,
        organizer_approval_status: organizerStatus,
        updated_at: new Date().toISOString(),
      })

    if (profileErr) {
      return NextResponse.json(
        { error: `User created but failed to initialize profile: ${profileErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: globalRole,
        organizerStatus,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
