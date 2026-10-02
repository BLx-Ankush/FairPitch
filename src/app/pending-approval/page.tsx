'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ShieldAlert, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react'

export default function PendingApprovalPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  async function checkStatus() {
    setChecking(true)
    setStatusMessage(null)

    try {
      const res = await fetch('/api/auth/session/status')
      if (res.ok) {
        const data = await res.json()
        if (data.organizerStatus === 'approved') {
          setStatusMessage('Your account has been approved! Redirecting...')
          setTimeout(() => router.push('/org'), 1200)
          return
        }
      }
      setStatusMessage('Your application is still under review by your Institution Administrator.')
    } catch {
      setStatusMessage('Unable to check status at this time. Please try again later.')
    } finally {
      setChecking(false)
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl shadow-black/50 rounded-2xl border border-slate-800 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Clock className="w-7 h-7 animate-pulse" />
          </div>

          <h2 className="text-xl font-bold text-slate-100">
            Account Pending Approval
          </h2>
          
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Your Event Organizer account has been registered and is currently queued for review. In accordance with FairPitch multi-tenant security policies, an Institution Administrator must verify and approve your account before event management is unlocked.
          </p>

          <div className="my-6 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-left">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium mb-1">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Current Status: Pending Admin Review</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Notification has been queued to your institution administrator. Once approved, you can create and manage hackathon judging rubrics.
            </p>
          </div>

          {statusMessage && (
            <div className="mb-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={checkStatus}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking Status...' : 'Check Approval Status'}</span>
            </button>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-400 bg-slate-950 hover:bg-slate-800 hover:text-slate-200 border border-slate-800 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
