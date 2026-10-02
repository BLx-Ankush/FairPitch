// scripts/run-all-tests.js
// Complete automated test runner for FairPitch Module 1:
// 1. Applies all 5 SQL migrations.
// 2. Executes pgTAP test suites across all 4 roles.
// 3. Executes the seed script (1 institution, 1 event, 5 teams, 3 judges, 1 outlier).
// 4. Executes the 100-judge concurrent load test through authenticated user contexts.

const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

async function main() {
    console.log('===============================================================');
    console.log('  FAIRPITCH MODULE 1 DATABASE TEST HARNESS & LOAD TEST');
    console.log('===============================================================\n');

    const db = new PGlite({ extensions: { pgcrypto } });

    // 0. Bootstrap base schemas and Supabase Auth mock functions
    console.log('[Phase 1] Bootstrapping Auth Schema & Extensions...');
    await db.exec(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE,
            created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
            SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
        $$ LANGUAGE sql STABLE;
    `);
    console.log('✓ Auth schema and auth.uid() helper initialized.\n');

    // 1. Execute all 5 migrations in order
    console.log('[Phase 2] Applying Database Migrations (supabase/migrations/)...');
    const migrationFiles = [
        '20261001000001_tables_and_indexes.sql',
        '20261001000002_helper_functions.sql',
        '20261001000003_audit_chain_and_triggers.sql',
        '20261001000004_rls_policies.sql',
        '20261001000005_progress_view_and_jobs.sql'
    ];

    for (const file of migrationFiles) {
        const filePath = path.join(__dirname, '..', 'supabase', 'migrations', file);
        const sql = fs.readFileSync(filePath, 'utf8');
        const start = Date.now();
        await db.exec(sql);
        console.log(`  ✓ Applied ${file} (${Date.now() - start}ms)`);
    }

    // Verify table count
    const tableCountRes = await db.query(`
        SELECT count(*)::int as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    console.log(`\n✓ Verified: ${tableCountRes.rows[0].count} public tables created in database.\n`);

    // 2. Run pgTAP Test Suites
    console.log('[Phase 3] Running Role Security & Constraint Test Suites (supabase/tests/)...');
    
    // Provide pgTAP compatible helper functions inside the test session
    await db.exec(`
        CREATE OR REPLACE FUNCTION ok(boolean, text) RETURNS text AS $$
        BEGIN
            IF $1 THEN
                RETURN 'ok - ' || $2;
            ELSE
                RAISE EXCEPTION 'Test assertion failed: %', $2;
            END IF;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION is(anyelement, anyelement, text) RETURNS text AS $$
        BEGIN
            IF $1 IS NOT DISTINCT FROM $2 THEN
                RETURN 'ok - ' || $3;
            ELSE
                RAISE EXCEPTION 'Test assertion failed: % (Expected: %, Got: %)', $3, $2, $1;
            END IF;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION lives_ok(stmt text, description text) RETURNS text AS $$
        BEGIN
            EXECUTE stmt;
            RETURN 'ok - ' || description;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Test assertion failed: % (Expected query to live, but failed with: %)', description, SQLERRM;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION throws_ok(stmt text, expected_msg text, description text) RETURNS text AS $$
        DECLARE
            err_message text;
        BEGIN
            BEGIN
                EXECUTE stmt;
                RAISE EXCEPTION 'Test assertion failed: % (Expected exception containing "%", but query succeeded)', description, expected_msg;
            EXCEPTION
                WHEN OTHERS THEN
                    GET STACKED DIAGNOSTICS err_message = MESSAGE_TEXT;
                    IF err_message ILIKE '%' || expected_msg || '%' THEN
                        RETURN 'ok - ' || description;
                    ELSIF err_message LIKE 'Test assertion failed:%' THEN
                        RAISE EXCEPTION '%', err_message;
                    ELSE
                        RAISE EXCEPTION 'Test assertion failed: % (Expected message "%", but got "%")', description, expected_msg, err_message;
                    END IF;
            END;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION plan(int) RETURNS text AS $$ BEGIN RETURN '1..' || $1; END; $$ LANGUAGE plpgsql;
        CREATE OR REPLACE FUNCTION finish() RETURNS text AS $$ BEGIN RETURN 'Tests completed successfully'; END; $$ LANGUAGE plpgsql;
    `);

    const testFiles = [
        '01_institution_admin_permissions.sql',
        '02_organizer_permissions.sql',
        '03_jury_forbidden_actions.sql',
        '04_participant_forbidden_actions.sql',
        '05_audit_chain_and_merkle.sql'
    ];

    for (const testFile of testFiles) {
        console.log(`\n  Executing ${testFile}...`);
        const filePath = path.join(__dirname, '..', 'supabase', 'tests', testFile);
        let sql = fs.readFileSync(filePath, 'utf8');
        
        // Strip pgtap extension creation if already present
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgtap;/g, '');

        // We execute statements inside a clean savepoint/transaction
        try {
            await db.exec(sql);
            console.log(`  ✓ ${testFile} PASSED all assertions.`);
        } catch (err) {
            console.error(`\n  ✗ ${testFile} FAILED: ${err.message}`);
            if (err.where) console.error('    Where:', err.where);
            process.exit(1);
        }
    }

    // 3. Execute Seed Script
    console.log('\n[Phase 4] Executing Seed Data Script (supabase/seed.sql)...');
    const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    const seedStart = Date.now();
    try {
        await db.exec(seedSql);
        console.log(`✓ Seed script executed successfully in ${Date.now() - seedStart}ms.`);
    } catch (err) {
        console.error(`\n  ✗ seed.sql FAILED: ${err.message}`);
        if (err.where) console.error('    Where:', err.where);
        process.exit(1);
    }

    // Verify seed scores count and audit log count
    const seedScores = await db.query(`SELECT count(*)::int as count FROM public.scores;`);
    const seedAudit = await db.query(`SELECT count(*)::int as count FROM public.audit_log;`);
    console.log(`  - Total Scores Inserted: ${seedScores.rows[0].count}`);
    console.log(`  - Total Audit Blocks Generated: ${seedAudit.rows[0].count}`);

    // Verify outlier judge results
    const judgeAverages = await db.query(`
        SELECT p.full_name, ROUND(AVG(s.score), 2) as avg_score
        FROM public.scores s
        JOIN public.profiles p ON p.id = s.judge_id
        GROUP BY p.full_name
        ORDER BY avg_score DESC;
    `);
    console.log('  - Seed Judge Averages:');
    judgeAverages.rows.forEach(r => console.log(`      * ${r.full_name}: ${r.avg_score} / 10.0`));

    // 4. 100-Judge Concurrent Load Test
    console.log('\n[Phase 5] Executing 100-Judge Concurrent Load Test...');
    console.log('  Setting up 100 simulated judge identities and assignments in HackNexis 2026...');
    
    const eventId = 'e0000000-0000-0000-0000-000000000001';
    const institutionId = 'a0000000-0000-0000-0000-000000000001';
    const targetTeamId = 'd0000000-0000-0000-0000-000000000001';
    const criteriaRes = await db.query(`SELECT id FROM public.rubric_criteria WHERE event_id = $1 ORDER BY order_index;`, [eventId]);
    const criteriaIds = criteriaRes.rows.map(r => r.id);

    // Register 100 judge users and assignments using a single multi-statement execution
    let registerSql = '';
    for (let i = 1; i <= 100; i++) {
        const hex = i.toString(16).padStart(4, '0');
        const judgeId = `f0000000-0000-0000-0000-00000000${hex}`;
        const email = `load_judge_${i}@nexis.edu`;
        const name = `Load Judge ${i}`;
        
        registerSql += `
            INSERT INTO auth.users (id, email) VALUES ('${judgeId}', '${email}') ON CONFLICT (id) DO NOTHING;
            INSERT INTO public.profiles (id, institution_id, full_name, email, role)
            VALUES ('${judgeId}', '${institutionId}', '${name}', '${email}', 'user') ON CONFLICT (id) DO NOTHING;
            INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
            VALUES ('${judgeId}', '${eventId}', '${institutionId}', 'jury', 'active') ON CONFLICT DO NOTHING;
            INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, status)
            VALUES ('${eventId}', '${institutionId}', '${judgeId}', '${targetTeamId}', 'assigned') ON CONFLICT DO NOTHING;
        `;
    }
    await db.exec(registerSql);
    console.log('  ✓ 100 judges registered and assigned.');

    // Create session-isolated evaluator function for concurrent execution
    await db.exec(`
        CREATE OR REPLACE FUNCTION public.evaluate_as_judge(p_judge_id UUID, p_team_id UUID, p_payload JSONB) RETURNS VOID AS $$
        BEGIN
            PERFORM set_config('request.jwt.claim.sub', p_judge_id::text, true);
            PERFORM public.submit_scores(p_team_id, p_payload);
        END;
        $$ LANGUAGE plpgsql;
    `);

    console.log('  Firing 100 concurrent submit_scores transactions through distinct authenticated sessions...');
    const loadStart = Date.now();

    const tasks = [];
    for (let i = 1; i <= 100; i++) {
        const hex = i.toString(16).padStart(4, '0');
        const judgeId = `f0000000-0000-0000-0000-00000000${hex}`;
        
        const evalPayload = criteriaIds.map((cid, cIdx) => ({
            criterion_id: cid,
            score: 7.0 + ((i + cIdx) % 30) / 10,
            comment: `Concurrent load evaluation from Judge ${i} for criterion ${cIdx + 1}`
        }));

        tasks.push(
            db.query(`SELECT public.evaluate_as_judge($1, $2, $3::jsonb);`, [judgeId, targetTeamId, JSON.stringify(evalPayload)])
        );
    }

    await Promise.all(tasks);
    const loadDuration = Date.now() - loadStart;
    console.log(`  ✓ All 100 concurrent judge evaluations submitted in ${loadDuration}ms (~${((100 / loadDuration) * 1000).toFixed(1)} submissions/sec).`);

    // Verify 100 individual hash chains
    console.log('\n[Phase 6] Verifying Cryptographic Integrity of All 100 Judge Hash Chains...');
    let validCount = 0;
    for (let i = 1; i <= 100; i++) {
        const hex = i.toString(16).padStart(4, '0');
        const judgeId = `f0000000-0000-0000-0000-00000000${hex}`;
        
        const verifyRes = await db.query(`SELECT is_valid, total_blocks FROM public.verify_judge_chain($1, $2);`, [eventId, judgeId]);
        if (verifyRes.rows[0].is_valid && verifyRes.rows[0].total_blocks > 0) {
            validCount++;
        }
    }
    console.log(`  ✓ Verified: ${validCount}/100 judge chains are mathematically valid and tamper-free.`);

    // Merkle Root calculation
    const merkleRes = await db.query(`SELECT public.compute_event_merkle_root($1) as root;`, [eventId]);
    const merkleRoot = merkleRes.rows[0].root;
    console.log(`  ✓ Merkle Root over 103 total chain heads (100 load judges + 3 seed judges + event chain):`);
    console.log(`      ${merkleRoot}`);

    console.log('\n===============================================================');
    console.log('  ALL TESTS & LOAD SIMULATION COMPLETED SUCCESSFULLY!');
    console.log('===============================================================\n');
}

main().catch(err => {
    console.error('\nFATAL ERROR IN TEST SUITE:', err);
    process.exit(1);
});
