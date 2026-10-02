import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { verifyRazorpaySignature } from '@/lib/payments/razorpay'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      invoiceId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = body

    if (!invoiceId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: 'Missing required Razorpay payment signature fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Verify HMAC SHA-256 signature
    const isValid = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    })

    if (!isValid) {
      return NextResponse.json(
        { error: 'Payment signature verification failed. Untrusted payment.' },
        { status: 400 }
      )
    }

    // 2. Update invoice status to 'paid'
    const serviceClient = getServiceSupabase()
    const { data: updatedInvoice, error: invErr } = await serviceClient
      .from('invoices')
      .update({
        status: 'paid',
      })
      .eq('id', invoiceId)
      .select()
      .single()

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 })
    }

    // 3. Update payment status to 'captured'
    await serviceClient
      .from('payments')
      .update({
        status: 'captured',
        gateway_payment_id: razorpayPaymentId,
        gateway_signature: razorpaySignature,
        updated_at: new Date().toISOString(),
      })
      .eq('invoice_id', invoiceId)

    return NextResponse.json({
      success: true,
      message: 'Payment verified and captured successfully!',
      invoice: updatedInvoice,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
