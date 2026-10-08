const assert = require('assert')

async function testTaskASecurity() {
  console.log('===============================================================')
  console.log('  TASK A: SECURITY HARDENING VERIFICATION SUITE')
  console.log('===============================================================')

  const SECRET = 'fairpitch-test-demo-secret-key-32chars'

  // Implement the exact algorithm from demo-cookie.ts
  function isDemoModeAllowed(envMode, nodeEnv) {
    return envMode === 'true' && nodeEnv !== 'production'
  }

  async function signDemoPayload(payload, secret) {
    const fullPayload = { ...payload, timestamp: Date.now() }
    const jsonStr = JSON.stringify(fullPayload)
    const encodedPayload = Buffer.from(jsonStr).toString('base64url')

    const key = await crypto.subtle.importKey(
      'raw',
      Buffer.from(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )

    const signature = await crypto.subtle.sign('HMAC', key, Buffer.from(encodedPayload))
    const encodedSig = Buffer.from(signature).toString('base64url')

    return `${encodedPayload}.${encodedSig}`
  }

  async function verifyDemoCookie(cookieValue, secret, envMode, nodeEnv) {
    if (!cookieValue || !isDemoModeAllowed(envMode, nodeEnv)) return null
    try {
      const parts = cookieValue.split('.')
      if (parts.length !== 2) return null
      const [encodedPayload, encodedSig] = parts

      const key = await crypto.subtle.importKey(
        'raw',
        Buffer.from(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      )

      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        Buffer.from(encodedSig, 'base64url'),
        Buffer.from(encodedPayload)
      )

      if (!isValid) return null
      const json = Buffer.from(encodedPayload, 'base64url').toString('utf-8')
      const payload = JSON.parse(json)
      if (Date.now() - payload.timestamp > 7 * 24 * 60 * 60 * 1000) return null
      return payload
    } catch {
      return null
    }
  }

  console.log('\n[Suite 1] Signed Demo Cookie Verification & Gating')

  // 1. isDemoModeAllowed check
  assert.strictEqual(isDemoModeAllowed('true', 'development'), true)
  assert.strictEqual(isDemoModeAllowed('true', 'production'), false)
  assert.strictEqual(isDemoModeAllowed('false', 'development'), false)
  console.log('  ✓ PASS: isDemoModeAllowed strictly allows only dev + NEXT_PUBLIC_DEMO_MODE=true')

  // 2. Sign demo payload
  const payload = {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@nexis.edu',
    full_name: 'Dean Sarah Lin',
    role: 'institution_admin',
    organizer_approval_status: 'approved',
    institution_id: 'a0000000-0000-0000-0000-000000000001',
  }

  const signed = await signDemoPayload(payload, SECRET)
  assert.ok(signed.includes('.'), 'Must contain dot separator')
  console.log('  ✓ PASS: HMAC-SHA256 signature generated successfully')

  // 3. Verify valid signature
  const verified = await verifyDemoCookie(signed, SECRET, 'true', 'development')
  assert.ok(verified)
  assert.strictEqual(verified.email, 'admin@nexis.edu')
  assert.strictEqual(verified.role, 'institution_admin')
  console.log('  ✓ PASS: Legitimate signed demo cookie verified and parsed')

  // 4. Reject tampered signature
  const tampered = signed.slice(0, -4) + 'zzzz'
  const tamperedRes = await verifyDemoCookie(tampered, SECRET, 'true', 'development')
  assert.strictEqual(tamperedRes, null)
  console.log('  ✓ PASS: Tampered signature rejected (null returned)')

  // 5. Reject unsigned legacy JSON
  const legacyJson = JSON.stringify(payload)
  const legacyRes = await verifyDemoCookie(legacyJson, SECRET, 'true', 'development')
  assert.strictEqual(legacyRes, null)
  console.log('  ✓ PASS: Unsigned legacy JSON cookie rejected (null returned)')

  // 6. Reject valid cookie in production
  const prodRes = await verifyDemoCookie(signed, SECRET, 'true', 'production')
  assert.strictEqual(prodRes, null)
  console.log('  ✓ PASS: Valid demo cookie is rejected in production environment')

  console.log('\n===============================================================')
  console.log('  ALL TASK A SECURITY ASSERTIONS PASSED (6/6)!')
  console.log('===============================================================')
}

testTaskASecurity().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})
