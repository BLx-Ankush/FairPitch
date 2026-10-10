import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { hashToken } from '@/lib/auth/tokens'
import { sendWelcomeEmail } from '@/lib/email/resend'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      fullName,
      accountType, // 'participant' | 'organizer' | 'jury'
      institutionId,
      inviteToken,
    } = body

    if (!email || !password || !fullName || !accountType) {
      return NextResponse.json(
        { error: 'Email, password, full name, and account type are required' },
        { status: 400 }
      )
    }

    // 1. Bar admin / platform_owner creation from public registration
    if (accountType === 'institution_admin' || accountType === 'platform_owner') {
      return NextResponse.json(
        {
          error:
            'Institution administrator accounts cannot be created via public registration. Please use your platform owner activation link.',
        },
        { status: 403 }
      )
    }

    if (!['participant', 'organizer', 'jury'].includes(accountType)) {
      return NextResponse.json(
        { error: 'Invalid account type. Allowed types are participant, organizer, or jury.' },
        { status: 400 }
      )
    }

    const serviceClient = getServiceSupabase()
    let assignedInstitutionId: string | null = null
    let globalRole: 'user' = 'user'
    let organizerStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none'
    let verifiedInvite: any = null

    // 2. Role-specific validation
    if (accountType === 'participant') {
      // Ignore any client-sent institutionId for participants
      assignedInstitutionId = null
      globalRole = 'user'
      organizerStatus = 'none'
    } else if (accountType === 'organizer') {
      // Organizers must select an institution from the server-provided list and stay pending
      if (!institutionId) {
        return NextResponse.json(
          { error: 'Please select an institution for your organizer application' },
          { status: 400 }
        )
      }

      // Verify that institution exists
      let { data: inst, error: instErr } = await serviceClient
        .from('institutions')
        .select('id')
        .eq('id', institutionId)
        .single()

      if (instErr || !inst) {
        return NextResponse.json(
          { error: 'Selected institution is invalid or does not exist' },
          { status: 400 }
        )
      }

      assignedInstitutionId = inst.id
      globalRole = 'user'
      organizerStatus = 'pending' // Must be approved by Institution Admin
    } else if (accountType === 'jury') {
      // Jury signup requires a valid, unexpired, unused invite token
      if (!inviteToken) {
        return NextResponse.json(
          { error: 'A valid jury invitation token or code is required to register as a jury evaluator' },
          { status: 400 }
        )
      }

      const tokenHash = hashToken(inviteToken.trim())
      const { data: invite, error: inviteErr } = await serviceClient
        .from('invites')
        .select('*')
        .eq('token_hash', tokenHash)
        .single()

      if (inviteErr || !invite) {
        return NextResponse.json(
          { error: 'Invalid or unrecognized jury invitation token' },
          { status: 404 }
        )
      }

      if (invite.used_at) {
        return NextResponse.json(
          { error: 'This jury invitation has already been redeemed' },
          { status: 410 }
        )
      }

      if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'This jury invitation token has expired' },
          { status: 410 }
        )
      }

      if (invite.role !== 'jury') {
        return NextResponse.json(
          { error: 'This invitation is not designated for jury evaluation' },
          { status: 400 }
        )
      }

      verifiedInvite = invite
      assignedInstitutionId = invite.institution_id
      globalRole = 'user'
      organizerStatus = 'none'
    }

    // 3. Sign up with Supabase Auth
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

    // 4. Insert or update profile via service role
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

    // 5. If Jury signup, activate event role & mark invite token as redeemed
    if (accountType === 'jury' && verifiedInvite) {
      if (verifiedInvite.event_id) {
        await serviceClient.from('event_roles').upsert({
          user_id: authData.user.id,
          event_id: verifiedInvite.event_id,
          institution_id: verifiedInvite.institution_id,
          role: 'jury',
          status: 'active',
        })
      }

      await serviceClient
        .from('invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', verifiedInvite.id)
    }

    // 6. Send transactional welcome email (non-blocking)
    try {
      await sendWelcomeEmail({
        to: email,
        fullName,
        role: accountType,
      })
    } catch (mailErr) {
      console.warn('[Signup] Welcome email non-fatal dispatch warning:', mailErr)
    }

    const emailConfirmationRequired = !authData.session && !authData.user.confirmed_at

    return NextResponse.json({
      success: true,
      emailConfirmationRequired,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: globalRole,
        organizerStatus,
        accountType,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

