'use client';

import React, { useState } from 'react';
import { useFairPitch } from '@/lib/useFairPitch';
import { Header } from '@/components/Header';
import { NavPage, Sidebar } from '@/components/Sidebar';
import { JudgeScoringPage } from '@/components/JudgeScoringPage';
import { OrganizerDashboardPage } from '@/components/OrganizerDashboardPage';
import { TeamReportPage } from '@/components/TeamReportPage';
import { AuditLogPage } from '@/components/AuditLogPage';
import { EventSetupPage } from '@/components/EventSetupPage';

export default function FairPitchApp() {
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [isResetting, setIsResetting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const {
    mode,
    switchMode,
    scores,
    chain,
    teams,
    judges,
    criteria,
    isLoaded,
    verificationResult,
    tamperedInfo,
    addTeam,
    deleteTeam,
    addJudge,
    deleteJudge,
    updateCriteria,
    submitJudgeEvaluation,
    runVerify,
    simulateTampering,
    restoreAuthentic,
    resetDemoData,
    resetLiveEventData,
  } = useFairPitch();

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      if (mode === 'demo') {
        await resetDemoData();
        setNotification('Demo data reset to seed state. SHA-256 chain regenerated.');
      } else {
        await resetLiveEventData();
        setNotification('Live event reset to default template.');
      }
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsResetting(false);
    }
  };

  const handleTamper = () => {
    const res = simulateTampering();
    setNotification(
      `Tampering simulated: modified score ${res.tamperedScoreId} to ${res.newScore} in database.`
    );
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRestore = () => {
    restoreAuthentic();
    setNotification('Database restored to match authentic audit ledger.');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleModeChange = (newMode: 'demo' | 'live') => {
    switchMode(newMode);
    setNotification(
      newMode === 'live'
        ? 'Switched to Live Event Mode. Configure your teams, judges, and criteria!'
        : 'Switched to Demo Mode with simulated hackathon dataset.'
    );
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Top Navigation Header with Mode Switcher & Mandatory Caption */}
      <Header
        mode={mode}
        onSwitchMode={handleModeChange}
        chainLength={chain.length}
        tampered={!!tamperedInfo}
        onReset={handleResetData}
      />

      {/* Global Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-lg animate-in slide-in-from-bottom duration-200 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Body Layout: Sidebar + Main Content */}
      <div className="flex flex-1 w-full max-w-full overflow-x-hidden">
        <Sidebar
          activePage={activePage}
          onSelectPage={setActivePage}
          onResetData={handleResetData}
          isResetting={isResetting}
          mode={mode}
          criteria={criteria}
          teamsCount={teams.length}
          judgesCount={judges.length}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {activePage === 'scoring' && (
            <JudgeScoringPage
              scores={scores}
              judges={judges}
              teams={teams}
              criteria={criteria}
              onSubmitScores={submitJudgeEvaluation}
            />
          )}

          {activePage === 'dashboard' && (
            <OrganizerDashboardPage
              scores={scores}
              judges={judges}
              teams={teams}
              criteria={criteria}
              mode={mode}
            />
          )}

          {activePage === 'report' && (
            <TeamReportPage
              scores={scores}
              teams={teams}
              judges={judges}
              criteria={criteria}
              mode={mode}
            />
          )}

          {activePage === 'audit' && (
            <AuditLogPage
              chain={chain}
              scores={scores}
              verificationResult={verificationResult}
              onVerify={runVerify}
              onTamper={handleTamper}
              onRestore={handleRestore}
              tamperedInfo={tamperedInfo}
              judges={judges}
              teams={teams}
              criteria={criteria}
              mode={mode}
            />
          )}

          {activePage === 'setup' && (
            <EventSetupPage
              teams={teams}
              judges={judges}
              criteria={criteria}
              onAddTeam={addTeam}
              onDeleteTeam={deleteTeam}
              onAddJudge={addJudge}
              onDeleteJudge={deleteJudge}
              onUpdateCriteria={updateCriteria}
              onResetLiveEvent={handleResetData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
