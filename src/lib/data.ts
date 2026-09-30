export interface Criterion {
  id: string;
  name: string;
  weight: number; // 25, 25, 20, 15, 15
  description: string;
}

export interface Team {
  id: string;
  name: string;
  tagline: string;
  track: string;
}

export interface Judge {
  id: string;
  name: string;
  title: string;
  avatar: string;
}

export interface ScoreRecord {
  id: string;
  judge_id: string;
  team_id: string;
  criterion_id: string;
  score: number; // 0-10
  comment: string;
  order_index: number;
  timestamp: string; // ISO string
}

export type AppMode = 'demo' | 'live';

export const APP_MODE_KEY = 'fairpitch_app_mode_v1';
export const LIVE_TEAMS_KEY = 'fairpitch_live_teams_v1';
export const LIVE_JUDGES_KEY = 'fairpitch_live_judges_v1';
export const LIVE_CRITERIA_KEY = 'fairpitch_live_criteria_v1';
export const LIVE_SCORES_KEY = 'fairpitch_live_scores_v1';

export const DEFAULT_LIVE_CRITERIA: Criterion[] = [
  { id: 'crit-live-1', name: 'Innovation & Novelty', weight: 25, description: 'Originality of the solution, creative execution, and differentiation' },
  { id: 'crit-live-2', name: 'Real-world Impact', weight: 25, description: 'Scale of addressable user problem and tangible social/commercial benefit' },
  { id: 'crit-live-3', name: 'Technical Rigor', weight: 20, description: 'Architecture resilience, engineering complexity, and code quality' },
  { id: 'crit-live-4', name: 'Feasibility & Roadmap', weight: 15, description: 'Deployment readiness, economic viability, and clear milestones' },
  { id: 'crit-live-5', name: 'Pitch & Clarity', weight: 15, description: 'Effective demonstration, storytelling, and compelling presentation' },
];

export const DEFAULT_LIVE_JUDGES: Judge[] = [
  { id: 'judge-live-1', name: 'Elena Rostova', title: 'Director of AI Engineering', avatar: 'ER' },
  { id: 'judge-live-2', name: 'Liam Vance', title: 'Founding Partner, HackVentures', avatar: 'LV' },
  { id: 'judge-live-3', name: 'Dr. Hiroshi Tanaka', title: 'Professor of Computer Science', avatar: 'HT' },
];

export const DEFAULT_LIVE_TEAMS: Team[] = [
  { id: 'team-live-1', name: 'TerraPulse', tagline: 'Satellite-powered hyper-local flood forecasting sensors', track: 'ClimateTech' },
  { id: 'team-live-2', name: 'SynapseGuard', tagline: 'Edge AI EEG monitor predicting epileptic onset spikes', track: 'HealthTech' },
  { id: 'team-live-3', name: 'TrustFlow', tagline: 'Decentralized verifiable identity credentials for refugees', track: 'Social Impact' },
  { id: 'team-live-4', name: 'OmniVolt', tagline: 'Dynamic phase-balancing micro-grid controller for EVs', track: 'Clean Energy' },
];

export const RUBRIC_CRITERIA: Criterion[] = [
  {
    id: 'innovation',
    name: 'Innovation',
    weight: 25,
    description: 'Novelty, creativity, and unique problem-solving approach',
  },
  {
    id: 'impact',
    name: 'Impact',
    weight: 25,
    description: 'Scale of potential benefit and real-world significance',
  },
  {
    id: 'feasibility',
    name: 'Feasibility',
    weight: 20,
    description: 'Technical viability, execution plan, and adoption pathway',
  },
  {
    id: 'presentation',
    name: 'Presentation',
    weight: 15,
    description: 'Clarity, storytelling, demonstration quality, and pitch polish',
  },
  {
    id: 'technical',
    name: 'Technical Understanding',
    weight: 15,
    description: 'Architectural depth, engineering rigor, and technical mastery',
  },
];

export const SEED_TEAMS: Team[] = [
  {
    id: 'team-1',
    name: 'EcoSort AI',
    tagline: 'Autonomous waste sorting robotic bin using edge computer vision',
    track: 'CleanTech',
  },
  {
    id: 'team-2',
    name: 'NeuroGait',
    tagline: 'Real-time Parkinsonian tremor detection via wearable sensor fusion',
    track: 'HealthTech',
  },
  {
    id: 'team-3',
    name: 'CampusBridge',
    tagline: 'P2P campus pantry and food rescue redistribution logistics network',
    track: 'Social Impact',
  },
  {
    id: 'team-4',
    name: 'MediSync',
    tagline: 'Decentralized offline-first electronic health records for rural triage',
    track: 'Healthcare',
  },
  {
    id: 'team-5',
    name: 'PulseGrid',
    tagline: 'Micro-grid predictive load balancing optimizer for student housing',
    track: 'Clean Energy',
  },
];

export const SEED_JUDGES: Judge[] = [
  {
    id: 'judge-1',
    name: 'Dr. Evelyn Vance',
    title: 'AI/ML Research Scientist & Faculty Advisor',
    avatar: 'EV',
  },
  {
    id: 'judge-2',
    name: 'Marcus Sterling',
    title: 'Venture Partner & Former Tech Lead',
    avatar: 'MS',
  },
  {
    id: 'judge-3',
    name: 'Prof. Aris Thorne',
    title: 'Systems Engineering & Ethics Chair',
    avatar: 'AT',
  },
];

// Helper to build realistic scores
// Base time: 2026-09-30T14:00:00Z
const createTimestamp = (minutesOffset: number) => {
  const d = new Date(Date.UTC(2026, 8, 30, 14, 0, 0));
  d.setMinutes(d.getMinutes() + minutesOffset);
  return d.toISOString();
};

export const SEED_SCORES: ScoreRecord[] = [
  // --- Judge 1 (Dr. Evelyn Vance): mostly 7.0 - 8.8, high praise for technical rigor
  // Order 1-5: Team 1 (EcoSort AI)
  {
    id: 'score-j1-t1-c1',
    judge_id: 'judge-1',
    team_id: 'team-1',
    criterion_id: 'innovation',
    score: 7.5,
    comment: 'Novel dual-wavelength optical classification pipeline.',
    order_index: 1,
    timestamp: createTimestamp(5),
  },
  {
    id: 'score-j1-t1-c2',
    judge_id: 'judge-1',
    team_id: 'team-1',
    criterion_id: 'impact',
    score: 7.8,
    comment: 'High potential for municipal recycling sorting efficiency.',
    order_index: 2,
    timestamp: createTimestamp(8),
  },
  {
    id: 'score-j1-t1-c3',
    judge_id: 'judge-1',
    team_id: 'team-1',
    criterion_id: 'feasibility',
    score: 7.2,
    comment: 'Mechanical sorting chute actuator requires calibration.',
    order_index: 3,
    timestamp: createTimestamp(11),
  },
  {
    id: 'score-j1-t1-c4',
    judge_id: 'judge-1',
    team_id: 'team-1',
    criterion_id: 'presentation',
    score: 7.5,
    comment: 'Solid live prototype demonstration with plastic containers.',
    order_index: 4,
    timestamp: createTimestamp(14),
  },
  {
    id: 'score-j1-t1-c5',
    judge_id: 'judge-1',
    team_id: 'team-1',
    criterion_id: 'technical',
    score: 7.0,
    comment: 'Clear understanding of edge TensorRT inference constraints.',
    order_index: 5,
    timestamp: createTimestamp(17),
  },

  // Order 6-10: Team 3 (CampusBridge)
  {
    id: 'score-j1-t3-c1',
    judge_id: 'judge-1',
    team_id: 'team-3',
    criterion_id: 'innovation',
    score: 6.5,
    comment: 'Standard matching algorithm, but clever notification cadence.',
    order_index: 6,
    timestamp: createTimestamp(24),
  },
  {
    id: 'score-j1-t3-c2',
    judge_id: 'judge-1',
    team_id: 'team-3',
    criterion_id: 'impact',
    score: 7.0,
    comment: 'Meaningful reduction in campus dining hall perishables waste.',
    order_index: 7,
    timestamp: createTimestamp(27),
  },
  {
    id: 'score-j1-t3-c3',
    judge_id: 'judge-1',
    team_id: 'team-3',
    criterion_id: 'feasibility',
    score: 6.8,
    comment: 'Volunteer logistics dependency could be an operational hurdle.',
    order_index: 8,
    timestamp: createTimestamp(30),
  },
  {
    id: 'score-j1-t3-c4',
    judge_id: 'judge-1',
    team_id: 'team-3',
    criterion_id: 'presentation',
    score: 7.0,
    comment: 'Compassionate narrative with clear user interview clips.',
    order_index: 9,
    timestamp: createTimestamp(33),
  },
  {
    id: 'score-j1-t3-c5',
    judge_id: 'judge-1',
    team_id: 'team-3',
    criterion_id: 'technical',
    score: 6.2,
    comment: 'CRUD architecture is modest; real-time queueing could scale up.',
    order_index: 10,
    timestamp: createTimestamp(36),
  },

  // Order 11-15: Team 4 (MediSync) - J1 loves MediSync
  {
    id: 'score-j1-t4-c1',
    judge_id: 'judge-1',
    team_id: 'team-4',
    criterion_id: 'innovation',
    score: 8.8,
    comment: 'Exceptional CRDT conflict-free replication over ad-hoc BLE mesh.',
    order_index: 11,
    timestamp: createTimestamp(45),
  },
  {
    id: 'score-j1-t4-c2',
    judge_id: 'judge-1',
    team_id: 'team-4',
    criterion_id: 'impact',
    score: 9.0,
    comment: 'Life-saving capability for disconnected humanitarian field medics.',
    order_index: 12,
    timestamp: createTimestamp(48),
  },
  {
    id: 'score-j1-t4-c3',
    judge_id: 'judge-1',
    team_id: 'team-4',
    criterion_id: 'feasibility',
    score: 8.5,
    comment: 'Already deployed on low-cost Android hardware; strong roadmap.',
    order_index: 13,
    timestamp: createTimestamp(51),
  },
  {
    id: 'score-j1-t4-c4',
    judge_id: 'judge-1',
    team_id: 'team-4',
    criterion_id: 'presentation',
    score: 8.2,
    comment: 'Engaging, polished emergency response scenario walkthrough.',
    order_index: 14,
    timestamp: createTimestamp(54),
  },
  {
    id: 'score-j1-t4-c5',
    judge_id: 'judge-1',
    team_id: 'team-4',
    criterion_id: 'technical',
    score: 8.6,
    comment: 'Deep cryptographic key rotation and state vector synchronization.',
    order_index: 15,
    timestamp: createTimestamp(57),
  },

  // Order 16-20: Team 2 (NeuroGait) - J1 scores very solid
  {
    id: 'score-j1-t2-c1',
    judge_id: 'judge-1',
    team_id: 'team-2',
    criterion_id: 'innovation',
    score: 8.0,
    comment: 'Smart adaptive Kalman filter on dual IMU ankles.',
    order_index: 16,
    timestamp: createTimestamp(65),
  },
  {
    id: 'score-j1-t2-c2',
    judge_id: 'judge-1',
    team_id: 'team-2',
    criterion_id: 'impact',
    score: 8.5,
    comment: 'Addresses critical fall prevention for early neuro-degeneration.',
    order_index: 17,
    timestamp: createTimestamp(68),
  },
  {
    id: 'score-j1-t2-c3',
    judge_id: 'judge-1',
    team_id: 'team-2',
    criterion_id: 'feasibility',
    score: 8.0,
    comment: 'Hardware prototype is functional and battery draw is low.',
    order_index: 18,
    timestamp: createTimestamp(71),
  },
  {
    id: 'score-j1-t2-c4',
    judge_id: 'judge-1',
    team_id: 'team-2',
    criterion_id: 'presentation',
    score: 8.0,
    comment: 'Great live accelerometer graph synced with onstage walking.',
    order_index: 19,
    timestamp: createTimestamp(74),
  },
  {
    id: 'score-j1-t2-c5',
    judge_id: 'judge-1',
    team_id: 'team-2',
    criterion_id: 'technical',
    score: 7.5,
    comment: 'Well formulated signal processing pipeline and latency bounds.',
    order_index: 20,
    timestamp: createTimestamp(77),
  },

  // Order 21-25: Team 5 (PulseGrid)
  {
    id: 'score-j1-t5-c1',
    judge_id: 'judge-1',
    team_id: 'team-5',
    criterion_id: 'innovation',
    score: 7.2,
    comment: 'Decentralized auction model for solar micro-inverter shedding.',
    order_index: 21,
    timestamp: createTimestamp(85),
  },
  {
    id: 'score-j1-t5-c2',
    judge_id: 'judge-1',
    team_id: 'team-5',
    criterion_id: 'impact',
    score: 7.5,
    comment: 'Substantial peak kilowatt shaving during university heat waves.',
    order_index: 22,
    timestamp: createTimestamp(88),
  },
  {
    id: 'score-j1-t5-c3',
    judge_id: 'judge-1',
    team_id: 'team-5',
    criterion_id: 'feasibility',
    score: 7.0,
    comment: 'Requires smart sub-metering hardware integration in dorms.',
    order_index: 23,
    timestamp: createTimestamp(91),
  },
  {
    id: 'score-j1-t5-c4',
    judge_id: 'judge-1',
    team_id: 'team-5',
    criterion_id: 'presentation',
    score: 7.0,
    comment: 'Clear ROI slides and clean telemetry dashboard view.',
    order_index: 24,
    timestamp: createTimestamp(94),
  },
  {
    id: 'score-j1-t5-c5',
    judge_id: 'judge-1',
    team_id: 'team-5',
    criterion_id: 'technical',
    score: 7.0,
    comment: 'Good predictive ARIMA modeling for 24hr load demand.',
    order_index: 25,
    timestamp: createTimestamp(97),
  },

  // --- Judge 2 (Marcus Sterling): scores mostly 6.8 - 8.7, venture lens
  // Order 1-5: Team 5 (PulseGrid)
  {
    id: 'score-j2-t5-c1',
    judge_id: 'judge-2',
    team_id: 'team-5',
    criterion_id: 'innovation',
    score: 7.0,
    comment: 'Dynamic energy pricing algorithm tailored for institutional campuses.',
    order_index: 1,
    timestamp: createTimestamp(6),
  },
  {
    id: 'score-j2-t5-c2',
    judge_id: 'judge-2',
    team_id: 'team-5',
    criterion_id: 'impact',
    score: 7.2,
    comment: 'Measurable utility bill savings; clear unit economics.',
    order_index: 2,
    timestamp: createTimestamp(9),
  },
  {
    id: 'score-j2-t5-c3',
    judge_id: 'judge-2',
    team_id: 'team-5',
    criterion_id: 'feasibility',
    score: 7.0,
    comment: 'Go-to-market plan for facilities management is credible.',
    order_index: 3,
    timestamp: createTimestamp(12),
  },
  {
    id: 'score-j2-t5-c4',
    judge_id: 'judge-2',
    team_id: 'team-5',
    criterion_id: 'presentation',
    score: 7.5,
    comment: 'Compelling venture pitch structure and market size breakdown.',
    order_index: 4,
    timestamp: createTimestamp(15),
  },
  {
    id: 'score-j2-t5-c5',
    judge_id: 'judge-2',
    team_id: 'team-5',
    criterion_id: 'technical',
    score: 7.2,
    comment: 'Solid API contracts between smart inverters and aggregator.',
    order_index: 5,
    timestamp: createTimestamp(18),
  },

  // Order 6-10: Team 2 (NeuroGait) - J2 loves NeuroGait
  {
    id: 'score-j2-t2-c1',
    judge_id: 'judge-2',
    team_id: 'team-2',
    criterion_id: 'innovation',
    score: 8.5,
    comment: 'Breakthrough gait asymmetry metrics from off-the-shelf IMUs.',
    order_index: 6,
    timestamp: createTimestamp(25),
  },
  {
    id: 'score-j2-t2-c2',
    judge_id: 'judge-2',
    team_id: 'team-2',
    criterion_id: 'impact',
    score: 8.0,
    comment: 'Enormous market in geriatric telemedicine and rehab clinics.',
    order_index: 7,
    timestamp: createTimestamp(28),
  },
  {
    id: 'score-j2-t2-c3',
    judge_id: 'judge-2',
    team_id: 'team-2',
    criterion_id: 'feasibility',
    score: 8.0,
    comment: 'Clear 510(k) pathway awareness and rapid hardware iteration.',
    order_index: 8,
    timestamp: createTimestamp(31),
  },
  {
    id: 'score-j2-t2-c4',
    judge_id: 'judge-2',
    team_id: 'team-2',
    criterion_id: 'presentation',
    score: 7.5,
    comment: 'Strong pitch, concise responses during judge Q&A.',
    order_index: 9,
    timestamp: createTimestamp(34),
  },
  {
    id: 'score-j2-t2-c5',
    judge_id: 'judge-2',
    team_id: 'team-2',
    criterion_id: 'technical',
    score: 8.0,
    comment: 'Robust firmware implementation with low-power BLE broadcast.',
    order_index: 10,
    timestamp: createTimestamp(37),
  },

  // Order 11-15: Team 1 (EcoSort AI)
  {
    id: 'score-j2-t1-c1',
    judge_id: 'judge-2',
    team_id: 'team-1',
    criterion_id: 'innovation',
    score: 7.2,
    comment: 'Solid computer vision implementation for contaminated stream sorting.',
    order_index: 11,
    timestamp: createTimestamp(46),
  },
  {
    id: 'score-j2-t1-c2',
    judge_id: 'judge-2',
    team_id: 'team-1',
    criterion_id: 'impact',
    score: 7.5,
    comment: 'Direct alignment with corporate ESG goals and waste reduction.',
    order_index: 12,
    timestamp: createTimestamp(49),
  },
  {
    id: 'score-j2-t1-c3',
    judge_id: 'judge-2',
    team_id: 'team-1',
    criterion_id: 'feasibility',
    score: 7.0,
    comment: 'BOM cost currently too high for widespread cafeteria rollouts.',
    order_index: 13,
    timestamp: createTimestamp(52),
  },
  {
    id: 'score-j2-t1-c4',
    judge_id: 'judge-2',
    team_id: 'team-1',
    criterion_id: 'presentation',
    score: 7.0,
    comment: 'Good demo; could have emphasized customer discovery more.',
    order_index: 14,
    timestamp: createTimestamp(55),
  },
  {
    id: 'score-j2-t1-c5',
    judge_id: 'judge-2',
    team_id: 'team-1',
    criterion_id: 'technical',
    score: 7.5,
    comment: 'Good latency under 120ms per classification cycle.',
    order_index: 15,
    timestamp: createTimestamp(58),
  },

  // Order 16-20: Team 4 (MediSync) - J2 also rates MediSync very high
  {
    id: 'score-j2-t4-c1',
    judge_id: 'judge-2',
    team_id: 'team-4',
    criterion_id: 'innovation',
    score: 8.6,
    comment: 'Peer-to-peer sync without cloud backhaul is a gamechanger.',
    order_index: 16,
    timestamp: createTimestamp(66),
  },
  {
    id: 'score-j2-t4-c2',
    judge_id: 'judge-2',
    team_id: 'team-4',
    criterion_id: 'impact',
    score: 8.8,
    comment: 'Huge humanitarian relevance for earthquake and storm rescue.',
    order_index: 17,
    timestamp: createTimestamp(69),
  },
  {
    id: 'score-j2-t4-c3',
    judge_id: 'judge-2',
    team_id: 'team-4',
    criterion_id: 'feasibility',
    score: 8.6,
    comment: 'Practical zero-infrastructure deployment model.',
    order_index: 18,
    timestamp: createTimestamp(72),
  },
  {
    id: 'score-j2-t4-c4',
    judge_id: 'judge-2',
    team_id: 'team-4',
    criterion_id: 'presentation',
    score: 8.5,
    comment: 'Crisp deck, outstanding crisis simulation walkthrough.',
    order_index: 19,
    timestamp: createTimestamp(75),
  },
  {
    id: 'score-j2-t4-c5',
    judge_id: 'judge-2',
    team_id: 'team-4',
    criterion_id: 'technical',
    score: 8.5,
    comment: 'Well defended cryptographic tamper-resistance and sync latency.',
    order_index: 20,
    timestamp: createTimestamp(78),
  },

  // Order 21-25: Team 3 (CampusBridge)
  {
    id: 'score-j2-t3-c1',
    judge_id: 'judge-2',
    team_id: 'team-3',
    criterion_id: 'innovation',
    score: 6.8,
    comment: 'Productive application of community pantry push alerts.',
    order_index: 21,
    timestamp: createTimestamp(86),
  },
  {
    id: 'score-j2-t3-c2',
    judge_id: 'judge-2',
    team_id: 'team-3',
    criterion_id: 'impact',
    score: 6.5,
    comment: 'Great social mission but hard to quantify financial durability.',
    order_index: 22,
    timestamp: createTimestamp(89),
  },
  {
    id: 'score-j2-t3-c3',
    judge_id: 'judge-2',
    team_id: 'team-3',
    criterion_id: 'feasibility',
    score: 6.5,
    comment: 'Requires heavy manual volunteer curation.',
    order_index: 23,
    timestamp: createTimestamp(92),
  },
  {
    id: 'score-j2-t3-c4',
    judge_id: 'judge-2',
    team_id: 'team-3',
    criterion_id: 'presentation',
    score: 6.8,
    comment: 'Heartfelt presentation, answered questions candidly.',
    order_index: 24,
    timestamp: createTimestamp(95),
  },
  {
    id: 'score-j2-t3-c5',
    judge_id: 'judge-2',
    team_id: 'team-3',
    criterion_id: 'technical',
    score: 6.5,
    comment: 'Straightforward Next.js/Supabase stack without novel tech.',
    order_index: 25,
    timestamp: createTimestamp(98),
  },

  // --- Judge 3 (Prof. Aris Thorne): scores ~1.5 points lower overall,
  // exhibits fatigue/drift across session, and scores Team 4 FAR lower (ethical/systems skepticism)
  // Order 1-5: Team 2 (NeuroGait) - scored first, relatively high
  {
    id: 'score-j3-t2-c1',
    judge_id: 'judge-3',
    team_id: 'team-2',
    criterion_id: 'innovation',
    score: 7.2,
    comment: 'Methodology is sound; IMU signal filtration is adequate.',
    order_index: 1,
    timestamp: createTimestamp(7),
  },
  {
    id: 'score-j3-t2-c2',
    judge_id: 'judge-3',
    team_id: 'team-2',
    criterion_id: 'impact',
    score: 7.5,
    comment: 'Legitimate medical diagnostic utility if clinical trials pass.',
    order_index: 2,
    timestamp: createTimestamp(10),
  },
  {
    id: 'score-j3-t2-c3',
    judge_id: 'judge-3',
    team_id: 'team-2',
    criterion_id: 'feasibility',
    score: 7.0,
    comment: 'Hardware sensor calibration will drift over long-term use.',
    order_index: 3,
    timestamp: createTimestamp(13),
  },
  {
    id: 'score-j3-t2-c4',
    judge_id: 'judge-3',
    team_id: 'team-2',
    criterion_id: 'presentation',
    score: 6.5,
    comment: 'Presentation was structured but lacked error bound analysis.',
    order_index: 4,
    timestamp: createTimestamp(16),
  },
  {
    id: 'score-j3-t2-c5',
    judge_id: 'judge-3',
    team_id: 'team-2',
    criterion_id: 'technical',
    score: 7.0,
    comment: 'Reasonable digital signal processing fundamentals.',
    order_index: 5,
    timestamp: createTimestamp(19),
  },

  // Order 6-10: Team 1 (EcoSort AI)
  {
    id: 'score-j3-t1-c1',
    judge_id: 'judge-3',
    team_id: 'team-1',
    criterion_id: 'innovation',
    score: 6.0,
    comment: 'Recycling classification models are widespread; limited novelty.',
    order_index: 6,
    timestamp: createTimestamp(26),
  },
  {
    id: 'score-j3-t1-c2',
    judge_id: 'judge-3',
    team_id: 'team-1',
    criterion_id: 'impact',
    score: 6.2,
    comment: 'Real-world contamination issues will degrade sorting rate.',
    order_index: 7,
    timestamp: createTimestamp(29),
  },
  {
    id: 'score-j3-t1-c3',
    judge_id: 'judge-3',
    team_id: 'team-1',
    criterion_id: 'feasibility',
    score: 5.8,
    comment: 'Maintenance overhead of physical actuators in dirty environments.',
    order_index: 8,
    timestamp: createTimestamp(32),
  },
  {
    id: 'score-j3-t1-c4',
    judge_id: 'judge-3',
    team_id: 'team-1',
    criterion_id: 'presentation',
    score: 5.5,
    comment: 'Pitch rushed through failure modes and edge case handling.',
    order_index: 9,
    timestamp: createTimestamp(35),
  },
  {
    id: 'score-j3-t1-c5',
    judge_id: 'judge-3',
    team_id: 'team-1',
    criterion_id: 'technical',
    score: 5.5,
    comment: 'Insufficient evaluation of dataset bias across packaging brands.',
    order_index: 10,
    timestamp: createTimestamp(38),
  },

  // Order 11-15: Team 5 (PulseGrid)
  {
    id: 'score-j3-t5-c1',
    judge_id: 'judge-3',
    team_id: 'team-5',
    criterion_id: 'innovation',
    score: 5.5,
    comment: 'Standard load shedding heuristic, not true decentralized consensus.',
    order_index: 11,
    timestamp: createTimestamp(47),
  },
  {
    id: 'score-j3-t5-c2',
    judge_id: 'judge-3',
    team_id: 'team-5',
    criterion_id: 'impact',
    score: 5.8,
    comment: 'Savings are dependent on utility tariff structures that vary widely.',
    order_index: 12,
    timestamp: createTimestamp(50),
  },
  {
    id: 'score-j3-t5-c3',
    judge_id: 'judge-3',
    team_id: 'team-5',
    criterion_id: 'feasibility',
    score: 5.5,
    comment: 'Interfacing with high-voltage campus switchgear is risky.',
    order_index: 13,
    timestamp: createTimestamp(53),
  },
  {
    id: 'score-j3-t5-c4',
    judge_id: 'judge-3',
    team_id: 'team-5',
    criterion_id: 'presentation',
    score: 5.2,
    comment: 'Overly complex architecture diagrams; rushed through conclusion.',
    order_index: 14,
    timestamp: createTimestamp(56),
  },
  {
    id: 'score-j3-t5-c5',
    judge_id: 'judge-3',
    team_id: 'team-5',
    criterion_id: 'technical',
    score: 5.5,
    comment: 'Lacks rigorous stability analysis under rapid load fluctuations.',
    order_index: 15,
    timestamp: createTimestamp(59),
  },

  // Order 16-20: Team 3 (CampusBridge)
  {
    id: 'score-j3-t3-c1',
    judge_id: 'judge-3',
    team_id: 'team-3',
    criterion_id: 'innovation',
    score: 5.2,
    comment: 'Very conventional web CRUD application without algorithmic depth.',
    order_index: 16,
    timestamp: createTimestamp(67),
  },
  {
    id: 'score-j3-t3-c2',
    judge_id: 'judge-3',
    team_id: 'team-3',
    criterion_id: 'impact',
    score: 5.5,
    comment: 'Food safety liability risks were dismissed too casually.',
    order_index: 17,
    timestamp: createTimestamp(70),
  },
  {
    id: 'score-j3-t3-c3',
    judge_id: 'judge-3',
    team_id: 'team-3',
    criterion_id: 'feasibility',
    score: 5.0,
    comment: 'Volunteer burnout will cause rapid drop-off in activity.',
    order_index: 18,
    timestamp: createTimestamp(73),
  },
  {
    id: 'score-j3-t3-c4',
    judge_id: 'judge-3',
    team_id: 'team-3',
    criterion_id: 'presentation',
    score: 5.0,
    comment: 'Emotional appeal rather than rigorous operational milestones.',
    order_index: 19,
    timestamp: createTimestamp(76),
  },
  {
    id: 'score-j3-t3-c5',
    judge_id: 'judge-3',
    team_id: 'team-3',
    criterion_id: 'technical',
    score: 4.8,
    comment: 'Minimal architectural complexity or backend engineering depth.',
    order_index: 20,
    timestamp: createTimestamp(79),
  },

  // Order 21-25: Team 4 (MediSync) - Judge 3 scores Team 4 FAR lower (scored last in session)
  {
    id: 'score-j3-t4-c1',
    judge_id: 'judge-3',
    team_id: 'team-4',
    criterion_id: 'innovation',
    score: 4.5,
    comment: 'CRDTs in healthcare introduce severe compliance and audit liabilities.',
    order_index: 21,
    timestamp: createTimestamp(87),
  },
  {
    id: 'score-j3-t4-c2',
    judge_id: 'judge-3',
    team_id: 'team-4',
    criterion_id: 'impact',
    score: 4.2,
    comment: 'Offline EHR without strict cryptographic revocation is hazardous.',
    order_index: 22,
    timestamp: createTimestamp(90),
  },
  {
    id: 'score-j3-t4-c3',
    judge_id: 'judge-3',
    team_id: 'team-4',
    criterion_id: 'feasibility',
    score: 4.5,
    comment: 'Regulatory HIPAA/GDPR hurdles make field adoption nearly impossible.',
    order_index: 23,
    timestamp: createTimestamp(93),
  },
  {
    id: 'score-j3-t4-c4',
    judge_id: 'judge-3',
    team_id: 'team-4',
    criterion_id: 'presentation',
    score: 4.5,
    comment: 'Overly defensive when questioned on data leakage in warzones.',
    order_index: 24,
    timestamp: createTimestamp(96),
  },
  {
    id: 'score-j3-t4-c5',
    judge_id: 'judge-3',
    team_id: 'team-4',
    criterion_id: 'technical',
    score: 4.0,
    comment: 'Byzantine fault tolerance is completely unaddressed in mesh sync.',
    order_index: 25,
    timestamp: createTimestamp(99),
  },
];

// LocalStorage Persistence Helpers
const STORAGE_KEY = 'fairpitch_scores_v1';

export function getStoredScores(): ScoreRecord[] {
  if (typeof window === 'undefined') {
    return SEED_SCORES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_SCORES));
      return SEED_SCORES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_SCORES));
    return SEED_SCORES;
  } catch (e) {
    console.error('Failed to load scores from localStorage', e);
    return SEED_SCORES;
  }
}

export function saveScores(scores: ScoreRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch (e) {
    console.error('Failed to save scores to localStorage', e);
  }
}

export function resetToSeedData(): ScoreRecord[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_SCORES));
    } catch (e) {
      console.error('Failed to reset scores in localStorage', e);
    }
  }
  return SEED_SCORES;
}

export function updateSingleScore(
  scoreId: string,
  newScore: number,
  comment?: string
): ScoreRecord[] {
  const current = getStoredScores();
  const index = current.findIndex((s) => s.id === scoreId);
  if (index === -1) return current;

  const updated = [...current];
  updated[index] = {
    ...updated[index],
    score: Math.min(10, Math.max(0, Math.round(newScore * 10) / 10)),
    comment: comment !== undefined ? comment : updated[index].comment,
  };
  saveScores(updated);
  return updated;
}

// Verification function logged on load
export function verifySeedIntegrity(scores: ScoreRecord[] = SEED_SCORES) {
  const calcJudgeTotal = (judgeId: string, teamId: string) => {
    const judgeScores = scores.filter(
      (s) => s.judge_id === judgeId && s.team_id === teamId
    );
    return judgeScores.reduce((sum, s) => {
      const crit = RUBRIC_CRITERIA.find((c) => c.id === s.criterion_id);
      return sum + (s.score / 10) * (crit ? crit.weight : 0);
    }, 0);
  };

  const calcLeaderboard = (excludedJudges: string[] = []) => {
    const activeJudges = SEED_JUDGES.filter(
      (j) => !excludedJudges.includes(j.id)
    );
    return SEED_TEAMS.map((team) => {
      const totals = activeJudges.map((j) => calcJudgeTotal(j.id, team.id));
      const avg = totals.reduce((a, b) => a + b, 0) / (activeJudges.length || 1);
      return { team, total: avg };
    }).sort((a, b) => b.total - a.total);
  };

  const origLb = calcLeaderboard([]);
  const withoutJ3Lb = calcLeaderboard(['judge-3']);

  const origWinner = origLb[0];
  const newWinner = withoutJ3Lb[0];

  const j1Scores = scores.filter((s) => s.judge_id === 'judge-1').map((s) => s.score);
  const j2Scores = scores.filter((s) => s.judge_id === 'judge-2').map((s) => s.score);
  const j3Scores = scores.filter((s) => s.judge_id === 'judge-3').map((s) => s.score);

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const j1Mean = mean(j1Scores);
  const j2Mean = mean(j2Scores);
  const j3Mean = mean(j3Scores);

  const t4J1Total = calcJudgeTotal('judge-1', 'team-4');
  const t4J2Total = calcJudgeTotal('judge-2', 'team-4');
  const t4J3Total = calcJudgeTotal('judge-3', 'team-4');

  const result = {
    j1Mean: Number(j1Mean.toFixed(2)),
    j2Mean: Number(j2Mean.toFixed(2)),
    j3Mean: Number(j3Mean.toFixed(2)),
    meanDifference: Number((((j1Mean + j2Mean) / 2) - j3Mean).toFixed(2)),
    t4ScoresByJudge: {
      judge1: Number(t4J1Total.toFixed(2)),
      judge2: Number(t4J2Total.toFixed(2)),
      judge3: Number(t4J3Total.toFixed(2)),
    },
    originalWinner: `${origWinner.team.name} (${origWinner.total.toFixed(2)})`,
    winnerWithoutJudge3: `${newWinner.team.name} (${newWinner.total.toFixed(2)})`,
    winnerChanged: origWinner.team.id !== newWinner.team.id,
  };

  console.log('[FairPitch Data Verification]', JSON.stringify(result, null, 2));
  return result;
}

// Run verification log
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    verifySeedIntegrity(SEED_SCORES);
  } catch {
    // Silent in edge environments
  }
}

// ----------------- LIVE MODE STORAGE HELPERS -----------------
export function getAppMode(): AppMode {
  if (typeof window === 'undefined') return 'demo';
  try {
    const mode = localStorage.getItem(APP_MODE_KEY);
    return mode === 'live' ? 'live' : 'demo';
  } catch {
    return 'demo';
  }
}

export function setAppMode(mode: AppMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APP_MODE_KEY, mode);
  } catch (e) {
    console.error('Failed to set app mode', e);
  }
}

export function getLiveTeams(): Team[] {
  if (typeof window === 'undefined') return DEFAULT_LIVE_TEAMS;
  try {
    const raw = localStorage.getItem(LIVE_TEAMS_KEY);
    if (!raw) {
      localStorage.setItem(LIVE_TEAMS_KEY, JSON.stringify(DEFAULT_LIVE_TEAMS));
      return DEFAULT_LIVE_TEAMS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LIVE_TEAMS;
  } catch {
    return DEFAULT_LIVE_TEAMS;
  }
}

export function saveLiveTeams(teams: Team[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIVE_TEAMS_KEY, JSON.stringify(teams));
  } catch (e) {
    console.error('Failed to save live teams', e);
  }
}

export function getLiveJudges(): Judge[] {
  if (typeof window === 'undefined') return DEFAULT_LIVE_JUDGES;
  try {
    const raw = localStorage.getItem(LIVE_JUDGES_KEY);
    if (!raw) {
      localStorage.setItem(LIVE_JUDGES_KEY, JSON.stringify(DEFAULT_LIVE_JUDGES));
      return DEFAULT_LIVE_JUDGES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LIVE_JUDGES;
  } catch {
    return DEFAULT_LIVE_JUDGES;
  }
}

export function saveLiveJudges(judges: Judge[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIVE_JUDGES_KEY, JSON.stringify(judges));
  } catch (e) {
    console.error('Failed to save live judges', e);
  }
}

export function getLiveCriteria(): Criterion[] {
  if (typeof window === 'undefined') return DEFAULT_LIVE_CRITERIA;
  try {
    const raw = localStorage.getItem(LIVE_CRITERIA_KEY);
    if (!raw) {
      localStorage.setItem(LIVE_CRITERIA_KEY, JSON.stringify(DEFAULT_LIVE_CRITERIA));
      return DEFAULT_LIVE_CRITERIA;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LIVE_CRITERIA;
  } catch {
    return DEFAULT_LIVE_CRITERIA;
  }
}

export function saveLiveCriteria(criteria: Criterion[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIVE_CRITERIA_KEY, JSON.stringify(criteria));
  } catch (e) {
    console.error('Failed to save live criteria', e);
  }
}

export function getLiveScores(): ScoreRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIVE_SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLiveScores(scores: ScoreRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIVE_SCORES_KEY, JSON.stringify(scores));
  } catch (e) {
    console.error('Failed to save live scores', e);
  }
}

export function resetLiveEvent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIVE_TEAMS_KEY, JSON.stringify(DEFAULT_LIVE_TEAMS));
    localStorage.setItem(LIVE_JUDGES_KEY, JSON.stringify(DEFAULT_LIVE_JUDGES));
    localStorage.setItem(LIVE_CRITERIA_KEY, JSON.stringify(DEFAULT_LIVE_CRITERIA));
    localStorage.setItem(LIVE_SCORES_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Failed to reset live event', e);
  }
}

