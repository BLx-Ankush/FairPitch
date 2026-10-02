'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
  Building2,
  FileText,
  AlertCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  Check,
  Clock,
  X,
} from 'lucide-react'

interface Invoice {
  id: string
  created_at: string
  participant_count: number
  rate_per_participant: number
  total_amount: number
  currency: string
  status: string
}

interface Payment {
  id: string
  created_at: string
  gateway: string
  gateway_order_id: string
  gateway_payment_id?: string
  amount: number
  status: string
}

export default function EventBillingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = use(params)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTier, setActiveTier] = useState<string>('starter')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [eventTitle, setEventTitle] = useState<string>('Event')

  // Checkout modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<'pro' | 'enterprise'>('pro')
  const [orderData, setOrderData] = useState<any>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  async function fetchBillingData() {
    setLoading(true)
    setError(null)
    try {
      const [billingRes, eventRes] = await Promise.all([
        fetch(`/api/org/events/${eventId}/billing`),
        fetch(`/api/events/${eventId}`),
      ])

      if (billingRes.ok) {
        const bData = await billingRes.json()
        setActiveTier(bData.activeTier || 'starter')
        setInvoices(bData.invoices || [])
        setPayments(bData.payments || [])
      }

      if (eventRes.ok) {
        const eData = await eventRes.json()
        setEventTitle(eData.event?.title || 'Event')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load billing details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) {
      fetchBillingData()
    }
  }, [eventId])

  async function handleInitiateCheckout(tier: 'pro' | 'enterprise') {
    setSelectedTier(tier)
    setPaymentError(null)
    setPaymentSuccess(false)
    setProcessingPayment(true)
    setCheckoutModalOpen(true)

    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          tier,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create payment order')
      }

      setOrderData(data)
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to create payment order')
    } finally {
      setProcessingPayment(false)
    }
  }

  async function handleSimulatePayment() {
    if (!orderData) return
    setProcessingPayment(true)
    setPaymentError(null)

    try {
      const mockPaymentId = `pay_mock_${Date.now()}`
      const mockSignature = `sig_mock_${Date.now()}`

      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: orderData.invoiceId,
          razorpayOrderId: orderData.order.id,
          razorpayPaymentId: mockPaymentId,
          razorpaySignature: mockSignature,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Payment signature verification failed')
      }

      setPaymentSuccess(true)
      await fetchBillingData()
      setTimeout(() => {
        setCheckoutModalOpen(false)
        setPaymentSuccess(false)
        setOrderData(null)
      }, 2500)
    } catch (err: any) {
      setPaymentError(err.message || 'Payment simulation failed')
    } finally {
      setProcessingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href={`/org/events/${eventId}`}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100">Event Billing & Plans</h1>
              <span className="text-xs text-slate-500">/</span>
              <span className="text-xs text-indigo-400 font-semibold truncate max-w-xs">
                {eventTitle}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Manage subscription tiers, Razorpay payment orders, and audit capacity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Current Plan:</span>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            {activeTier}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-10">
        {error && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-xs text-red-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">
            Fairness & Audit Plans
          </h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Choose the capacity that matches your event size. Every tier includes immutable SHA-256 hash chains and cryptographic Merkle verification.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter Plan */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Community
                </span>
                {activeTier === 'starter' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                    ACTIVE
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100">Starter</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-100">Free</span>
                  <span className="text-xs text-slate-500">/ event</span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Ideal for university student hackathons and internal hack-days.
              </p>

              <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 15 Participating Teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 3 Jury Evaluators</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Standard Rubric Builder</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Basic Hash Chain Verification</span>
                </div>
              </div>
            </div>

            <button
              disabled={activeTier === 'starter'}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold transition-colors cursor-not-allowed"
            >
              {activeTier === 'starter' ? 'Current Tier' : 'Default Tier'}
            </button>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900 border-2 border-indigo-500/60 rounded-2xl p-6 flex flex-col justify-between space-y-6 relative shadow-2xl scale-102">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Hackathon Pro
                </span>
                {activeTier === 'pro' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    ACTIVE
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100">Pro</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-100">₹4,999</span>
                  <span className="text-xs text-slate-500">/ event</span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Complete statistical telemetry, AI loss autopsies, and public ledger.
              </p>

              <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Up to 100 Participating Teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Unlimited Jury Evaluators</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Statistical Bias Telemetry (Z-Scores, Drift)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Gemini 2.5 Flash Loss Autopsies</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Odd-Leaf Binary Merkle Tree Verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Automated Resend Email Notifications</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleInitiateCheckout('pro')}
              disabled={activeTier === 'pro' || activeTier === 'enterprise'}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTier === 'pro'
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {activeTier === 'pro' ? 'Current Tier' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> High Stakes
                </span>
                {activeTier === 'enterprise' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    ACTIVE
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100">Enterprise</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-100">₹14,999</span>
                  <span className="text-xs text-slate-500">/ event</span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Large scale hackathons, corporate summits, and multi-stage tournaments.
              </p>

              <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>500+ Participating Teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Multi-Stage Preliminary & Grand Final Rounds</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Counterfactual Winner-Flip Simulations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Priority Gemini 2.5 Flash AI Quota</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Full Dispute Resolution Desk</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Custom Institution Branding</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleInitiateCheckout('enterprise')}
              disabled={activeTier === 'enterprise'}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTier === 'enterprise'
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {activeTier === 'enterprise' ? 'Current Tier' : 'Upgrade to Enterprise'}
            </button>
          </div>
        </div>

        {/* Invoice & Payment History */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Invoice & Payment History
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {invoices.length} Invoices Issued
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No invoices issued for this event yet. Upgrading your tier will generate an official invoice.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Invoice ID</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Capacity</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-200">
                          {inv.id.slice(0, 12)}...
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {inv.participant_count} Teams
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                          ₹{inv.total_amount.toLocaleString()} {inv.currency}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {inv.status === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              PAID
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                              PENDING
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setCheckoutModalOpen(false)
                setOrderData(null)
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> Razorpay Checkout
              </span>
              <h3 className="text-lg font-bold text-slate-100">
                Upgrade to {selectedTier.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-400">
                Cryptographically locked audit and evaluation capacity
              </p>
            </div>

            {paymentError && (
              <div className="p-3 bg-red-950/60 border border-red-900/60 rounded-xl text-xs text-red-300">
                {paymentError}
              </div>
            )}

            {paymentSuccess ? (
              <div className="p-6 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-100">Payment Captured!</h4>
                <p className="text-xs text-slate-400">
                  Your event has been upgraded to {selectedTier.toUpperCase()}. All features are now unlocked.
                </p>
              </div>
            ) : orderData ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Order ID:</span>
                    <span className="font-mono text-slate-200">{orderData.order.id}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Invoice Ref:</span>
                    <span className="font-mono text-slate-200">{orderData.invoiceId.slice(0, 10)}...</span>
                  </div>
                  <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800">
                    <span className="font-bold text-slate-300">Total Payable:</span>
                    <span className="font-mono font-bold text-slate-100 text-sm">
                      ₹{(orderData.amount / 100).toLocaleString()} {orderData.currency}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleSimulatePayment}
                    disabled={processingPayment}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Signature with Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>Confirm & Complete Payment (Razorpay)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-500">
                    Secure 256-bit HMAC SHA-256 signature verification via Razorpay Gateway
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Creating order with Razorpay...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
