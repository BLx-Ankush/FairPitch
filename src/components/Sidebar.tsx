'use client';

import React from 'react';
import {
  SlidersHorizontal,
  LayoutDashboard,
  FileBarChart,
  ShieldCheck,
  RotateCcw,
  Scale,
  Award,
  Settings2,
  Zap,
} from 'lucide-react';
import { AppMode, Criterion } from '@/lib/data';

export type NavPage = 'scoring' | 'dashboard' | 'report' | 'audit' | 'setup';

interface SidebarProps {
  activePage: NavPage;
  onSelectPage: (page: NavPage) => void;
  onResetData: () => void;
  isResetting?: boolean;
  mode: AppMode;
  criteria: Criterion[];
  teamsCount: number;
  judgesCount: number;
}

export function Sidebar({
  activePage,
  onSelectPage,
  onResetData,
  isResetting = false,
  mode,
  criteria,
  teamsCount,
  judgesCount,
}: SidebarProps) {
  const navItems: Array<{
    id: NavPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    liveOnly?: boolean;
  }> = [
    {
      id: 'scoring',
      label: 'Judge Scoring',
      icon: SlidersHorizontal,
    },
    {
      id: 'dashboard',
      label: 'Organizer Dashboard',
      icon: LayoutDashboard,
      badge: mode === 'live' ? 'Live' : 'Audited',
    },
    {
      id: 'report',
      label: 'Team Report',
      icon: FileBarChart,
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: ShieldCheck,
      badge: 'SHA-256',
    },
  ];

  // In Live mode, add Event Setup
  if (mode === 'live') {
    navItems.push({
      id: 'setup',
      label: 'Event Setup',
      icon: Settings2,
      badge: 'Config',
    });
  }

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6">
        {/* Hackathon banner */}
        <div
          className={`rounded-xl p-3.5 border transition-all ${
            mode === 'live'
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
              : 'bg-gradient-to-br from-indigo-50 to-slate-100 border-indigo-100/80'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            {mode === 'live' ? (
              <Zap className="h-4 w-4 text-emerald-600" />
            ) : (
              <Award className="h-4 w-4 text-indigo-600" />
            )}
            <span className={mode === 'live' ? 'text-emerald-800' : 'text-indigo-700'}>
              {mode === 'live' ? 'Live Hackathon' : 'Hackathon Panel'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 font-medium leading-relaxed">
            {mode === 'live' ? 'Custom Live Event' : 'Spring 2026 Grand Finale'}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 pt-2">
            <span>{teamsCount} Teams</span>
            <span>{judgesCount} Judges</span>
            <span>{criteria.length} Criteria</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1.5">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rubric Summary Card */}
        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-slate-800 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-slate-500" />
              <span>{mode === 'live' ? 'Live Rubric Weights' : 'Fixed Rubric Weights'}</span>
            </div>
            {mode === 'live' && (
              <button
                onClick={() => onSelectPage('setup')}
                className="text-[10px] text-indigo-600 hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          <div className="space-y-1 text-[11px]">
            {criteria.map((c) => (
              <div key={c.id} className="flex justify-between text-slate-700">
                <span className="truncate max-w-[130px]" title={c.name}>
                  {c.name}
                </span>
                <span className="font-semibold font-mono">{c.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action: Reset */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <button
          onClick={onResetData}
          disabled={isResetting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <RotateCcw
            className={`h-3.5 w-3.5 text-slate-500 ${
              isResetting ? 'animate-spin' : ''
            }`}
          />
          <span>{mode === 'demo' ? 'Reset Demo Data' : 'Reset Live Event'}</span>
        </button>
        <p className="mt-2 text-[10px] text-center text-slate-400">
          {mode === 'demo'
            ? 'Restores original seed & rebuilds hash chain'
            : 'Restores initial live event starter template'}
        </p>
      </div>
    </aside>
  );
}
