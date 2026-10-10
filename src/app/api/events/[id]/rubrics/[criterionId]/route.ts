import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireEventOrganizer } from '@/lib/auth/guards'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; criterionId: string }> }
) {
  const { id, criterionId } = await params
  try {
    const auth = await requireEventOrganizer(id)
    if (auth.errorResponse) return auth.errorResponse

    const body = await request.json()
    const { name, description, weight, maxScore, scoreBands, orderIndex } = body

    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (weight !== undefined) updates.weight = Number(weight)
    if (maxScore !== undefined) updates.max_score = Number(maxScore)
    if (scoreBands !== undefined) updates.score_bands = scoreBands
    if (orderIndex !== undefined) updates.order_index = Number(orderIndex)

    const serviceClient = getServiceSupabase()
    const { data: updated, error: updateErr } = await serviceClient
      .from('rubric_criteria')
      .update(updates)
      .eq('id', criterionId)
      .eq('event_id', id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, criterion: updated })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; criterionId: string }> }
) {
  const { id, criterionId } = await params
  try {
    const auth = await requireEventOrganizer(id)
    if (auth.errorResponse) return auth.errorResponse

    const serviceClient = getServiceSupabase()

    const { error: delErr } = await serviceClient
      .from('rubric_criteria')
      .delete()
      .eq('id', criterionId)
      .eq('event_id', id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Criterion deleted successfully' })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
