'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  FileCheck2,
  ArrowLeft,
  Plus,
  Trash2,
  Lock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info
} from 'lucide-react'
import type { RubricCriterion } from '@/lib/events/types'
import { RUBRIC_PRESETS } from '@/lib/events/presets'

export default function RubricEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [criteria, setCriteria] = useState<RubricCriterion[]>([])
  const [totalWeight, setTotalWeight] = useState(0)
  const [isFrozen, setIsFrozen] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // New criterion form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newWeight, setNewWeight] = useState(25)

  async function fetchRubrics() {
    try {
      const res = await fetch(`/api/events/${id}/rubrics`)
      if (res.ok) {
        const data = await res.json()
        setCriteria(data.criteria || [])
        setTotalWeight(data.totalWeight || 0)
      }

      const eventRes = await fetch(`/api/events/${id}`)
      if (eventRes.ok) {
        const eventData = await eventRes.json()
        setIsFrozen(eventData.event.isRubricFrozen)
        setEventTitle(eventData.event.title)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRubrics()
  }, [id])

  async function handleAddCriterion(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${id}/rubrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          weight: newWeight,
          orderIndex: criteria.length,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add criterion')
      }

      setNewName('')
      setNewDescription('')
      setShowAddForm(false)
      setSuccess('Criterion added successfully')
      await fetchRubrics()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCriterion(criterionId: string) {
    if (!confirm('Are you sure you want to remove this criterion?')) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${id}/rubrics/${criterionId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete criterion')
      }

      setSuccess('Criterion removed')
      await fetchRubrics()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLoadPreset(presetId: string) {
    if (!confirm('Loading this template will replace your current rubric criteria with a pre-balanced 100% template. Continue?')) return

    const preset = RUBRIC_PRESETS.find((p) => p.id === presetId)
    if (!preset) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${id}/rubrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkCriteria: preset.criteria,
          replaceExisting: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply preset')
      }

      setSuccess(`Loaded template: ${preset.name}`)
      await fetchRubrics()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const weightProgress = Math.min(totalWeight, 100)
  const isPerfect100 = totalWeight === 100

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href={`/org/events/${id}`}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Rubric Criteria Builder
              {isFrozen && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Locked & Frozen
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-400">{eventTitle || 'Event Evaluation Model'}</p>
          </div>
        </div>

        <Link
          href={`/org/events/${id}`}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          Return to Command Center
        </Link>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Live Weight Totalizer Progress Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">Rubric Weight Totalizer</span>
              <span className="text-[11px] text-slate-400">(Required sum: exactly 100%)</span>
            </div>

            <div className="text-right">
              <span
                className={`text-lg font-bold font-mono ${
                  isPerfect100
                    ? 'text-emerald-400'
                    : totalWeight > 100
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {totalWeight}%
              </span>
              <span className="text-xs text-slate-500 font-mono"> / 100%</span>
            </div>
          </div>

          {/* Bar */}
          <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isPerfect100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                  : totalWeight > 100
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400'
              }`}
              style={{ width: `${Math.min(totalWeight, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            {isPerfect100 ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Rubric weights total 100%. Ready for event opening.
              </span>
            ) : totalWeight < 100 ? (
              <span className="text-amber-400 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Add {100 - totalWeight}% more weight to reach the required 100% total.
              </span>
            ) : (
              <span className="text-red-400 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Weight exceeds 100% by {totalWeight - 100}%. Please reduce weights.
              </span>
            )}

            {!isFrozen && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">Quick Templates:</span>
                {RUBRIC_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleLoadPreset(p.id)}
                    disabled={saving}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {p.name.split(' ')[0]} (100%)
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-100">
            Evaluation Dimensions ({criteria.length})
          </h2>

          {!isFrozen && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? 'Cancel Form' : 'Add Criterion'}</span>
            </button>
          )}
        </div>

        {/* Add Criterion Inline Form */}
        {showAddForm && !isFrozen && (
          <div className="bg-slate-900/90 border border-indigo-500/50 rounded-2xl p-6 shadow-xl mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">
              Add New Evaluation Criterion
            </h3>
            <form onSubmit={handleAddCriterion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Criterion Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Technical Feasibility & Scalability"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Weight Percentage (1-100) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Evaluation Description & Guidance for Judges
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Explain what aspects judges should look for when scoring this criterion..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  {saving ? 'Adding...' : 'Save Criterion'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Criteria List */}
        <div className="space-y-4">
          {criteria.map((c, idx) => (
            <div
              key={c.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-start justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 text-[11px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-bold text-slate-100">{c.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/40 text-indigo-400 border border-indigo-800/60 font-mono">
                    {c.weight}% weight
                  </span>
                  <span className="text-[10px] text-slate-500">Max score: {c.max_score} pts</span>
                </div>

                <p className="text-xs text-slate-400 pl-8 leading-relaxed">
                  {c.description || 'No guidance description provided.'}
                </p>

                {/* Score bands breakdown */}
                {c.score_bands && c.score_bands.length > 0 && (
                  <div className="mt-3 pl-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {c.score_bands.map((b: any, bIdx: number) => (
                      <div key={bIdx} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[10px]">
                        <span className="font-semibold text-slate-300 block">{b.label} ({b.min}-{b.max})</span>
                        <span className="text-slate-500 line-clamp-1 mt-0.5">{b.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isFrozen && (
                <button
                  onClick={() => handleDeleteCriterion(c.id)}
                  disabled={saving}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove criterion"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
