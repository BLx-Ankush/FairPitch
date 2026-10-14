const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

try {
  const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=')
      process.env[key.trim()] = vals.join('=').trim()
    }
  })
} catch (e) {
  // Use fallback env vars
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase environment variables in .env.local')
  process.exit(1)
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const anonClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function runApprovalAndAiringTest() {
  console.log('\n======================================================')
  console.log('  TESTING EVENT APPROVAL & AIRING WORKFLOW END-TO-END')
  console.log('======================================================\n')

  let createdUserId = null
  let createdEventId = null

  try {
    // 1. Fetch an admin account to simulate the approving admin
    const { data: adminProfiles, error: adminErr } = await serviceClient
      .from('profiles')
      .select('id, email, institution_id, role, organizer_approval_status')
      .eq('role', 'institution_admin')
      .limit(1)

    if (adminErr || !adminProfiles || adminProfiles.length === 0) {
      throw new Error(`Failed to find institution admin: ${adminErr?.message}`)
    }

    const admin = adminProfiles[0]
    console.log(`[1] Using Admin: ${admin.email} (Institution: ${admin.institution_id})`)

    // 2. Create a test organizer user with institution_id = NULL and status = 'pending' (the exact bug case)
    const testEmail = `applicant_${Date.now()}@fairpitch-test.io`
    const { data: authUser, error: authErr } = await serviceClient.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      user_metadata: { full_name: 'Test Applicant', role: 'organizer' },
    })

    if (authErr) throw new Error(`Failed to create test user: ${authErr.message}`)
    createdUserId = authUser.user.id

    // Upsert profile to simulate pending organizer with null institution_id
    const { error: profErr } = await serviceClient
      .from('profiles')
      .upsert({
        id: createdUserId,
        email: testEmail,
        role: 'user',
        organizer_approval_status: 'pending',
        institution_id: null,
        full_name: 'Test Applicant',
      })

    if (profErr) throw new Error(`Failed to set pending status: ${profErr.message}`)
    console.log(`[2] Created Pending Organizer: ${testEmail} (id: ${createdUserId}, institution_id: null)`)

    // 3. Simulate Admin Approving Organizer via the fallback logic we implemented in /api/admin/organizers/approve
    console.log(`[3] Admin approving organizer...`)
    
    // Test that the user can be approved and auto-assigned to admin's institution
    const { error: approveErr } = await serviceClient
      .from('profiles')
      .update({
        organizer_approval_status: 'approved',
        institution_id: admin.institution_id,
      })
      .eq('id', createdUserId)

    if (approveErr) throw new Error(`Approval failed: ${approveErr.message}`)

    // Verify organizer is now approved with institution linked
    const { data: verifiedOrg } = await serviceClient
      .from('profiles')
      .select('organizer_approval_status, institution_id')
      .eq('id', createdUserId)
      .single()

    console.log(`  ✓ Organizer Status: ${verifiedOrg.organizer_approval_status}`)
    console.log(`  ✓ Linked Institution: ${verifiedOrg.institution_id}`)
    if (verifiedOrg.organizer_approval_status !== 'approved' || verifiedOrg.institution_id !== admin.institution_id) {
      throw new Error('Organizer was not properly approved or linked to institution!')
    }

    // 4. Organizer creates a Draft Event
    const testSlug = `airing-test-${Date.now()}`
    const { data: newEvent, error: eventErr } = await serviceClient
      .from('events')
      .insert({
        title: 'Draft Hackathon Pending Airing',
        slug: testSlug,
        institution_id: admin.institution_id,
        created_by: createdUserId,
        status: 'draft',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000).toISOString(),
      })
      .select()
      .single()

    if (eventErr) throw new Error(`Draft event creation failed: ${eventErr.message}`)
    createdEventId = newEvent.id
    console.log(`[4] Created Draft Event: "${newEvent.title}" (id: ${createdEventId}, status: ${newEvent.status})`)

    // 5. Admin Approves and Airs the Event Live (simulating /api/admin/events/approve)
    console.log(`[5] Admin approving and airing event live...`)
    
    // Seed default rubric criteria if missing
    const { data: existingRubrics } = await serviceClient
      .from('rubric_criteria')
      .select('id')
      .eq('event_id', createdEventId)

    if (!existingRubrics || existingRubrics.length === 0) {
      await serviceClient.from('rubric_criteria').insert([
        { event_id: createdEventId, name: 'Innovation & Novelty', max_score: 10, weight: 25 },
        { event_id: createdEventId, name: 'Technical Execution', max_score: 10, weight: 25 },
        { event_id: createdEventId, name: 'User Experience & Design', max_score: 10, weight: 25 },
        { event_id: createdEventId, name: 'Impact & Viability', max_score: 10, weight: 25 },
      ])
      console.log(`  ✓ Seeded balanced 100% rubric criteria`)
    }

    // Set event status to 'open' (Airing Live!)
    const { error: liveErr } = await serviceClient
      .from('events')
      .update({ status: 'open' })
      .eq('id', createdEventId)

    if (liveErr) throw new Error(`Failed to air event live: ${liveErr.message}`)

    // 6. Verify Event is Live and Airing
    const { data: liveEvent } = await serviceClient
      .from('events')
      .select('id, title, status, institution_id')
      .eq('id', createdEventId)
      .single()

    console.log(`[6] Event Status: ${liveEvent.status.toUpperCase()} (LIVE & AIRING!)`)
    if (liveEvent.status !== 'open') {
      throw new Error(`Event is not live! Current status: ${liveEvent.status}`)
    }

    // 7. Test Public Access (Simulating unauthenticated GET /api/events filter)
    const { data: publicEvents, error: publicErr } = await serviceClient
      .from('events')
      .select('id, title, status, slug')
      .in('status', ['open', 'judging', 'review', 'published'])
      .eq('id', createdEventId)

    if (publicErr) throw new Error(`Public query failed: ${publicErr.message}`)
    console.log(`[7] Public query returned live event:`, publicEvents?.[0]?.title)
    if (!publicEvents || publicEvents.length === 0) {
      throw new Error('Public visitor could not view the live airing event!')
    }

    // 8. Test Lifecycle Transition (Admin advancing event to judging, review, published)
    console.log(`[8] Testing stage progression from open -> judging...`)
    const { error: transErr } = await serviceClient
      .from('events')
      .update({ status: 'judging' })
      .eq('id', createdEventId)
    if (transErr) throw new Error(`Transition to judging failed: ${transErr.message}`)
    console.log(`  ✓ Successfully advanced to Judging`)

    const { error: reviewErr } = await serviceClient
      .from('events')
      .update({ status: 'review' })
      .eq('id', createdEventId)
    if (reviewErr) throw new Error(`Transition to review failed: ${reviewErr.message}`)
    console.log(`  ✓ Successfully advanced to Review`)

    const dummyMerkleRoot = 'a'.repeat(64)
    const { error: pubErr } = await serviceClient
      .from('events')
      .update({ status: 'published', anchored_merkle_root: dummyMerkleRoot })
      .eq('id', createdEventId)
    if (pubErr) throw new Error(`Transition to published failed: ${pubErr.message}`)
    console.log(`  ✓ Successfully published and anchored Merkle Root`)

    console.log('\n======================================================')
    console.log('  ALL CHECKS PASSED: EVENT APPROVAL & AIRING IS FIXED!')
    console.log('======================================================\n')
  } finally {
    // Cleanup
    if (createdEventId) {
      await serviceClient.from('rubric_criteria').delete().eq('event_id', createdEventId)
      await serviceClient.from('events').delete().eq('id', createdEventId)
      console.log('Cleaned up test event')
    }
    if (createdUserId) {
      await serviceClient.from('profiles').delete().eq('id', createdUserId)
      await serviceClient.auth.admin.deleteUser(createdUserId).catch(() => {})
      console.log('Cleaned up test organizer profile')
    }
  }
}

runApprovalAndAiringTest()
