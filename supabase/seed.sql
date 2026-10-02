-- Seed Data for FairPitch (1 Institution, 1 Event, 5 Criteria, 5 Teams, 3 Judges with 1 Deliberately Harsh Judge)

BEGIN;

-- 1. Institution
INSERT INTO public.institutions (id, name, slug, domain, contact_email) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Nexis Institute of Technology',
    'nexis-tech',
    'nexis.edu',
    'hackathons@nexis.edu'
) ON CONFLICT (id) DO NOTHING;

-- 2. Users & Profiles
-- Platform Owner & Institution Admin
INSERT INTO auth.users (id, email) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'admin@nexis.edu'),
    ('b0000000-0000-0000-0000-000000000002', 'organizer@nexis.edu'),
    ('b0000000-0000-0000-0000-000000000011', 'evelyn@nexis.edu'),
    ('b0000000-0000-0000-0000-000000000012', 'marcus@nexis.edu'),
    ('b0000000-0000-0000-0000-000000000013', 'aris@nexis.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Dean Sarah Lin', 'admin@nexis.edu', 'institution_admin', 'approved'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Kavita Rao', 'organizer@nexis.edu', 'user', 'approved'),
    ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Dr. Evelyn Vance', 'evelyn@nexis.edu', 'user', 'none'),
    ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'Marcus Sterling', 'marcus@nexis.edu', 'user', 'none'),
    ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'Prof. Aris Thorne', 'aris@nexis.edu', 'user', 'none')
ON CONFLICT (id) DO NOTHING;

-- 3. Event (HackNexis 2026) initially created as 'draft'
INSERT INTO public.events (id, institution_id, title, slug, description, start_date, end_date, status, created_by) VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'HackNexis 2026',
    'hacknexis-2026',
    'Annual Inter-Collegiate Engineering Hackathon',
    now() - interval '1 day',
    now() + interval '2 days',
    'draft',
    'b0000000-0000-0000-0000-000000000002'
) ON CONFLICT (id) DO NOTHING;

-- Event Roles
INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
    ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'organizer', 'active'),
    ('b0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'jury', 'active'),
    ('b0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'jury', 'active'),
    ('b0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'jury', 'active')
ON CONFLICT DO NOTHING;

-- Aliases for Jury
INSERT INTO public.aliases (event_id, institution_id, user_id, entity_type, alias_label) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'judge', 'Judge A'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'judge', 'Judge B'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', 'judge', 'Judge C')
ON CONFLICT DO NOTHING;

-- 4. Rubric Criteria (Weights total exactly 100%)
INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, description, weight, max_score, score_bands, order_index) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Innovation', 'Novelty, creativity, and unique problem-solving approach', 25, 10, '[{"range": [0,4], "label": "Derivative"}, {"range": [5,7], "label": "Moderate"}, {"range": [8,10], "label": "Breakthrough"}]'::jsonb, 1),
    ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Impact', 'Scale of addressable market and tangible real-world benefit', 25, 10, '[{"range": [0,4], "label": "Niche"}, {"range": [5,7], "label": "Substantial"}, {"range": [8,10], "label": "Transformative"}]'::jsonb, 2),
    ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Technical Rigor', 'System architecture, code quality, and engineering complexity', 20, 10, '[{"range": [0,4], "label": "Basic CRUD"}, {"range": [5,7], "label": "Solid"}, {"range": [8,10], "label": "Deep Engineering"}]'::jsonb, 3),
    ('c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Feasibility', 'Viability of implementation, business model, and operational roadmap', 15, 10, '[{"range": [0,4], "label": "Impractical"}, {"range": [5,7], "label": "Plausible"}, {"range": [8,10], "label": "Deployment Ready"}]'::jsonb, 4),
    ('c0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Presentation', 'Clarity of pitch, live demonstration quality, and Q&A defense', 15, 10, '[{"range": [0,4], "label": "Unprepared"}, {"range": [5,7], "label": "Clear"}, {"range": [8,10], "label": "Masterful"}]'::jsonb, 5)
ON CONFLICT (id) DO NOTHING;

-- Transition to judging phase once rubric criteria are established
UPDATE public.events SET status = 'judging' WHERE id = 'e0000000-0000-0000-0000-000000000001';

-- 5. Teams
INSERT INTO public.teams (id, event_id, institution_id, name, team_code, tagline, track, status) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'EcoSort AI', 'ES-01', 'Autonomous waste sorting robotic bin using edge computer vision', 'CleanTech', 'approved'),
    ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'NeuroGait', 'NG-02', 'Real-time Parkinsonian tremor detection via wearable sensor fusion', 'HealthTech', 'approved'),
    ('d0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CampusBridge', 'CB-03', 'P2P campus pantry and food rescue redistribution logistics network', 'Social Impact', 'approved'),
    ('d0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'MediSync', 'MS-04', 'Decentralized offline-first electronic health records for rural triage', 'Healthcare', 'approved'),
    ('d0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'PulseGrid', 'PG-05', 'Micro-grid predictive load balancing optimizer for student housing', 'Clean Energy', 'approved')
ON CONFLICT (id) DO NOTHING;

-- 6. Assignments (All 3 judges assigned to all 5 teams)
INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, order_index, status) VALUES
    -- Judge 1 (Dr. Evelyn Vance)
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', 1, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000002', 2, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000003', 3, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000004', 4, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000005', 5, 'assigned'),

    -- Judge 2 (Marcus Sterling)
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000005', 1, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000002', 2, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000001', 3, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000004', 4, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000003', 5, 'assigned'),

    -- Judge 3 (Prof. Aris Thorne - deliberately harsh)
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000002', 1, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000001', 2, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000005', 3, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000003', 4, 'assigned'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000004', 5, 'assigned')
ON CONFLICT DO NOTHING;

COMMIT;

-- 7. Submit Evaluations via submit_scores to trigger SHA-256 chain blocks
-- Judge 1 (Dr. Evelyn Vance) - Normal Calibration (7.0 - 9.0)
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000011', true);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 7.5, "comment": "Promising edge vision pipeline"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8.0, "comment": "Direct social relevance for dining halls"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 7.0, "comment": "Clear understanding of TensorRT inference"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 7.5, "comment": "Viable mechanical prototype"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 7.5, "comment": "Crisp live presentation"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000002'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 8.2, "comment": "Outstanding multi-sensor fusion"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8.5, "comment": "Critical clinical impact for Parkinsonian patients"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 7.5, "comment": "Well formulated signal processing pipeline"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 7.5, "comment": "Medical device approval roadmap is sound"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 8.0, "comment": "Great live sensor telemetry sync"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000003'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 6.5, "comment": "Standard matching algorithm"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 7.0, "comment": "Meaningful waste reduction in dining halls"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 6.2, "comment": "CRUD architecture is modest"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 6.8, "comment": "Volunteer logistics dependency is a hurdle"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 7.0, "comment": "Compassionate narrative"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000004'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 8.8, "comment": "Exceptional CRDT peer-to-peer sync"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 9.0, "comment": "Life-saving offline capability"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 8.5, "comment": "Demonstrated low-power BLE mesh sync"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 8.5, "comment": "Low-cost Android deployment"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 8.2, "comment": "Polished crisis simulation"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000005'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 7.2, "comment": "Decentralized auction model"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 7.5, "comment": "Substantial kilowatt shaving during heat waves"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 7.0, "comment": "Predictive ARIMA modeling"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 7.0, "comment": "Requires smart sub-metering hardware"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 7.0, "comment": "Clean telemetry view"}
]'::jsonb);

-- Judge 2 (Marcus Sterling) - Venture lens (7.0 - 8.8)
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000012', true);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000005'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 7.0, "comment": "Dynamic institutional energy pricing"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 7.2, "comment": "Measurable utility bill savings"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 7.0, "comment": "Good telemetry architecture"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 7.0, "comment": "Go-to-market plan is credible"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 7.0, "comment": "Professional pitch"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000002'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 8.0, "comment": "Strong clinical positioning"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8.0, "comment": "Clear reimbursement model"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 8.0, "comment": "Robust firmware implementation"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 7.5, "comment": "Sensible path to market"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 7.5, "comment": "Concise Q&A answers"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 7.2, "comment": "Solid computer vision stream"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 7.5, "comment": "Alignment with ESG corporate targets"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 7.5, "comment": "Low classification latency"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 7.0, "comment": "BOM cost slightly high"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 7.0, "comment": "Good product demo"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000004'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 8.6, "comment": "Peer-to-peer sync is a gamechanger"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8.8, "comment": "Huge humanitarian relevance"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 8.5, "comment": "Defended sync latency"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 8.6, "comment": "Practical deployment model"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 8.5, "comment": "Crisp deck and demo"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000003'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 6.8, "comment": "Productive pantry push alerts"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 6.5, "comment": "Hard to quantify financial durability"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 6.5, "comment": "Next.js stack without novel tech"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 6.5, "comment": "Heavy manual curation"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 6.8, "comment": "Heartfelt presentation"}
]'::jsonb);

-- Judge 3 (Prof. Aris Thorne) - DELIBERATELY HARSH OUTLIER (~1.5 to 2.0 pts lower)
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000013', true);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000002'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 7.5, "comment": "Promising but overfit to sample cohort"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 7.5, "comment": "Clinical trials will face hurdles"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 7.0, "comment": "Sampling rate too low for micro-tremors"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 6.5, "comment": "Battery budget is unrealistic"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 6.5, "comment": "Avoided technical edge case questions"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 5.8, "comment": "Edge compute overkill for bin sorting"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 6.2, "comment": "Contamination will degrade sorting rate"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 5.5, "comment": "Dataset bias across packaging"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 5.8, "comment": "Maintenance overhead of actuators"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 5.5, "comment": "Rushed failure mode explanations"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000005'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 5.5, "comment": "Standard load shedding heuristic"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 5.8, "comment": "Savings dependent on variable tariffs"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 5.5, "comment": "Lacks stability analysis under load"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 5.5, "comment": "Interfacing with switchgear is risky"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 5.2, "comment": "Overly complex architecture diagrams"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000003'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 5.2, "comment": "Very conventional web CRUD application without algorithmic depth"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 5.5, "comment": "Food safety liability risks were dismissed too casually"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 4.8, "comment": "Minimal architectural complexity or backend engineering depth"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 5.0, "comment": "Volunteer burnout will cause rapid drop-off in activity"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 5.0, "comment": "Emotional appeal rather than rigorous operational milestones"}
]'::jsonb);

SELECT public.submit_scores('d0000000-0000-0000-0000-000000000004'::uuid, '[
    {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 4.5, "comment": "Bluetooth mesh sync will partition in real disaster debris"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 4.5, "comment": "Field triage cannot tolerate asynchronous sync lags"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 4.0, "comment": "CRDT convergence unproven under massive concurrent conflicts"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000004", "score": 4.2, "comment": "Zero battery benchmark data presented"},
    {"criterion_id": "c0000000-0000-0000-0000-000000000005", "score": 4.5, "comment": "Defensive answers regarding regulatory clearance"}
]'::jsonb);
