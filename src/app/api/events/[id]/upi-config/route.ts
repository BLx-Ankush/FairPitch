import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

// GET: public / participant access to event UPI details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const serviceClient = getServiceSupabase()

    const { data: event, error: eventErr } = await serviceClient
      .from('events')
      .select('id, title, registration_fee, upi_id, upi_name, upi_qr_url, auto_verify_upi')
      .eq('id', id)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const registrationFee = Number(event.registration_fee) || 0
    const hasUpiConfigured = Boolean(event.upi_id && event.upi_name)

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        registrationFee,
        isFree: registrationFee === 0,
        upiId: event.upi_id || null,
        upiName: event.upi_name || null,
        upiQrUrl: event.upi_qr_url || null,
        hasUpiConfigured,
        autoVerifyUpi: event.auto_verify_upi || false,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: organizer updates UPI configuration
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

    // Verify organizer permission
    const { data: orgRole } = await supabase
      .from('event_roles')
      .select('role')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .in('role', ['admin', 'organizer'])
      .maybeSingle()

    if (!orgRole) {
      return NextResponse.json(
        { error: 'Forbidden: Organizer permissions required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { registrationFee = 0, upiId, upiName, upiQrUrl, autoVerifyUpi = false } = body

    const feeNum = Number(registrationFee)
    if (isNaN(feeNum) || feeNum < 0) {
      return NextResponse.json(
        { error: 'Registration fee must be a non-negative number' },
        { status: 400 }
      )
    }

    if (feeNum > 0 && (!upiId || !upiId.trim())) {
      return NextResponse.json(
        { error: 'A valid Payee UPI ID (VPA) is required when registration fee is greater than 0' },
        { status: 400 }
      )
    }

    const serviceClient = getServiceSupabase()
    const { data: updatedEvent, error: updateErr } = await serviceClient
      .from('events')
      .update({
        registration_fee: feeNum,
        upi_id: upiId ? upiId.trim() : null,
        upi_name: upiName ? upiName.trim() : null,
        upi_qr_url: upiQrUrl ? upiQrUrl.trim() : null,
        auto_verify_upi: Boolean(autoVerifyUpi),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, title, registration_fee, upi_id, upi_name, upi_qr_url, auto_verify_upi')
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Event UPI & registration fee configuration updated successfully!',
      event: updatedEvent,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
