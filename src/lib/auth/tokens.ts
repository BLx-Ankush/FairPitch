import { createHash, randomBytes } from 'crypto'

/**
 * Generates a secure random 32-byte hexadecimal token.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Computes the SHA-256 hash of a raw token.
 * This is stored in public.invites.token_hash to prevent token leak via database reads.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Generates an invite token pair: raw token (for URL/email) and hashed token (for DB).
 */
export function createInviteToken() {
  const rawToken = generateSecureToken()
  const tokenHash = hashToken(rawToken)
  return { rawToken, tokenHash }
}
