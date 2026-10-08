import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireEventOrganizer } from '@/lib/auth/guards'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const auth = await requireEventOrganizer(eventId)
    if (auth.errorResponse) return auth.errorResponse

    const supabase = await createClient()


    const serviceClient = getServiceSupabase()

    // Fetch invoices and payments for this event
    const [invoicesRes, paymentsRes] = await Promise.all([
      serviceClient
        .from('invoices')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      serviceClient
        .from('payments')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
    ])

    const invoices = invoicesRes.data || []
    const payments = paymentsRes.data || []

    // Determine active tier based on paid invoices
    let activeTier = 'starter'
    const paidInvoices = invoices.filter((i) => i.status === 'paid')
    if (paidInvoices.some((i) => Number(i.total_amount) >= 14000)) {
      activeTier = 'enterprise'
    } else if (paidInvoices.some((i) => Number(i.total_amount) >= 4000)) {
      activeTier = 'pro'
    }

    return NextResponse.json({
      success: true,
      activeTier,
      invoices,
      payments,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
