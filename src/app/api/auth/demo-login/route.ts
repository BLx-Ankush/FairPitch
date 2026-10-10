import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Demo login is permanently disabled. Please sign in with your verified credentials or Google.' },
    { status: 404 }
  )
}
