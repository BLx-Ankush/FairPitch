import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params
    const supabase = await createClient()

    const { data: submission, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', teamId)
      .eq('event_id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, submission })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is in team
    const { data: member } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'Forbidden: You must be a member of this team to manage submissions' },
        { status: 403 }
      )
    }

    // Verify event status allows submission
    const { data: event } = await supabase
      .from('events')
      .select('institution_id, status, submission_deadline')
      .eq('id', id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status === 'published' || event.status === 'draft') {
      return NextResponse.json(
        { error: `Submissions are closed (event is currently in ${event.status} state)` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, description, repoUrl, demoUrl, attachments = [] } = body

    if (!title) {
      return NextResponse.json({ error: 'Submission project title is required' }, { status: 400 })
    }

    const serviceClient = getServiceSupabase()
    const { data: submission, error: upsertErr } = await serviceClient
      .from('submissions')
      .upsert(
        {
          team_id: teamId,
          event_id: id,
          institution_id: event.institution_id,
          title,
          description: description || null,
          repo_url: repoUrl || null,
          demo_url: demoUrl || null,
          attachments,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id' }
      )
      .select()
      .single()

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, submission })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
