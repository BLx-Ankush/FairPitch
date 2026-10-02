import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: criteria, error } = await supabase
      .from('rubric_criteria')
      .select('*')
      .eq('event_id', id)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const totalWeight = (criteria || []).reduce((acc: number, c: any) => acc + Number(c.weight), 0)

    return NextResponse.json({
      success: true,
      criteria: criteria || [],
      totalWeight,
      isRubricValid: totalWeight === 100,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check event status
    const { data: event } = await supabase
      .from('events')
      .select('institution_id, status')
      .eq('id', id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (['judging', 'review', 'published'].includes(event.status)) {
      return NextResponse.json(
        { error: `Rubric is frozen. Cannot modify criteria once judging begins (current status: ${event.status})` },
        { status: 403 }
      )
    }

    const body = await request.json()
    const serviceClient = getServiceSupabase()

    // Support bulk insertion of preset criteria
    if (body.bulkCriteria && Array.isArray(body.bulkCriteria)) {
      // First clear existing criteria if requested
      if (body.replaceExisting) {
        await serviceClient.from('rubric_criteria').delete().eq('event_id', id)
      }

      const rowsToInsert = body.bulkCriteria.map((item: any, idx: number) => ({
        event_id: id,
        institution_id: event.institution_id,
        name: item.name,
        description: item.description || null,
        weight: Number(item.weight),
        max_score: Number(item.max_score) || 10,
        score_bands: item.score_bands || [],
        order_index: idx,
      }))

      const { data: inserted, error: bulkErr } = await serviceClient
        .from('rubric_criteria')
        .insert(rowsToInsert)
        .select()

      if (bulkErr) {
        return NextResponse.json({ error: bulkErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, criteria: inserted })
    }

    // Single criterion insert
    const { name, description, weight, maxScore = 10, scoreBands = [], orderIndex = 0 } = body

    if (!name || weight === undefined) {
      return NextResponse.json(
        { error: 'Criterion name and weight are required' },
        { status: 400 }
      )
    }

    if (Number(weight) <= 0 || Number(weight) > 100) {
      return NextResponse.json(
        { error: 'Weight must be greater than 0 and less than or equal to 100' },
        { status: 400 }
      )
    }

    const { data: criterion, error: insertErr } = await serviceClient
      .from('rubric_criteria')
      .insert({
        event_id: id,
        institution_id: event.institution_id,
        name,
        description: description || null,
        weight: Number(weight),
        max_score: Number(maxScore),
        score_bands: scoreBands,
        order_index: Number(orderIndex),
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, criterion })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
