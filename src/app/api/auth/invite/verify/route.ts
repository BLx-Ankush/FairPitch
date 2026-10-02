import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { hashToken } from '@/lib/auth/tokens'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 })
    }

    const tokenHash = hashToken(token)
    const serviceClient = getServiceSupabase()

    // 1. Query invite by token_hash
    const { data: invite, error: inviteErr } = await serviceClient
      .from('invites')
      .select('*, institutions(name), events(title)')
      .eq('token_hash', tokenHash)
      .single()

    if (inviteErr || !invite) {
      return NextResponse.json(
        { error: 'Invalid or unrecognized invite token' },
        { status: 404 }
      )
    }

    // 2. Check if already used
    if (invite.used_at) {
      return NextResponse.json(
        { error: 'This invitation has already been redeemed' },
        { status: 410 }
      )
    }

    // 3. Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 410 }
      )
    }

    // 4. Check if caller is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Complete redemption for authenticated user
      // A. Grant event_roles if event_id is present
      if (invite.event_id) {
        await serviceClient.from('event_roles').upsert({
          user_id: user.id,
          event_id: invite.event_id,
          institution_id: invite.institution_id,
          role: invite.role, // 'organizer' or 'jury'
          status: 'active',
        })
      }

      // B. Update profile if organizer
      if (invite.role === 'organizer') {
        await serviceClient
          .from('profiles')
          .update({
            institution_id: invite.institution_id,
            organizer_approval_status: 'approved',
          })
          .eq('id', user.id)
      }

      // C. Mark invite as used
      await serviceClient
        .from('invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id)

      return NextResponse.json({
        success: true,
        redeemed: true,
        role: invite.role,
        eventId: invite.event_id,
        institutionId: invite.institution_id,
        targetUrl: invite.role === 'jury' ? '/jury' : '/org',
      })
    }

    // Return invite metadata if user needs to sign in or confirm email
    return NextResponse.json({
      success: true,
      redeemed: false,
      invite: {
        email: invite.email,
        role: invite.role,
        institutionName: invite.institutions?.name,
        eventTitle: invite.events?.title,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
