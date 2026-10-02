'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Mail, Sparkles, AlertCircle, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function InviteRedemptionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const router = useRouter()
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [redeemed, setRedeemed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<{
    email: string
    role: string
    institutionName?: string
    eventTitle?: string
  } | null>(null)

  useEffect(() => {
    async function verifyAndRedeem() {
      try {
        const res = await fetch('/api/auth/invite/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify invitation token')
        }

        if (data.redeemed) {
          setRedeemed(true)
          setTimeout(() => {
            router.push(data.targetUrl || '/')
          }, 1500)
        } else {
          setInviteData(data.invite)
        }
      } catch (err: any) {
        setError(err.message || 'Invitation is invalid or has expired')
      } finally {
        setLoading(false)
      }
    }

    verifyAndRedeem()
  }, [token, router])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl shadow-black/50 rounded-2xl border border-slate-800 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-slate-100">
            FairPitch Event Invitation
          </h2>

          {loading ? (
            <div className="my-8 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-400">Verifying cryptographic token...</p>
            </div>
          ) : error ? (
            <div className="my-6">
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-300 text-left mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <span>Proceed to login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : redeemed ? (
            <div className="my-6">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-emerald-300">Invitation Accepted!</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Your credentials and role have been linked. Redirecting to workspace...
                </p>
              </div>
            </div>
          ) : inviteData ? (
            <div className="my-6 text-left">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 mb-5">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Invitation Details
                </div>
                <div className="text-xs text-slate-200">
                  <span className="text-slate-400">Invited Role:</span>{' '}
                  <strong className="text-indigo-400 uppercase">{inviteData.role}</strong>
                </div>
                <div className="text-xs text-slate-200">
                  <span className="text-slate-400">Target Email:</span>{' '}
                  <strong className="text-slate-100">{inviteData.email}</strong>
                </div>
                {inviteData.institutionName && (
                  <div className="text-xs text-slate-200">
                    <span className="text-slate-400">Institution:</span> {inviteData.institutionName}
                  </div>
                )}
                {inviteData.eventTitle && (
                  <div className="text-xs text-slate-200">
                    <span className="text-slate-400">Event:</span> {inviteData.eventTitle}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Please sign in to complete your evaluation onboarding:
              </p>

              <Link
                href={`/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                <span>Sign in to Accept Invitation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
