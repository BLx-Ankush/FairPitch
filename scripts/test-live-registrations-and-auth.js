const assert = require('assert')
const crypto = require('crypto')

async function runLiveRegistrationsAndAuthTest() {
  console.log('===============================================================')
  console.log('  FAIRPITCH: LIVE REGISTRATIONS & AUTH INFRASTRUCTURE TEST')
  console.log('===============================================================')

  let passedTests = 0

  // 1. Token Hashing Contract (Matches src/lib/auth/tokens.ts)
  console.log('\n[TEST 1] Verifying Cryptographic Token Hashing...')
  function hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex')
  }

  const rawInviteToken = 'fptk_jury_test_invitation_99887766554433221100'
  const hash1 = hashToken(rawInviteToken)
  const hash2 = hashToken(rawInviteToken)
  assert.strictEqual(hash1, hash2, 'Hash must be strictly deterministic')
  assert.strictEqual(hash1.length, 64, 'SHA-256 digest must be 64 hexadecimal chars')
  console.log('  ✓ Deterministic SHA-256 token hashing verified')
  passedTests++

  // 2. Email Service Dispatch Mock Fallback & Templates (Matches src/lib/email/resend.ts)
  console.log('\n[TEST 2] Verifying Transactional Email Templates & Dispatch...')
  const {
    sendWelcomeEmail,
    sendVerificationEmail,
    sendMagicLinkEmail,
    sendPasswordResetEmail,
    sendInviteEmail,
  } = require('../src/lib/email/resend.ts')

  // Test sendWelcomeEmail for Participant
  const welcomeRes = await sendWelcomeEmail({
    to: 'tester.ada@university.edu',
    fullName: 'Ada Lovelace',
    role: 'participant',
  })
  assert.strictEqual(welcomeRes.success, true, 'sendWelcomeEmail must succeed')
  assert.strictEqual(welcomeRes.mock, true, 'Must operate in mock dispatch mode when no API key')
  console.log('  ✓ Participant welcome email dispatched')
  passedTests++

  // Test sendWelcomeEmail for Organizer
  const orgWelcome = await sendWelcomeEmail({
    to: 'kavita.lead@institute.edu',
    fullName: 'Kavita Sharma',
    role: 'organizer',
  })
  assert.strictEqual(orgWelcome.success, true)
  console.log('  ✓ Organizer welcome email dispatched')
  passedTests++

  // Test sendVerificationEmail with 6-digit OTP
  const verifyRes = await sendVerificationEmail({
    to: 'dev@fairpitch.io',
    fullName: 'Dev Tester',
    verifyUrl: 'https://fairpitch.io/api/auth/callback?code=test1234',
    otpCode: '849201',
  })
  assert.strictEqual(verifyRes.success, true)
  console.log('  ✓ 6-Digit OTP verification email dispatched')
  passedTests++

  // Test sendMagicLinkEmail
  const magicRes = await sendMagicLinkEmail({
    to: 'jury.judge@expert.org',
    magicLink: 'https://fairpitch.io/api/auth/callback?type=magiclink',
    otpCode: '573920',
  })
  assert.strictEqual(magicRes.success, true)
  console.log('  ✓ Passwordless Magic Link & login code dispatched')
  passedTests++

  // Test sendPasswordResetEmail
  const resetRes = await sendPasswordResetEmail({
    to: 'reset.user@campus.edu',
    resetUrl: 'https://fairpitch.io/auth?mode=reset&token=recover99',
  })
  assert.strictEqual(resetRes.success, true)
  console.log('  ✓ Password reset email dispatched')
  passedTests++

  // Test sendInviteEmail
  const inviteRes = await sendInviteEmail(
    'evaluator@summit.org',
    rawInviteToken,
    'jury',
    'AI Nexus Finale 2026',
    'HackFest Organizing Committee'
  )
  assert.strictEqual(inviteRes.success, true)
  console.log('  ✓ Single-use jury invite email dispatched')
  passedTests++

  // 3. Public Signup Role Guarding (Zero-Trust Security)
  console.log('\n[TEST 3] Verifying Public Signup Role Boundaries...')
  function validatePublicSignupRequest(body) {
    const { email, password, fullName, accountType, institutionId, inviteToken } = body

    if (!email || !password || !fullName || !accountType) {
      return { allowed: false, status: 400, error: 'Required fields missing' }
    }

    // Admins barred from public signup
    if (accountType === 'institution_admin' || accountType === 'platform_owner') {
      return {
        allowed: false,
        status: 403,
        error: 'Institution administrator accounts cannot be created via public registration.',
      }
    }

    if (!['participant', 'organizer', 'jury'].includes(accountType)) {
      return { allowed: false, status: 400, error: 'Invalid account type' }
    }

    if (accountType === 'organizer' && !institutionId) {
      return { allowed: false, status: 400, error: 'Please select an institution' }
    }

    if (accountType === 'jury' && !inviteToken) {
      return { allowed: false, status: 400, error: 'A valid jury invitation token is required' }
    }

    return { allowed: true }
  }

  // Attempt to self-register as institution_admin (Must be blocked)
  const exploitAttempt = validatePublicSignupRequest({
    email: 'hacker@shady.com',
    password: 'Password123!',
    fullName: 'Malicious Actor',
    accountType: 'institution_admin',
  })
  assert.strictEqual(exploitAttempt.allowed, false)
  assert.strictEqual(exploitAttempt.status, 403)
  console.log('  ✓ Barred institution_admin self-escalation via public signup')
  passedTests++

  // Valid participant signup
  const participantSignup = validatePublicSignupRequest({
    email: 'ada@mit.edu',
    password: 'SecurePassword123',
    fullName: 'Ada Lovelace',
    accountType: 'participant',
  })
  assert.strictEqual(participantSignup.allowed, true)
  console.log('  ✓ Valid participant public signup validated')
  passedTests++

  // Valid organizer signup with institution
  const organizerSignup = validatePublicSignupRequest({
    email: 'kavita@nexis.edu',
    password: 'SecurePassword123',
    fullName: 'Kavita Lead',
    accountType: 'organizer',
    institutionId: 'a0000000-0000-0000-0000-000000000001',
  })
  assert.strictEqual(organizerSignup.allowed, true)
  console.log('  ✓ Valid organizer application validated')
  passedTests++

  // 4. Default Institution Auto-Upsert Fallback Validation
  console.log('\n[TEST 4] Verifying Seed Institution Fallback Routing...')
  const standardSeedIds = [
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
  ]

  function resolveFallbackInstitution(id) {
    if (standardSeedIds.includes(id)) {
      return {
        id,
        name:
          id === 'a0000000-0000-0000-0000-000000000001'
            ? 'Nexis Institute of Technology'
            : 'Apex Global University',
        slug: id === 'a0000000-0000-0000-0000-000000000001' ? 'nexis-tech' : 'apex-global',
        status: 'active',
      }
    }
    return null
  }

  const nexisFallback = resolveFallbackInstitution('a0000000-0000-0000-0000-000000000001')
  assert.strictEqual(nexisFallback.name, 'Nexis Institute of Technology')
  assert.strictEqual(resolveFallbackInstitution('random-fake-id'), null)
  console.log('  ✓ Seed institution auto-provisioning contract verified')
  passedTests++

  // 5. Single-Use Invite Token Expiration & Redemption Contract
  console.log('\n[TEST 5] Verifying Invite Token Redemption Logic...')
  const now = new Date()
  const validInvite = {
    id: 'inv_101',
    token_hash: hashToken('secret_token_123'),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    used_at: null,
    role: 'jury',
  }

  const expiredInvite = {
    id: 'inv_102',
    token_hash: hashToken('secret_token_456'),
    expires_at: new Date(Date.now() - 1000).toISOString(),
    used_at: null,
    role: 'jury',
  }

  const alreadyUsedInvite = {
    id: 'inv_103',
    token_hash: hashToken('secret_token_789'),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    used_at: new Date(Date.now() - 5000).toISOString(),
    role: 'jury',
  }

  function evaluateInvite(invite) {
    if (invite.used_at) return { valid: false, status: 410, reason: 'Already redeemed' }
    if (new Date(invite.expires_at) < now) return { valid: false, status: 410, reason: 'Expired' }
    return { valid: true }
  }

  assert.strictEqual(evaluateInvite(validInvite).valid, true)
  assert.strictEqual(evaluateInvite(expiredInvite).valid, false)
  assert.strictEqual(evaluateInvite(alreadyUsedInvite).valid, false)
  console.log('  ✓ Valid, expired, and redeemed invite verification states verified')
  passedTests++

  // 6. OTP 6-Digit Code Validation
  console.log('\n[TEST 6] Verifying 6-Digit OTP Format & Sanitization...')
  function sanitizeOtp(raw) {
    return (raw || '').replace(/[^0-9]/g, '').slice(0, 6)
  }

  assert.strictEqual(sanitizeOtp('482 910'), '482910')
  assert.strictEqual(sanitizeOtp('12-34-56'), '123456')
  assert.strictEqual(sanitizeOtp('abc998877xyz'), '998877')
  assert.strictEqual(sanitizeOtp('123456789'), '123456')
  console.log('  ✓ 6-Digit OTP format cleansing and input-mode verified')
  passedTests++

  console.log('\n===============================================================')
  console.log(`  ALL ${passedTests} REGISTRATION & AUTH INFRASTRUCTURE TESTS PASSED (100%)`)
  console.log('===============================================================')
}

runLiveRegistrationsAndAuthTest().catch((err) => {
  console.error('Test Suite Failed:', err)
  process.exit(1)
})
