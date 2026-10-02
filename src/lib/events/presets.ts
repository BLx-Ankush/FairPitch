import type { ScoreBand } from './types'

export interface RubricPreset {
  id: string
  name: string
  description: string
  criteria: {
    name: string
    description: string
    weight: number
    max_score: number
    score_bands: ScoreBand[]
  }[]
}

const DEFAULT_BANDS: ScoreBand[] = [
  { min: 0, max: 3, label: 'Needs Improvement', description: 'Major gaps, superficial implementation or conceptual flaws.' },
  { min: 4, max: 6, label: 'Competent', description: 'Functional baseline; meets standard expectations with moderate execution.' },
  { min: 7, max: 8, label: 'Commendable', description: 'Strong execution, high craft, thoughtful problem handling.' },
  { min: 9, max: 10, label: 'Exceptional', description: 'Novel breakthrough, production-grade craft, flawless demonstration.' },
]

export const RUBRIC_PRESETS: RubricPreset[] = [
  {
    id: 'general-hackathon',
    name: 'General Hackathon Standard',
    description: 'Balanced evaluation across impact, technical depth, and demo execution.',
    criteria: [
      {
        name: 'Impact & Value Proposition',
        description: 'Does the project solve a real and significant problem? How clear is the target audience?',
        weight: 30,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Innovation & Originality',
        description: 'Novelty of the approach, uniqueness of features, or creative synthesis of technologies.',
        weight: 25,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Technical Execution & Architecture',
        description: 'Code quality, system complexity, reliability, and appropriate architectural choices.',
        weight: 25,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Demo & Presentation',
        description: 'Clarity of the pitch, working software demonstration, and response to questions.',
        weight: 20,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
    ],
  },
  {
    id: 'ai-ml-track',
    name: 'AI & Machine Learning Track',
    description: 'Tailored for foundational models, agentic workflows, and data pipelines.',
    criteria: [
      {
        name: 'Model Innovation & Architecture',
        description: 'Sophistication of model selection, fine-tuning, RAG architecture, or agent reasoning.',
        weight: 30,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Data Integrity & Validation',
        description: 'Dataset curation, evaluation benchmarks, guardrails, and hallucination mitigation.',
        weight: 25,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Practical Utility & Latency',
        description: 'Inference speed, token cost efficiency, edge suitability, and user friction.',
        weight: 25,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Interactive Demonstration',
        description: 'Live test runs across varied edge cases and user inputs.',
        weight: 20,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
    ],
  },
  {
    id: 'product-design',
    name: 'UI/UX & Product Design',
    description: 'Focused on user ergonomics, visual polish, accessibility, and user flows.',
    criteria: [
      {
        name: 'User Experience & Ergonomics',
        description: 'Intuitive user journey, reduction of cognitive load, seamless task completion.',
        weight: 35,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Visual Craft & Accessibility',
        description: 'Hierarchy, typography, color harmony, responsiveness, and WCAG accessibility standards.',
        weight: 25,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Problem-Solution Alignment',
        description: 'Evidence of user research, persona understanding, and acute problem validation.',
        weight: 25,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
      {
        name: 'Prototype Interactivity',
        description: 'Smooth transitions, micro-interactions, responsive states, and edge-case handling.',
        weight: 15,
        max_score: 10,
        score_bands: DEFAULT_BANDS,
      },
    ],
  },
]
