'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Search, Hash, ArrowLeft, ArrowRight, CheckCircle2, Lock, Layers } from 'lucide-react'

export default function VerifyPortalPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [publishedEvents, setPublishedEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadPublishedEvents() {
      try {
        const res = await fetch('/api/events')
        if (res.ok) {
          const data = await res.json()
          const pub = (data.events || []).filter((e: any) => e.status === 'published' || e.anchored_merkle_root)
          setPublishedEvents(pub)
        }
      } catch {
        // ignore in public mode
      }
    }
    loadPublishedEvents()
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/verify/${trimmed}`)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              FairPitch Public Audit Ledger
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                Public / No Auth Required
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Independent Cryptographic Verification</p>
          </div>
        </div>

        <Link
          href="/login"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </Link>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 space-y-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <Hash className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-slate-100 mb-2">
            Verify Event Cryptographic Proofs
          </h2>

          <p className="text-xs text-slate-400 max-w-lg mx-auto mb-8">
            FairPitch anchors every judge score into an immutable SHA-256 hash chain and computes an event-wide binary Merkle root with odd-leaf duplication at publication time. Enter an event ID below to audit the full cryptographic ledger.
          </p>

          <form onSubmit={handleSearch} className="max-w-xl mx-auto flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter Event ID (e.g. UUID)..."
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Verify Ledger
            </button>
          </form>

          <div className="text-left bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-2 max-w-xl mx-auto">
            <div className="font-semibold text-slate-300">How Dual-Layer Verification Operates:</div>
            <p>1. <strong>Per-Judge Hash Chains:</strong> Each judge's scores form a serial SHA-256 chain under advisory lock.</p>
            <p>2. <strong>Merkle Tree Aggregation:</strong> At publication, all chain heads are aggregated via a binary Merkle tree with odd-leaf node duplication.</p>
            <p>3. <strong>Immutable Database Anchor:</strong> Once set, the root is cryptographically frozen against post-hoc tampering.</p>
          </div>
        </div>

        {/* Published Events Available for Inspection */}
        {publishedEvents.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">
              Published Events Ready for Verification:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {publishedEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/verify/${ev.id}`}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                        Anchored Proof
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {ev.id.slice(0, 8)}...
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                      {ev.title}
                    </h4>
                    {ev.anchored_merkle_root && (
                      <span className="text-[10px] font-mono text-slate-500 truncate block mt-1">
                        Root: {ev.anchored_merkle_root.slice(0, 20)}...
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-indigo-400 font-semibold mt-3 pt-2 border-t border-slate-800/80">
                    <span>Inspect Cryptographic Ledger</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
