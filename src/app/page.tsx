'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Award,
  CalendarCheck,
  Users,
  ArrowRight,
  Sparkles,
  Scale,
  Hash,
  CheckCircle2,
  FileCheck2,
  Lock,
  Search,
} from 'lucide-react'

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)

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
      }
    }
    checkSession()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
              FairPitch
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/30">
                Auditable Judging
              </span>
            </span>
            <p className="text-xs text-slate-400">Zero-Bias Hackathon & Competition Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/verify"
            className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <Hash className="w-4 h-4 text-emerald-400" />
            <span>Public Ledger</span>
          </Link>

          {currentUser ? (
            <Link
              href={
                profile?.role === 'institution_admin' || profile?.role === 'platform_owner'
                  ? '/admin'
                  : profile?.organizer_approval_status === 'approved'
                  ? '/org'
                  : profile?.isJury
                  ? '/jury'
                  : '/team'
              }
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
            >
              <span>My Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth?role=participant"
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-16 space-y-20">
        <section className="text-center space-y-6 max-w-3xl mx-auto pt-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Tamper-Proof Evaluation
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Judging you can audit
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Fair, tamper-proof evaluation for hackathons and competitions — eliminating bias through transparent, mathematically verifiable scoring.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#roles"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-base shadow-xl shadow-indigo-600/25 transition-all flex items-center gap-2"
            >
              <span>Select Your Role</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/verify"
              className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-base transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Verify an Event</span>
            </Link>
          </div>
        </section>

        {/* How It Works in 4 Steps */}
        <section className="space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              How it works
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              A fair and transparent four-stage pipeline designed to build trust between organizers, judges, and participants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/20">
                1
              </div>
              <h3 className="text-lg font-semibold text-white">Score fairly</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Multi-criteria rubrics with weight balancing and blind judging ensure projects are evaluated purely on merit without reputation bias.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold text-lg border border-violet-500/20">
                2
              </div>
              <h3 className="text-lg font-semibold text-white">Spot bias</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Real-time statistical indicators detect judge fatigue drift, harshness patterns, and scoring outliers as evaluations happen.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-500/20">
                3
              </div>
              <h3 className="text-lg font-semibold text-white">Explain every result</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Participants receive constructive, objective performance autopsies breaking down exactly where their project excelled and how to improve.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/20">
                4
              </div>
              <h3 className="text-lg font-semibold text-white">Prove nothing changed</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Every score is sealed into a tamper-evident audit ledger that participants, organizers, and sponsors can independently verify.
              </p>
            </div>
          </div>
        </section>

        {/* 4 Role Cards Section */}
        <section id="roles" className="space-y-10 scroll-mt-24">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Choose your workspace
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              Select your role to access your dedicated dashboard and tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Participant */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-7 flex flex-col justify-between transition-all group shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                    Team Workspace
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Participant</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    Form your team, submit your project, and receive comprehensive feedback on your performance.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/auth?role=participant"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-md shadow-blue-600/20"
                >
                  <span>Continue as Participant</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 2. Jury */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 rounded-2xl p-7 flex flex-col justify-between transition-all group shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Award className="w-6 h-6" />
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                    Scoring Portal
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Jury Evaluator</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    Evaluate assigned projects blindly against objective criteria without external influence.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/auth?role=jury"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors shadow-md shadow-violet-600/20"
                >
                  <span>Continue as Jury</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 3. Organizer */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-7 flex flex-col justify-between transition-all group shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <CalendarCheck className="w-6 h-6" />
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    Event Operations
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Event Organizer</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    Configure dynamic rubrics, oversee judging progress, and monitor panel fairness in real time.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/auth?role=organizer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-md shadow-emerald-600/20"
                >
                  <span>Continue as Organizer</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 4. Institution Admin */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-7 flex flex-col justify-between transition-all group shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                    Governance
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Institution Admin</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    Govern events, vet organizers, and inspect compliance across your entire organization.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/auth?role=admin"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors shadow-md shadow-amber-600/20"
                >
                  <span>Continue as Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">FairPitch</p>
              <p className="text-xs text-slate-400">Auditable, peer-calibrated event judging</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <Link
              href="/verify"
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Hash className="w-4 h-4" />
              <span>Public Verification Ledger</span>
            </Link>
            <span className="text-slate-600">|</span>
            <Link href="/consent" className="hover:text-slate-200 transition-colors">
              DPDP 2023 Compliance
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
