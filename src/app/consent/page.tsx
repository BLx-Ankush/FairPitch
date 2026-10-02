'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck, FileText, CheckCircle2, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { CURRENT_CONSENT_VERSION } from '@/lib/auth/roles'

function ConsentForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const consentText = `I agree to the FairPitch Data Processing Agreement in compliance with the Digital Personal Data Protection (DPDP) Act, 2023. I understand that:
1. Evaluation Telemetry: My scores, submissions, or rubrics will be recorded and cryptographically hashed into an immutable SHA-256 audit ledger.
2. AI Loss Autopsies: Team submission metadata and anonymized rubric deltas will be evaluated by Google Gemini AI to generate constructive feedback diagnostics.
3. Verification Proof: Anonymized Merkle roots and public score distributions will be published for verifiable fairness auditing.
4. Data Integrity: No direct score deletions or tampering can occur after submission without an auditable revision trail.`

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    if (!accepted) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentVersion: CURRENT_CONSENT_VERSION,
          consentText,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record consent')
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving consent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl shadow-black/50 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Data Protection & Fair Auditing Consent
              </h2>
              <p className="text-xs text-slate-400">
                DPDP Act Compliance &middot; Version {CURRENT_CONSENT_VERSION}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            FairPitch utilizes high-integrity cryptographic audit trails to guarantee fair, tamper-evident evaluations for all participants. Please review and confirm your agreement before continuing.
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-5 text-xs text-slate-400 space-y-3 max-h-56 overflow-y-auto">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">Cryptographic Append-Only Ledger:</strong>
                <p className="mt-0.5 text-slate-400">All evaluations and score revisions are linked in SHA-256 hash chains. Previous records cannot be deleted or rewritten.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">AI Loss Autopsy & Diagnostic Feedback:</strong>
                <p className="mt-0.5 text-slate-400">Rubric disparities are analyzed by Gemini AI to produce constructive gap analyses for non-winning teams.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">Audit Proof Publication:</strong>
                <p className="mt-0.5 text-slate-400">At the conclusion of judging, an anchored Merkle root is publicly published to prove rankings were calculated faithfully.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAccept} className="space-y-4">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-300 leading-normal">
                I have read and consent to the recording of evaluation data and cryptographic ledger anchoring under the DPDP guidelines.
              </span>
            </label>

            <button
              type="submit"
              disabled={!accepted || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Recording consent...</span>
                </>
              ) : (
                <>
                  <span>Accept and Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading consent terms...</div>}>
      <ConsentForm />
    </Suspense>
  )
}
