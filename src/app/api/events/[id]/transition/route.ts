import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { newStatus } = await request.json()

    if (!newStatus) {
      return NextResponse.json({ error: 'Target status is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call database transition_event_status RPC
    const { data: updatedStatus, error: rpcErr } = await supabase.rpc(
      'transition_event_status',
      {
        p_event_id: id,
        p_new_status: newStatus,
      }
    )

    if (rpcErr) {
      return NextResponse.json(
        { error: rpcErr.message },
        { status: 400 }
      )
    }

    // If transitioned to published, send publication email notification via Resend
    if (newStatus === 'published') {
      try {
        const { getServiceSupabase } = await import('@/lib/supabase/service-role')
        const { sendResultsPublishedEmail } = await import('@/lib/email/resend')
        const serviceClient = getServiceSupabase()

        const { data: event } = await serviceClient
          .from('events')
          .select('title, anchored_merkle_root')
          .eq('id', id)
          .single()

        if (event && event.anchored_merkle_root && user.email) {
          await sendResultsPublishedEmail(
            user.email,
            event.title,
            id,
            event.anchored_merkle_root
          )
        }
      } catch (emailErr) {
        console.error('Non-critical publication email notification failed:', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      status: updatedStatus || newStatus,
      message: `Event transitioned to ${newStatus} successfully`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
