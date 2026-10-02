'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Users,
  Award,
  CalendarCheck,
  CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const urlError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(urlError || null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password')

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      })
      if (authErr) throw authErr
    } catch (err: any) {
      setError(err.message || 'Google sign-in could not be initiated')
      setLoading(false)
    }
  }

  async function handleDemoLogin(role: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(data.destination || redirectTo)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Demo sign-in failed')
      setLoading(false)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate')
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center gap-2 mb-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              FairPitch
            </span>
          </Link>
        </div>
        <h2 className="text-center text-xl font-semibold text-slate-300">
          Sign in to your account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Auditable, cryptographically-proven event judging
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0 space-y-6">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl shadow-black/50 sm:rounded-2xl border border-slate-800">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 text-slate-100 border border-slate-700/80 font-semibold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold">
              <span className="bg-slate-900 px-3 text-slate-400">
                Or Quick Demo Access
              </span>
            </div>
          </div>

          {/* 2. One-Click Demo Role Switcher */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              type="button"
              onClick={() => handleDemoLogin('participant')}
              disabled={loading}
              className="p-3 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold mb-0.5">
                <Users className="w-3.5 h-3.5" />
                <span>Participant</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">Ada (Team Desk)</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin('organizer')}
              disabled={loading}
              className="p-3 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Organizer</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">Kavita (UPI & Org)</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin('jury')}
              disabled={loading}
              className="p-3 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/50 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-violet-400 text-xs font-bold mb-0.5">
                <Award className="w-3.5 h-3.5" />
                <span>Jury Judge</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">Dr. Vance (Scoring)</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin('institution_admin')}
              disabled={loading}
              className="p-3 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Inst. Admin</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">Dean Lin (Vetting)</div>
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold">
              <span className="bg-slate-900 px-3 text-slate-400">
                Or Sign In With Credentials
              </span>
            </div>
          </div>

          {/* Mode switch (Password / Magic Link) */}
          <div className="flex rounded-lg bg-slate-950 p-1 mb-5 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password')
                setError(null)
              }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                authMode === 'password'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic')
                setError(null)
              }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                authMode === 'magic'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Magic Link (Jury)
            </button>
          </div>

          {magicLinkSent ? (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-center">
              <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-emerald-300">Check your email</h3>
              <p className="mt-1 text-xs text-slate-400">
                We sent a secure sign-in magic link to{' '}
                <strong className="text-slate-200">{email}</strong>.
              </p>
              <button
                type="button"
                onClick={() => setMagicLinkSent(false)}
                className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
              >
                Sign in with another email
              </button>
            </div>
          ) : authMode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@institution.edu"
                    className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setMagicLinkSent(true)
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Jury / Evaluator Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="judge@institution.edu"
                    className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  We'll send a passwordless one-click authentication link.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
              >
                <span>Send Magic Link</span>
                <Sparkles className="w-4 h-4 text-indigo-300" />
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Create an account
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/verify" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
            Public cryptographic audit ledger &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
