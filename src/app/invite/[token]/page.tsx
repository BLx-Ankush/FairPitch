'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  Mail,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Lock,
  User,
  KeyRound,
} from 'lucide-react'

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<{
    email: string
    role: string
    institutionName?: string
    eventTitle?: string
  } | null>(null)

  // Onboarding form state
  const [tab, setTab] = useState<'create' | 'signin'>('create')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [consentAgreed, setConsentAgreed] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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
          if (data.invite?.email) {
            setFullName(data.invite.email.split('@')[0])
          }
        }
      } catch (err: any) {
        setError(err.message || 'Invitation is invalid or has expired')
      } finally {
        setLoading(false)
      }
    }

    verifyAndRedeem()
  }, [token, router])

  // Instant creation & token activation for new judges / participants
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteData) return

    if (!consentAgreed) {
      setError('You must agree to statutory DPDP regulatory consent to activate your role.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteData.email,
          password,
          fullName,
          accountType: inviteData.role,
          inviteToken: token,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to activate invited account')

      setSuccessMessage('Account activated and invitation accepted! Entering workspace...')
      setRedeemed(true)
      setTimeout(() => {
        router.push(inviteData.role === 'jury' ? '/jury' : '/team')
      }, 1200)
    } catch (err: any) {
      setError(err.message || 'Failed to activate invitation')
    } finally {
      setSubmitting(false)
    }
  }

  // Sign in for existing judges / participants
  async function handleExistingSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteData) return

    setSubmitting(true)
    setError(null)

    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteData.email,
          password,
        }),
      })

      const loginData = await loginRes.json()
      if (!loginRes.ok) throw new Error(loginData.error || 'Authentication failed')

      // Now redeem token for authenticated user
      const redeemRes = await fetch('/api/auth/invite/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const redeemData = await redeemRes.json()
      if (!redeemRes.ok) throw new Error(redeemData.error || 'Could not link invitation to account')

      setSuccessMessage('Invitation linked! Entering workspace...')
      setRedeemed(true)
      setTimeout(() => {
        router.push(redeemData.targetUrl || (inviteData.role === 'jury' ? '/jury' : '/team'))
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Sign in and activation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">FairPitch</span>
          </Link>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-xl py-7 px-6 shadow-2xl shadow-black/50 rounded-2xl border border-slate-800">
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              Event Invitation Activation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cryptographically verified single-use access token
            </p>
          </div>

          {error && (
            <div role="alert" className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-300 mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div role="alert" className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-300 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="my-8 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-400">Verifying cryptographic token...</p>
            </div>
          ) : redeemed ? (
            <div className="my-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-emerald-300">Invitation Accepted!</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Your credentials and role have been linked. Redirecting to workspace...
                </p>
              </div>
            </div>
          ) : inviteData ? (
            <div className="space-y-4">
              {/* Invitation Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800/60 pb-1 mb-1.5">
                  <span>Target Role</span>
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-bold border border-violet-500/25">
                    {inviteData.role.toUpperCase()}
                  </span>
                </div>
                <div className="text-slate-300 flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-200">{inviteData.email}</span>
                </div>
                {inviteData.institutionName && (
                  <div className="text-slate-300 flex items-center justify-between">
                    <span className="text-slate-500">Institution:</span>
                    <span className="text-slate-200 font-medium">{inviteData.institutionName}</span>
                  </div>
                )}
                {inviteData.eventTitle && (
                  <div className="text-slate-300 flex items-center justify-between">
                    <span className="text-slate-500">Event:</span>
                    <span className="text-slate-200 font-medium">{inviteData.eventTitle}</span>
                  </div>
                )}
              </div>

              {/* Tab Selector */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setTab('create')
                    setError(null)
                  }}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
                    tab === 'create'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Set Password & Activate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin')
                    setError(null)
                  }}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
                    tab === 'signin'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Already have account
                </button>
              </div>

              {tab === 'create' ? (
                <form onSubmit={handleCreateAccount} className="space-y-3 pt-1">
                  <div>
                    <label htmlFor="invite-name" className="block text-xs font-medium text-slate-300 mb-1">
                      Your Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        id="invite-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Dr. Alex Mercer"
                        className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="invite-password" className="block text-xs font-medium text-slate-300 mb-1">
                      Set New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        id="invite-password"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-1">
                    <input
                      id="invite-consent"
                      type="checkbox"
                      required
                      checked={consentAgreed}
                      onChange={(e) => setConsentAgreed(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="invite-consent" className="text-[11px] text-slate-400 leading-tight">
                      I agree to statutory DPDP 2023 audit record retention for evaluation and scoring activities.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Activating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Activate & Enter Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleExistingSignIn} className="space-y-3 pt-1">
                  <div>
                    <label htmlFor="signin-invite-password" className="block text-xs font-medium text-slate-300 mb-1">
                      Account Password for {inviteData.email}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        id="signin-invite-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying & Linking...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In & Link Invitation</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
