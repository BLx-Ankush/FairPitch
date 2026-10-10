/**
 * Cryptographically signed demo cookie utilities for FairPitch.
 * Demo access is strictly disabled when process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'
 * or when NODE_ENV === 'production'.
 */

export interface DemoUserPayload {
  id: string
  email: string
  full_name: string
  role: 'institution_admin' | 'platform_owner' | 'user'
  organizer_approval_status: 'none' | 'pending' | 'approved' | 'rejected'
  institution_id: string | null
  isJury?: boolean
  timestamp: number
}

export const DEMO_COOKIE_NAME = 'fairpitch_demo_user'

export function isDemoModeAllowed(): boolean {
  return false
}

function getSecretKey(): string {
  return (
    process.env.DEMO_COOKIE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'fairpitch-local-demo-secret-key-32-chars-min-needed'
  )
}

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyData = enc.encode(getSecretKey())
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Signs a demo payload into an HMAC-SHA256 authenticated token.
 */
export async function signDemoPayload(payload: Omit<DemoUserPayload, 'timestamp'>): Promise<string> {
  if (!isDemoModeAllowed()) {
    throw new Error('Demo authentication is strictly forbidden in this environment')
  }

  const fullPayload: DemoUserPayload = {
    ...payload,
    timestamp: Date.now(),
  }

  const enc = new TextEncoder()
  const jsonStr = JSON.stringify(fullPayload)
  const encodedPayload = arrayBufferToBase64Url(enc.encode(jsonStr).buffer as ArrayBuffer)

  const key = await getCryptoKey()
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(encodedPayload))
  const encodedSignature = arrayBufferToBase64Url(signatureBuffer)

  return `${encodedPayload}.${encodedSignature}`
}

/**
 * Verifies a signed demo cookie value.
 * Returns the decoded payload if valid and demo mode is active; otherwise null.
 */
export async function verifyDemoCookie(cookieValue?: string | null): Promise<DemoUserPayload | null> {
  if (!cookieValue || !isDemoModeAllowed()) {
    return null
  }

  try {
    const parts = cookieValue.split('.')
    if (parts.length !== 2) return null

    const [encodedPayload, encodedSignature] = parts
    const enc = new TextEncoder()

    const key = await getCryptoKey()
    const signatureBuffer = base64UrlToArrayBuffer(encodedSignature)

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      enc.encode(encodedPayload)
    )

    if (!isValid) return null

    const payloadBuffer = base64UrlToArrayBuffer(encodedPayload)
    const dec = new TextDecoder()
    const jsonStr = dec.decode(payloadBuffer)
    const payload: DemoUserPayload = JSON.parse(jsonStr)

    // Ensure session isn't older than 7 days
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    if (Date.now() - payload.timestamp > sevenDaysMs) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
