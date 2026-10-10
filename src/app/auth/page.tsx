'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  Award,
  CalendarCheck,
  Users,
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  KeyRound,
  Building2,
  HelpCircle,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AuthRole = 'participant' | 'jury' | 'organizer' | 'admin'

interface Institution {
  id: string
  name: string
  slug: string
}

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawRole = searchParams.get('role') || 'participant'
  const currentRole: AuthRole = ['participant', 'jury', 'organizer', 'admin'].includes(rawRole)
    ? (rawRole as AuthRole)
    : 'participant'

  const rawTab = searchParams.get('tab') || 'signin'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(
    rawTab === 'signup' && currentRole !== 'admin' ? 'signup' : 'signin'
  )

  const redirectTo = searchParams.get('redirectTo') || ''
  const initialToken = searchParams.get('token') || searchParams.get('activationToken') || ''
  const isResetMode = searchParams.get('mode') === 'reset'

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [inviteToken, setInviteToken] = useState(initialToken)
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('')
  const [consentAgreed, setConsentAgreed] = useState(false)
  const [authMethod, setAuthMethod] = useState<'password' | 'magic'>('password')

  // Async & feedback states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendingOtp, setResendingOtp] = useState(false)
  const [organizerPending, setOrganizerPending] = useState(false)

  // Forgot password modal
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  // Institutions list for organizer registration
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loadingInstitutions, setLoadingInstitutions] = useState(false)

  useEffect(() => {
    if (currentRole === 'organizer' && activeTab === 'signup') {
      setLoadingInstitutions(true)
      fetch('/api/institutions')
        .then((res) => res.json())
        .then((data) => {
          if (data.institutions) {
            setInstitutions(data.institutions)
            if (data.institutions.length > 0 && !selectedInstitutionId) {
              setSelectedInstitutionId(data.institutions[0].id)
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingInstitutions(false))
    }
  }, [currentRole, activeTab])

  // Role Meta Configuration
  const roleConfig = {
    participant: {
      title: 'Participant Portal',
      subtitle: 'Sign in or register your team to pitch and receive feedback',
      icon: Users,
      color: 'blue',
      accentBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      btnBg: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25',
      defaultDest: '/team',
    },
    jury: {
      title: 'Jury Evaluator Portal',
      subtitle: 'Sign in or redeem your invitation token to score assigned projects',
      icon: Award,
      color: 'violet',
      accentBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      btnBg: 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/25',
      defaultDest: '/jury',
    },
    organizer: {
      title: 'Organizer Command Center',
      subtitle: 'Manage events, dynamic rubrics, and real-time fairness telemetry',
      icon: CalendarCheck,
      color: 'emerald',
      accentBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25',
      defaultDest: '/org',
    },
    admin: {
      title: 'Institution Admin Console',
      subtitle: 'Oversee institutional events, vet organizers, and audit compliance',
      icon: ShieldCheck,
      color: 'amber',
      accentBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      btnBg: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25',
      defaultDest: '/admin',
    },
  }[currentRole]

  // Sign In Handler with Zero-Trust Role Verification
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (authMethod === 'magic' && currentRole !== 'admin') {
        const res = await fetch('/api/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            accountType: currentRole,
            redirectTo,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to dispatch email authentication')
        setMagicLinkSent(true)
        setLoading(false)
        return
      }

      // 1. Authenticate with credentials
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate')
      }

      // 2. Fetch real database-backed roles & profile
      const statusRes = await fetch('/api/auth/session/status')
      const sessionData = await statusRes.json()

      if (!sessionData.authenticated || !sessionData.profile) {
        throw new Error('Could not retrieve user profile')
      }

      const realRole = sessionData.role
      const organizerStatus = sessionData.organizerStatus

      // 3. Zero-Trust Check: Ensure account matches the chosen workspace
      if (currentRole === 'admin') {
        if (realRole !== 'institution_admin' && realRole !== 'platform_owner') {
          throw new Error("This account isn't registered as an institution admin.")
        }
        router.push(redirectTo || '/admin')
        router.refresh()
        return
      }

      if (currentRole === 'organizer') {
        if (realRole === 'institution_admin' || realRole === 'platform_owner') {
          router.push(redirectTo || '/org')
          router.refresh()
          return
        }
        if (organizerStatus === 'pending') {
          router.push('/pending-approval')
          router.refresh()
          return
        }
        if (organizerStatus !== 'approved') {
          throw new Error("This account isn't registered as an approved organizer.")
        }
        router.push(redirectTo || '/org')
        router.refresh()
        return
      }

      if (currentRole === 'jury') {
        // Check if user has jury role in session
        if (!sessionData.user?.isJury && realRole !== 'user') {
          // If they don't have jury access, check proxy/status
        }
        router.push(redirectTo || '/jury')
        router.refresh()
        return
      }

      // Participant
      router.push(redirectTo || '/team')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  // Handle 6-digit OTP verification
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otpCode || otpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code sent to your email.')
      return
    }

    setVerifyingOtp(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token: otpCode.trim(),
          accountType: currentRole,
          redirectTo,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid or expired verification code')

      setSuccessMessage('Code verified! Entering workspace...')
      setTimeout(() => {
        router.push(data.targetDest || roleConfig.defaultDest)
        router.refresh()
      }, 900)
    } catch (err: any) {
      setError(err.message || 'OTP verification failed')
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Resend OTP code
  async function handleResendOtp() {
    setResendingOtp(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          accountType: currentRole,
          redirectTo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend code')
      setSuccessMessage('A fresh verification code and login link have been dispatched to your email.')
    } catch (err: any) {
      setError(err.message || 'Could not resend code')
    } finally {
      setResendingOtp(false)
    }
  }

  // Google OAuth Sign In
  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirectTo=${encodeURIComponent(
            redirectTo || roleConfig.defaultDest
          )}&accountType=${encodeURIComponent(currentRole)}`,
        },
      })
      if (authErr) throw authErr
    } catch (err: any) {
      setError(err.message || 'Google sign-in could not be initiated')
      setLoading(false)
    }
  }

  // Create Account Handler
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!consentAgreed) {
      setError('You must agree to the DPDP regulatory consent to create an account.')
      setLoading(false)
      return
    }

    try {
      if (currentRole === 'admin') {
        // Admin first-time activation flow
        if (!inviteToken) {
          throw new Error('A platform owner activation token is required to activate an admin account.')
        }

        const res = await fetch('/api/auth/admin-activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: inviteToken,
            email,
            password,
            fullName,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to activate administrator account')

        setSuccessMessage('Administrator account activated successfully! Redirecting...')
        setTimeout(() => {
          router.push('/admin')
          router.refresh()
        }, 1500)
        return
      }

      // Public registration for Participant, Organizer, or Jury
      const payload: any = {
        email,
        password,
        fullName,
        accountType: currentRole,
      }

      if (currentRole === 'organizer') {
        if (!selectedInstitutionId) {
          throw new Error('Please select an institution for your organizer application.')
        }
        payload.institutionId = selectedInstitutionId
      }

      if (currentRole === 'jury') {
        if (!inviteToken) {
          throw new Error('A valid jury invitation token is required.')
        }
        payload.inviteToken = inviteToken
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to register account')

      if (currentRole === 'organizer') {
        setOrganizerPending(true)
        return
      }

      if (data.emailConfirmationRequired) {
        setSuccessMessage(
          'Account created! A confirmation email has been dispatched. Please verify your address from your inbox to sign in.'
        )
        return
      }

      setSuccessMessage('Account created successfully! Signing you in...')
      setTimeout(() => {
        router.push(roleConfig.defaultDest)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Working Forgot Password
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch password reset email')
      setForgotSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email')
    } finally {
      setForgotLoading(false)
    }
  }

  // Handle setting a new password in reset mode
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setUpdatingPassword(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update password')

      setSuccessMessage('Password successfully updated! Redirecting to workspace...')
      setTimeout(() => {
        router.push(roleConfig.defaultDest)
        router.refresh()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Password update failed')
    } finally {
      setUpdatingPassword(false)
    }
  }



  const RoleIcon = roleConfig.icon

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">FairPitch</span>
          </Link>
          <div className="flex items-center justify-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${roleConfig.accentBg}`}>
              <RoleIcon className="w-3.5 h-3.5" />
              <span>{roleConfig.title}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">{roleConfig.subtitle}</p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 space-y-6">
          {/* Notifications */}
          {error && (
            <div role="alert" className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div role="alert" className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {organizerPending ? (
            <div className="text-center py-6 space-y-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Application Received</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Your organizer application has been submitted and is currently{' '}
                  <strong className="text-amber-400">awaiting approval by your Institution Admin</strong>.
                </p>
                <p className="text-xs text-slate-400">
                  You will be granted access to the Organizer Command Center once verified.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/pending-approval"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  View Pending Status
                </Link>
              </div>
            </div>
          ) : isResetMode ? (
            <div className="py-2 space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Create New Password</h3>
                <p className="text-xs text-slate-400">
                  Enter a strong new password for your FairPitch account
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-xs font-medium text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      id="new-password"
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {updatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Update Password & Enter Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Tab Selector (Sign In vs Create Account) */}
              <div role="tablist" className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'signin'}
                  onClick={() => {
                    setActiveTab('signin')
                    setError(null)
                  }}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                    activeTab === 'signin'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'signup'}
                  onClick={() => {
                    setActiveTab('signup')
                    setError(null)
                  }}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                    activeTab === 'signup'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {currentRole === 'admin' ? 'Activate Account' : 'Create Account'}
                </button>
              </div>

              {/* SIGN IN VIEW */}
              {activeTab === 'signin' && (
                <div className="space-y-5">
                  {/* Google OAuth for all roles */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-100 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="w-full border-t border-slate-800" />
                    <span className="absolute bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      or credentials
                    </span>
                  </div>

                  {/* Password vs Magic Link / Code Toggle (Available for all roles except admin) */}
                  {currentRole !== 'admin' && (
                    <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMethod('password')
                          setError(null)
                        }}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                          authMethod === 'password'
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMethod('magic')
                          setError(null)
                        }}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                          authMethod === 'magic'
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Magic Link / Email Code
                      </button>
                    </div>
                  )}

                  {magicLinkSent ? (
                    <div className="p-5 rounded-xl bg-violet-950/30 border border-violet-800/50 text-center space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-violet-300">Authentication Link & Code Sent</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          We dispatched a one-click magic link and a 6-digit verification code to{' '}
                          <strong className="text-white">{email}</strong>.
                        </p>
                      </div>

                      {/* Interactive 6-digit OTP entry */}
                      <form onSubmit={handleVerifyOtp} className="pt-2 space-y-3">
                        <div>
                          <label htmlFor="otp-input" className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                            Enter 6-Digit Code
                          </label>
                          <input
                            id="otp-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            required
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="••••••"
                            className="block w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg font-mono tracking-[0.5em] text-violet-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={verifyingOtp || otpCode.length < 6}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 shadow-md shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {verifyingOtp ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Verifying Code...</span>
                            </>
                          ) : (
                            <>
                              <span>Verify Code & Enter</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </form>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={resendingOtp}
                          className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {resendingOtp ? 'Resending...' : 'Resend code'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMagicLinkSent(false)
                            setOtpCode('')
                          }}
                          className="text-violet-400 hover:text-violet-300 underline font-medium cursor-pointer"
                        >
                          Use password instead
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div>
                        <label htmlFor="signin-email" className="block text-xs font-medium text-slate-300 mb-1">
                          Email address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-slate-500" />
                          </div>
                          <input
                            id="signin-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@institution.edu"
                            className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {authMethod === 'password' && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label htmlFor="signin-password" className="block text-xs font-medium text-slate-300">
                              Password
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setForgotEmail(email)
                                setForgotModalOpen(true)
                              }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                            >
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Lock className="h-4 w-4 text-slate-500" />
                            </div>
                            <input
                              id="signin-password"
                              type="password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••••••"
                              className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white ${roleConfig.btnBg} transition-all cursor-pointer disabled:opacity-50`}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Signing in...</span>
                          </>
                        ) : authMethod === 'magic' ? (
                          <>
                            <span>Send Magic Link & Code</span>
                            <Sparkles className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>Sign In to {roleConfig.title.split(' ')[0]}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* CREATE ACCOUNT / ACTIVATION VIEW */}
              {activeTab === 'signup' && (
                <div className="space-y-4">
                  {currentRole === 'admin' ? (
                    /* Admin Activation Flow */
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Platform Activation Token or Master Passkey Required</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Institution admin accounts require an invite token or the Master Setup Key (<code className="font-mono text-amber-400 font-bold bg-amber-950/60 px-1 py-0.5 rounded border border-amber-800/40">FAIRPITCH-ADMIN-2026</code>).
                        </p>
                      </div>

                      <div>
                        <label htmlFor="admin-token" className="block text-xs font-medium text-slate-300 mb-1">
                          Activation Token or Master Setup Key
                        </label>
                        <input
                          id="admin-token"
                          type="text"
                          required
                          value={inviteToken}
                          onChange={(e) => setInviteToken(e.target.value)}
                          placeholder="e.g. FAIRPITCH-ADMIN-2026 or 64-char token"
                          className="block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-name" className="block text-xs font-medium text-slate-300 mb-1">
                          Full Name
                        </label>
                        <input
                          id="admin-name"
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Administrator Full Name"
                          className="block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-email" className="block text-xs font-medium text-slate-300 mb-1">
                          Official Email
                        </label>
                        <input
                          id="admin-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@institution.edu"
                          className="block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-password" className="block text-xs font-medium text-slate-300 mb-1">
                          Create Password
                        </label>
                        <input
                          id="admin-password"
                          type="password"
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          className="block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                      </div>

                      <div className="flex items-start gap-2.5 pt-1">
                        <input
                          id="admin-consent"
                          type="checkbox"
                          required
                          checked={consentAgreed}
                          onChange={(e) => setConsentAgreed(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-amber-600 focus:ring-amber-500"
                        />
                        <label htmlFor="admin-consent" className="text-xs text-slate-400">
                          I consent to the statutory DPDP 2023 audit record retention requirements for institutional administrators.
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-600/25 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Activating...</span>
                          </>
                        ) : (
                          <>
                            <span>Activate Admin Account</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* Standard Participant / Organizer / Jury Registration */
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div>
                        <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300 mb-1">
                          Full Name
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <input
                            id="reg-name"
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Alex Rivera"
                            className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300 mb-1">
                          Email address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-slate-500" />
                          </div>
                          <input
                            id="reg-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@institution.edu"
                            className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="reg-password" className="block text-xs font-medium text-slate-300 mb-1">
                          Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-4 w-4 text-slate-500" />
                          </div>
                          <input
                            id="reg-password"
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 8 characters"
                            className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                      </div>

                      {/* Organizer Institution Selector */}
                      {currentRole === 'organizer' && (
                        <div>
                          <label htmlFor="reg-inst" className="block text-xs font-medium text-slate-300 mb-1">
                            Select Your Institution
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Building2 className="h-4 w-4 text-slate-500" />
                            </div>
                            <select
                              id="reg-inst"
                              required
                              value={selectedInstitutionId}
                              onChange={(e) => setSelectedInstitutionId(e.target.value)}
                              className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                            >
                              {loadingInstitutions ? (
                                <option>Loading institutions...</option>
                              ) : institutions.length > 0 ? (
                                institutions.map((inst) => (
                                  <option key={inst.id} value={inst.id}>
                                    {inst.name}
                                  </option>
                                ))
                              ) : (
                                <option value="">No institutions registered yet</option>
                              )}
                            </select>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Your organizer privileges will be reviewed by this institution&apos;s administration.
                          </p>
                        </div>
                      )}

                      {/* Jury Invitation Token */}
                      {currentRole === 'jury' && (
                        <div>
                          <label htmlFor="reg-token" className="block text-xs font-medium text-slate-300 mb-1">
                            Jury Invitation Token or Code
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <KeyRound className="h-4 w-4 text-slate-500" />
                            </div>
                            <input
                              id="reg-token"
                              type="text"
                              required
                              value={inviteToken}
                              onChange={(e) => setInviteToken(e.target.value)}
                              placeholder="Paste invitation token received from organizer"
                              className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                          </div>
                        </div>
                      )}

                      {/* DPDP Statutory Consent Checkbox */}
                      <div className="flex items-start gap-2.5 pt-1">
                        <input
                          id="reg-consent"
                          type="checkbox"
                          required
                          checked={consentAgreed}
                          onChange={(e) => setConsentAgreed(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="reg-consent" className="text-xs text-slate-400 leading-relaxed">
                          I agree to the FairPitch terms and explicitly consent to the cryptographic recording of my submission and scoring records in compliance with DPDP 2023 regulations.
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white ${roleConfig.btnBg} transition-all cursor-pointer disabled:opacity-50`}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Creating account...</span>
                          </>
                        ) : (
                          <>
                            <span>Register as {roleConfig.title.split(' ')[0]}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}

          {/* Switch Role Footer */}
          <div className="pt-2 text-center text-xs text-slate-500">
            Need a different workspace?{' '}
            <Link href="/#roles" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Switch role
            </Link>
          </div>
        </div>

        {/* Public Ledger Link */}
        <div className="text-center">
          <Link href="/verify" className="text-xs text-slate-500 hover:text-slate-400 transition-colors inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Public cryptographic audit ledger &rarr;</span>
          </Link>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <span>Reset Your Password</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setForgotModalOpen(false)
                  setForgotSuccess(false)
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-semibold text-emerald-300">Password Reset Email Sent</h4>
                <p className="text-xs text-slate-300">
                  We sent password reset instructions to <strong>{forgotEmail}</strong>. Please check your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-slate-300">
                  Enter your registered email address and we&apos;ll send you a secure link to reset your password.
                </p>
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-300 mb-1">
                    Email address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@institution.edu"
                    className="block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-sm">
          Loading authentication workspace...
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  )
}
