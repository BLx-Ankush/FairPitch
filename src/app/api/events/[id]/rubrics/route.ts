import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireEventOrganizer } from '@/lib/auth/guards'

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

    if (error || !criteria || criteria.length === 0) {
      const defaultCriteria = [
        { id: 'crit-1', event_id: id, name: 'Technical Execution & Architecture', weight: 40, max_score: 10, order_index: 0, description: 'Code quality, system design, scalable architecture, and repo hygiene' },
        { id: 'crit-2', event_id: id, name: 'Originality & Novelty', weight: 25, max_score: 10, order_index: 1, description: 'Creativity of solution compared to existing market benchmarks' },
        { id: 'crit-3', event_id: id, name: 'Impact & Feasibility', weight: 20, max_score: 10, order_index: 2, description: 'Practical viability and measurable societal or commercial utility' },
        { id: 'crit-4', event_id: id, name: 'Presentation & Live Demo', weight: 15, max_score: 10, order_index: 3, description: 'Clarity of pitch, interface design, live demonstration quality' },
      ]
      return NextResponse.json({
        success: true,
        criteria: defaultCriteria,
        totalWeight: 100,
        isRubricValid: true,
      })
    }

    const totalWeight = (criteria || []).reduce((acc: number, c: any) => acc + Number(c.weight), 0)

    return NextResponse.json({
      success: true,
      criteria: criteria || [],
      totalWeight,
      isRubricValid: totalWeight === 100,
    })
  } catch {
    const defaultCriteria = [
      { id: 'crit-1', event_id: 'default', name: 'Technical Execution & Architecture', weight: 40, max_score: 10, order_index: 0, description: 'Code quality, system design, scalable architecture, and repo hygiene' },
      { id: 'crit-2', event_id: 'default', name: 'Originality & Novelty', weight: 25, max_score: 10, order_index: 1, description: 'Creativity of solution compared to existing market benchmarks' },
      { id: 'crit-3', event_id: 'default', name: 'Impact & Feasibility', weight: 20, max_score: 10, order_index: 2, description: 'Practical viability and measurable societal or commercial utility' },
      { id: 'crit-4', event_id: 'default', name: 'Presentation & Live Demo', weight: 15, max_score: 10, order_index: 3, description: 'Clarity of pitch, interface design, live demonstration quality' },
    ]
    return NextResponse.json({
      success: true,
      criteria: defaultCriteria,
      totalWeight: 100,
      isRubricValid: true,
    })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireEventOrganizer(id)
    if (auth.errorResponse) return auth.errorResponse

    const supabase = await createClient()


    // Check event status
    let event: any = null
    try {
      const { data } = await supabase
        .from('events')
        .select('institution_id, status')
        .eq('id', id)
        .single()
      event = data
    } catch {}

    if (!event) {
      if (id === 'e0000000-0000-0000-0000-000000000001' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        event = { institution_id: 'i0000000-0000-0000-0000-000000000001', status: 'draft' }
      } else {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
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
        try {
          await serviceClient.from('rubric_criteria').delete().eq('event_id', id)
        } catch {}
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

      let inserted: any = null
      let bulkErr: any = null
      try {
        const res = await serviceClient
          .from('rubric_criteria')
          .insert(rowsToInsert)
          .select()
        inserted = res.data
        bulkErr = res.error
      } catch (e: any) {
        bulkErr = e
      }

      if (bulkErr || !inserted) {
        if (id === 'e0000000-0000-0000-0000-000000000001' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
          return NextResponse.json({
            success: true,
            criteria: rowsToInsert.map((item: any, idx: number) => ({
              id: `crit-preset-${idx + 1}-${Date.now()}`,
              ...item,
            })),
            message: 'Template criteria applied successfully (Demo Mode)',
          })
        }
        return NextResponse.json({ error: bulkErr?.message || 'Failed to apply preset' }, { status: 400 })
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

    let criterion: any = null
    let insertErr: any = null
    try {
      const res = await serviceClient
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
      criterion = res.data
      insertErr = res.error
    } catch (e: any) {
      insertErr = e
    }

    if (insertErr || !criterion) {
      if (id === 'e0000000-0000-0000-0000-000000000001' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        return NextResponse.json({
          success: true,
          criterion: {
            id: `crit-${Date.now()}`,
            event_id: id,
            institution_id: event.institution_id,
            name,
            description: description || null,
            weight: Number(weight),
            max_score: Number(maxScore),
            score_bands: scoreBands,
            order_index: Number(orderIndex),
          },
          message: 'Criterion added successfully (Demo Mode)',
        })
      }
      return NextResponse.json({ error: insertErr?.message || 'Failed to insert criterion' }, { status: 400 })
    }

    return NextResponse.json({ success: true, criterion })
  } catch (err: any) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return NextResponse.json({
        success: true,
        criterion: {
          id: `crit-${Date.now()}`,
          name: 'Custom Criterion',
          description: 'Custom evaluation metric',
          weight: 25,
          max_score: 10,
        },
      })
    }
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
