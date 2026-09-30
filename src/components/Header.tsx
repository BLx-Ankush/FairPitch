'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, Cpu, Sparkles, Zap, FlaskConical } from 'lucide-react';
import { AppMode } from '@/lib/data';

interface HeaderProps {
  mode: AppMode;
  onSwitchMode: (mode: AppMode) => void;
  chainLength: number;
  tampered: boolean;
  onReset: () => void;
}

export function Header({
  mode,
  onSwitchMode,
  chainLength,
  tampered,
  onReset,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-sm shadow-xs">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              FairPitch
            </span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Judging you can audit
          </p>
        </div>

        {/* Mode Switcher Segmented Control */}
        <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
          <button
            onClick={() => onSwitchMode('demo')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              mode === 'demo'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Demo Mode</span>
          </button>

          <button
            onClick={() => onSwitchMode('live')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              mode === 'live'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Live Mode</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Mobile Mode Switcher */}
        <div className="flex md:hidden items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
          <button
            onClick={() => onSwitchMode(mode === 'demo' ? 'live' : 'demo')}
            className="px-2.5 py-1 text-xs font-bold text-slate-800"
          >
            {mode === 'demo' ? '🧪 Demo' : '⚡ Live'}
          </button>
        </div>

        {/* Caption requirement (Demo vs Live) */}
        {mode === 'demo' ? (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>All data is simulated</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Event Mode</span>
          </div>
        )}

        {/* Cryptographic chain pill */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
          <Cpu className="h-3.5 w-3.5 text-slate-500" />
          <span>SHA-256 Ledger: {chainLength} blocks</span>
        </div>

        {/* Tamper status pill */}
        {tampered ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 border border-red-300 animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
            <span>Store Tampered (+2.0)</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Ledger Valid</span>
          </div>
        )}

        {/* Reset button */}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
          title={
            mode === 'demo'
              ? 'Reload initial seed data and rebuild cryptographic hash chain'
              : 'Reset live event data to defaults'
          }
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span className="hidden md:inline">
            {mode === 'demo' ? 'Reset Demo' : 'Reset Event'}
          </span>
        </button>
      </div>
    </header>
  );
}
