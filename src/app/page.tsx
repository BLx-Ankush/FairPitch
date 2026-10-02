'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Award,
  CalendarCheck,
  Users,
  Building2,
  Lock,
  ArrowRight,
  Sparkles,
  Scale,
  Hash,
  QrCode,
  FileCheck2,
  ExternalLink,
  CheckCircle2,
  LogOut,
  User,
} from 'lucide-react'

export default function FairPitchPortalHub() {
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session/status')
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.user) {
            setCurrentUser(data.user)
            setProfile(data.profile)
          }
        }
      } catch {
        // Unauthenticated visitor
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-100 flex items-center gap-2">
              FairPitch
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30">
                Auditable Judging
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Cryptographic Hackathon & Event Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/verify"
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            <Hash className="w-3.5 h-3.5 text-emerald-400" />
            <span>Public Ledger</span>
          </Link>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                {profile?.full_name || currentUser.email}
              </span>
              <Link
                href={
                  profile?.role === 'institution_admin' || profile?.role === 'platform_owner'
                    ? '/admin'
                    : profile?.organizer_approval_status === 'approved'
                    ? '/org'
                    : '/team'
                }
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
              >
                My Workspace
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Role-Segregated Enterprise Architecture
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-100 tracking-tight leading-tight">
            Fair judging, proved by cryptography & explained by AI.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto">
            FairPitch enforces strict database-level separation of duties across <strong>Participants</strong>, <strong>Jury</strong>, <strong>Organizers</strong>, and <strong>Institution Admins</strong>. Every score is audited into an immutable SHA-256 hash chain and anchored with binary Merkle trees.
          </p>
        </div>

        {/* 4 Distinct Role Modes Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Discrete Role Workspaces
            </h3>
            <span className="text-xs text-slate-500">Select a mode to enter its dedicated portal</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Participant Workspace */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-blue-500/40 transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-md">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        Mode 1
                      </span>
                      <h4 className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                        Participant Team Workspace
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/40">
                    /team
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Dedicated portal for competing squads. Pay registration fees directly to organizers via Dynamic UPI QR, unlock event join codes, manage team rosters, submit projects, and inspect Gemini 2.5 Flash AI Loss Autopsies.
                </p>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Dynamic UPI QR (100% direct bank credit, 0% fees)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Join Code roster unlocking upon payment verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Gemini 2.5 Flash Loss Autopsy & 3 high-leverage fixes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Dispute & review clarification ticket submission</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-6">
                <Link
                  href="/team"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all"
                >
                  <span>Enter Participant Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 2. Jury Scoring Workspace */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-violet-500/40 transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-md">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                        Mode 2
                      </span>
                      <h4 className="text-base font-bold text-slate-100 group-hover:text-violet-400 transition-colors">
                        Jury Evaluation Workspace
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-400 border border-violet-800/40">
                    /jury
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Secure evaluation desk for invited evaluators. Evaluates assigned project rosters in balanced sequence, applies rubric dimensions, appends scores under SHA-256 advisory locks, and submits formal score edit requests.
                </p>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Balanced assignment matrix with fatigue drift mitigation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Advisory-locked SHA-256 chain block per score entry</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Blind scoring toggle with confidential qualitative notes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Append-only corrections workflow via v_latest_scores</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-6">
                <Link
                  href="/jury"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-600/20 transition-all"
                >
                  <span>Enter Jury Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 3. Organizer Command Center */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-emerald-500/40 transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md">
                      <CalendarCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Mode 3
                      </span>
                      <h4 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        Organizer Command Center
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                    /org
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Full command cockpit for approved event organizers. Manage forward-only event lifecycles, configure 100% weight-balanced rubrics, run statistical fairness calibrations, approve score corrections, and audit incoming UPI UTRs.
                </p>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Forward-only state transitions & immutable rubric freeze</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Statistical bias telemetry: z-scores, drift & winner flips</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Direct-to-bank UPI QR configuration & 12-digit UTR desk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Dispute appeal ticketing resolution workflow</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-6">
                <Link
                  href="/org"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <span>Enter Organizer Command Center</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 4. Institution Admin Console */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-amber-500/40 transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Mode 4
                      </span>
                      <h4 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                        Institution Admin Console
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40">
                    /admin
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Governance and institution-level administration. Vets and approves event organizers before they can publish hackathons, monitors DPDP compliance consents, and enforces platform-wide auditing standards.
                </p>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Organizer vetting pipeline (pending, approved, rejected)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Institution tenancy management & campus domain policies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>DPDP regulatory consent enforcement before login</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Global audit logs across all events</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-6">
                <Link
                  href="/admin"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition-all"
                >
                  <span>Enter Admin Console</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Public Audit Ledger Banner */}
        <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase tracking-wider">
                Public / No Auth Required
              </span>
              <span className="text-xs font-mono text-slate-400">/verify</span>
            </div>
            <h3 className="text-xl font-black text-slate-100">
              Independent Cryptographic Audit Ledger
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Anyone—participants, sponsors, judges, and external auditors—can inspect any event’s binary Merkle tree root and verify sequential SHA-256 hash chains without signing in.
            </p>
          </div>

          <Link
            href="/verify"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 transition-all shrink-0 cursor-pointer"
          >
            <Hash className="w-4 h-4 text-emerald-300" />
            <span>Audit Event Ledger</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    </div>
  )
}
