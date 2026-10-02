'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Layers,
  Hash,
  Award,
  Download,
  AlertTriangle,
  Lock,
  GitBranch,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface JudgeChain {
  judgeId: string
  judgeName?: string
  isValid: boolean
  totalBlocks: number
  chainHeadHash: string
  errorReason?: string
}

interface VerificationData {
  overallIntegrity: boolean
  isMerkleRootValid: boolean
  areJudgeChainsValid: boolean
  eventChainValid: boolean
  anchoredMerkleRoot: string | null
  computedMerkleRoot: string
  totalAuditBlocks: number
  judgeChains: JudgeChain[]
  chainHeadCount: number
  verifiedAt: string
}

interface EventData {
  id: string
  title: string
  slug: string
  status: string
  anchored_merkle_root: string | null
  anchored_at: string | null
}

export default function PublicVerifyEventPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [verification, setVerification] = useState<VerificationData | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expandedChains, setExpandedChains] = useState<Record<string, boolean>>({})

  async function fetchVerification() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/verify/${eventId}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify cryptographic audit trail')
      }
      setEvent(data.event)
      setVerification(data.verification)
    } catch (err: any) {
      setError(err.message || 'Unable to fetch audit ledger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) {
      fetchVerification()
    }
  }, [eventId])

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  function toggleChainExpand(id: string) {
    setExpandedChains((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handleDownloadProof() {
    if (!verification || !event) return
    const exportData = {
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        anchored_at: event.anchored_at,
      },
      audit_proof: verification,
      specification: {
        algorithm: 'SHA-256 binary Merkle tree',
        odd_leaf_rule: 'Duplicate last leaf when level node count is odd',
        per_judge_chain: 'Sequential block_index with advisory lock serialized SHA-256',
        verifier: 'FairPitch Cryptographic Verification Ledger v1.0',
      },
      timestamp: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fairpitch-proof-${event.slug || event.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <RefreshCw className="w-5 h-5 text-indigo-400 absolute -top-1 -right-1 animate-spin" />
          </div>
          <h2 className="text-base font-bold text-slate-200">
            Auditing Cryptographic Ledger...
          </h2>
          <p className="text-xs text-slate-400">
            Verifying per-judge SHA-256 hash chains and recomputing event binary Merkle tree root with odd-leaf parity...
          </p>
        </div>
      </div>
    )
  }

  if (error || !event || !verification) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-900 border border-red-900/50 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Verification Ledger Error</h2>
          <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded-lg border border-red-900/50 font-mono">
            {error || 'Unable to retrieve cryptographic records for this event'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/verify"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Back to Verify Portal
            </Link>
            <button
              onClick={fetchVerification}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Retry Audit
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isVerified = verification.overallIntegrity
  const rootsMatch =
    Boolean(verification.anchoredMerkleRoot) &&
    verification.anchoredMerkleRoot === verification.computedMerkleRoot

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            href="/verify"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Back to Search Portal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">FairPitch Ledger</span>
              <span className="text-slate-600">/</span>
              <span className="text-xs font-semibold text-indigo-400 truncate max-w-xs">
                {event.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Event ID: {event.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {isVerified ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Cryptographically Verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Integrity Warning / Incomplete</span>
            </div>
          )}

          <button
            onClick={fetchVerification}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Re-verify Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Banner Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100">{event.title}</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {event.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Audit conducted at: {new Date(verification.verifiedAt).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadProof}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export Proof (.json)</span>
            </button>

            {event.status === 'published' && (
              <Link
                href={`/events/${event.id}/results`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                <Award className="w-3.5 h-3.5" />
                <span>View Leaderboard</span>
              </Link>
            )}
          </div>
        </div>

        {/* Dual-Layer Verification Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">
                  Dual-Layer Cryptographic Proof
                </h2>
                <p className="text-[11px] text-slate-400">
                  Advisory-locked per-judge SHA-256 hash chains + anchored binary Merkle root
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-300">
                {verification.totalAuditBlocks}
              </span>
              <span className="text-[11px] text-slate-500 block">Total Audit Blocks</span>
            </div>
          </div>

          {/* Merkle Root Inspection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Anchored Root */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  Anchored Merkle Root (Database Ledger)
                </span>
                {verification.anchoredMerkleRoot ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    LOCKED
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                    PENDING PUBLISH
                  </span>
                )}
              </div>

              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 break-all select-all flex items-center justify-between gap-2">
                <span>{verification.anchoredMerkleRoot || 'Not anchored yet (Event not published)'}</span>
                {verification.anchoredMerkleRoot && (
                  <button
                    onClick={() =>
                      copyToClipboard(verification.anchoredMerkleRoot!, 'anchored')
                    }
                    className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
                    title="Copy Root"
                  >
                    {copiedKey === 'anchored' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500">
                Immutably anchored at publication time. Cannot be altered or deleted.
              </p>
            </div>

            {/* Computed Root */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                  Real-time Recomputed Merkle Root
                </span>
                {rootsMatch ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> MATCHES ANCHOR
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                    MISMATCH / UNPUBLISHED
                  </span>
                )}
              </div>

              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 break-all select-all flex items-center justify-between gap-2">
                <span>{verification.computedMerkleRoot}</span>
                <button
                  onClick={() =>
                    copyToClipboard(verification.computedMerkleRoot, 'computed')
                  }
                  className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
                  title="Copy Root"
                >
                  {copiedKey === 'computed' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Derived directly from {verification.chainHeadCount} active chain heads using binary odd-leaf pairing.
              </p>
            </div>
          </div>

          {/* Integrity Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-3">
              {verification.isMerkleRootValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Merkle Root Match
                </div>
                <div className="text-[10px] text-slate-500">
                  {verification.isMerkleRootValid ? 'Valid 256-bit match' : 'Unpublished or mismatched'}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-3">
              {verification.areJudgeChainsValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Judge Hash Chains
                </div>
                <div className="text-[10px] text-slate-500">
                  {verification.judgeChains.length} chains inspected & intact
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-3">
              {verification.eventChainValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Event-Level Trail
                </div>
                <div className="text-[10px] text-slate-500">
                  Lifecycle transitions unbroken
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Judge Hash Chains Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Individual Judge Cryptographic Chains
              </h2>
              <p className="text-xs text-slate-400">
                Every score submission produces an append-only SHA-256 block pointing to the judge's previous block hash.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {verification.judgeChains.length} Active Jury Chains
            </span>
          </div>

          <div className="space-y-3">
            {verification.judgeChains.length === 0 ? (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                No judge scoring blocks recorded yet for this event.
              </div>
            ) : (
              verification.judgeChains.map((chain, idx) => (
                <div
                  key={chain.judgeId}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-mono font-bold text-indigo-400">
                        J{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-200">
                            {chain.judgeName || `Judge #${idx + 1}`}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-500">
                            ({chain.judgeId.slice(0, 8)}...)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span>{chain.totalBlocks} sequential block{chain.totalBlocks !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-400 truncate max-w-xs">
                            Head: {chain.chainHeadHash.slice(0, 16)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {chain.isValid ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Chain Intact</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Broken Sequence: {chain.errorReason}</span>
                        </div>
                      )}

                      <button
                        onClick={() =>
                          copyToClipboard(chain.chainHeadHash, `head-${chain.judgeId}`)
                        }
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        title="Copy Chain Head Hash"
                      >
                        {copiedKey === `head-${chain.judgeId}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Chain Head Detail */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 bg-slate-950/60 rounded-lg p-2.5 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="text-slate-500">Latest Leaf Hash:</span>
                    <span className="text-indigo-300 font-semibold select-all break-all ml-2">
                      {chain.chainHeadHash}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cryptographic Explainer Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Why FairPitch Proofs Are Mathematically Tamper-Proof
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-300">1. Serial Advisory Locks</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                During scoring, PostgreSQL acquires an advisory lock on the judge's ID. Each score creates an immutable entry whose `prev_hash` points to block $N-1$, preventing concurrent fork attacks.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-300">2. Odd-Leaf Merkle Tree</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                At publish time, all chain heads are ordered lexicographically and paired pairwise. If the number of leaves is odd, the final leaf is duplicated before hashing to the next level.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-300">3. Immutable Anchor</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Once set, `anchored_merkle_root` is locked via database trigger. Even a database administrator cannot alter a single score post-hoc without breaking the 256-bit root verification.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
