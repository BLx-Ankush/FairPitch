import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { createRazorpayOrder } from '@/lib/payments/razorpay'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { eventId, tier = 'pro' } = body

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify organizer permission
    const { data: orgRole } = await supabase
      .from('event_roles')
      .select('role, institution_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .in('role', ['admin', 'organizer'])
      .maybeSingle()

    if (!orgRole) {
      return NextResponse.json(
        { error: 'Forbidden: Organizer permissions required' },
        { status: 403 }
      )
    }

    // Pricing plans: Pro: ₹4,999, Enterprise: ₹14,999
    const priceMap: Record<string, number> = {
      pro: 4999,
      enterprise: 14999,
    }
    const amountInRupees = priceMap[tier] || 4999

    // Generate Razorpay Order
    const receipt = `inv_${Date.now()}`
    const order = await createRazorpayOrder({
      amountInRupees,
      receipt,
      notes: {
        eventId,
        institutionId: orgRole.institution_id,
        tier,
      },
    })

    // Create pending invoice record via service-role
    const serviceClient = getServiceSupabase()
    const { data: invoice, error: invoiceErr } = await serviceClient
      .from('invoices')
      .insert({
        institution_id: orgRole.institution_id,
        event_id: eventId,
        participant_count: tier === 'enterprise' ? 500 : 100,
        rate_per_participant: tier === 'enterprise' ? 30.0 : 49.99,
        total_amount: amountInRupees,
        currency: 'INR',
        status: 'issued',
      })
      .select()
      .single()

    if (invoiceErr) {
      return NextResponse.json({ error: invoiceErr.message }, { status: 500 })
    }

    // Create initiated payment record
    await serviceClient.from('payments').insert({
      institution_id: orgRole.institution_id,
      event_id: eventId,
      invoice_id: invoice.id,
      gateway: 'razorpay',
      gateway_order_id: order.id,
      amount: amountInRupees,
      status: 'initiated',
      payer_id: user.id,
    })

    return NextResponse.json({
      success: true,
      order,
      invoiceId: invoice.id,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
