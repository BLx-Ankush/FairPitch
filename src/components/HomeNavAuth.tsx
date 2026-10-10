'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function HomeNavAuth() {
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

  if (currentUser) {
    return (
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
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/auth?role=participant"
        className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
      >
        Sign In
      </Link>
    </div>
  )
}
