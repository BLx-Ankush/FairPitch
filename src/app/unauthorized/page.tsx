'use client'

import React, { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ShieldX, ArrowLeft, LogOut, Lock } from 'lucide-react'

function UnauthorizedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') || 'insufficient_permissions'

  const reasonMap: Record<string, string> = {
    admin_privileges_required: 'Access to this route requires Institution Administrator or Platform Owner credentials.',
    organizer_approval_required: 'Your account does not possess approved Event Organizer permissions for this institution.',
    organizer_application_rejected: 'Your application for Event Organizer privileges has been reviewed and declined by the institution administrator.',
    jury_access_required: 'Access to the Jury scoring suite requires an active evaluator assignment or invitation.',
    team_membership_required: 'Access to the Team workspace requires registered participation in this event.',
    insufficient_permissions: 'Your account does not have sufficient privileges to access this protected resource.',
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl shadow-black/50 rounded-2xl border border-slate-800 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
            <ShieldX className="w-7 h-7" />
          </div>

          <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400">
            403 Forbidden
          </span>

          <h2 className="text-xl font-bold text-slate-100 mt-1">
            Access Denied
          </h2>

          <div className="my-5 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">
                {reasonMap[reason] || reasonMap.insufficient_permissions}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-6">
            If you believe this is an error, please contact your institution administrator or switch to an authorized account.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => router.back()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go Back</span>
            </button>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-red-400 bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out & Switch Account</span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300">
              Return to FairPitch Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Checking authorization...</div>}>
      <UnauthorizedContent />
    </Suspense>
  )
}
