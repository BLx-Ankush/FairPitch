'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AppMode,
  Criterion,
  DEFAULT_LIVE_CRITERIA,
  DEFAULT_LIVE_JUDGES,
  DEFAULT_LIVE_TEAMS,
  Judge,
  RUBRIC_CRITERIA,
  SEED_JUDGES,
  SEED_SCORES,
  SEED_TEAMS,
  ScoreRecord,
  Team,
  getAppMode,
  getLiveCriteria,
  getLiveJudges,
  getLiveScores,
  getLiveTeams,
  getStoredScores,
  resetLiveEvent,
  resetToSeedData,
  saveLiveCriteria,
  saveLiveJudges,
  saveLiveScores,
  saveLiveTeams,
  saveScores,
  setAppMode,
} from './data';
import {
  AUDIT_STORAGE_KEY,
  AuditEntry,
  LIVE_AUDIT_STORAGE_KEY,
  VerifyChainResult,
  addEntry,
  buildChain,
  getStoredChain,
  initAuditChain,
  restoreDemo,
  saveChain,
  tamperDemo,
  verifyChain,
} from './audit';

const EVENT_FAIRPITCH_UPDATE = 'fairpitch_state_change';

export function useFairPitch() {
  const [mode, setModeState] = useState<AppMode>('demo');
  const [scores, setScores] = useState<ScoreRecord[]>(SEED_SCORES);
  const [chain, setChain] = useState<AuditEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>(SEED_TEAMS);
  const [judges, setJudges] = useState<Judge[]>(SEED_JUDGES);
  const [criteria, setCriteria] = useState<Criterion[]>(RUBRIC_CRITERIA);

  const [isLoaded, setIsLoaded] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerifyChainResult | null>(null);
  const [tamperedInfo, setTamperedInfo] = useState<{
    scoreId: string;
    original: number;
    newScore: number;
  } | null>(null);

  // Load state on mount and when mode changes
  const loadState = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const currentMode = getAppMode();
    setModeState(currentMode);

    if (currentMode === 'demo') {
      const storedScores = getStoredScores();
      setScores(storedScores);
      setTeams(SEED_TEAMS);
      setJudges(SEED_JUDGES);
      setCriteria(RUBRIC_CRITERIA);

      let storedChain = getStoredChain(AUDIT_STORAGE_KEY);
      if (!storedChain || storedChain.length === 0) {
        storedChain = await initAuditChain(storedScores);
      }
      setChain(storedChain);

      const tamperBackup = localStorage.getItem('fairpitch_tamper_backup_v1');
      if (tamperBackup) {
        try {
          const parsed = JSON.parse(tamperBackup);
          setTamperedInfo({
            scoreId: parsed.scoreId,
            original: parsed.originalScore,
            newScore: parsed.originalScore + 2.0,
          });
        } catch {}
      } else {
        setTamperedInfo(null);
      }
    } else {
      // Live Event Mode
      const liveTeamsList = getLiveTeams();
      const liveJudgesList = getLiveJudges();
      const liveCriteriaList = getLiveCriteria();
      const liveScoresList = getLiveScores();

      setTeams(liveTeamsList);
      setJudges(liveJudgesList);
      setCriteria(liveCriteriaList);
      setScores(liveScoresList);

      let liveChain = getStoredChain(LIVE_AUDIT_STORAGE_KEY);
      if (!liveChain || liveChain.length === 0) {
        liveChain = await buildChain(liveScoresList);
        saveChain(liveChain, LIVE_AUDIT_STORAGE_KEY);
      }
      setChain(liveChain);
      setTamperedInfo(null);
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadState();

    const handleUpdate = () => {
      loadState();
    };

    window.addEventListener(EVENT_FAIRPITCH_UPDATE, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(EVENT_FAIRPITCH_UPDATE, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadState]);

  const notifyChange = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_FAIRPITCH_UPDATE));
    }
  };

  /**
   * Switch between Demo Mode and Live Event Mode
   */
  const switchMode = (newMode: AppMode) => {
    setAppMode(newMode);
    setModeState(newMode);
    setVerificationResult(null);
    notifyChange();
  };

  /**
   * Live Event Management: Teams
   */
  const addTeam = (teamData: Omit<Team, 'id'>) => {
    const newTeam: Team = {
      ...teamData,
      id: `team-live-${Date.now()}`,
    };
    const updated = [...getLiveTeams(), newTeam];
    saveLiveTeams(updated);
    notifyChange();
  };

  const deleteTeam = (teamId: string) => {
    const updatedTeams = getLiveTeams().filter((t) => t.id !== teamId);
    saveLiveTeams(updatedTeams);
    // Also remove any scores associated with this team
    const updatedScores = getLiveScores().filter((s) => s.team_id !== teamId);
    saveLiveScores(updatedScores);
    notifyChange();
  };

  /**
   * Live Event Management: Judges
   */
  const addJudge = (judgeData: Omit<Judge, 'id'>) => {
    const newJudge: Judge = {
      ...judgeData,
      id: `judge-live-${Date.now()}`,
      avatar: judgeData.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'JD',
    };
    const updated = [...getLiveJudges(), newJudge];
    saveLiveJudges(updated);
    notifyChange();
  };

  const deleteJudge = (judgeId: string) => {
    const updatedJudges = getLiveJudges().filter((j) => j.id !== judgeId);
    saveLiveJudges(updatedJudges);
    // Also remove scores associated with this judge
    const updatedScores = getLiveScores().filter((s) => s.judge_id !== judgeId);
    saveLiveScores(updatedScores);
    notifyChange();
  };

  /**
   * Live Event Management: Criteria
   */
  const updateCriteria = (newCriteria: Criterion[]) => {
    saveLiveCriteria(newCriteria);
    notifyChange();
  };

  /**
   * Submit scoring evaluation (works in both Demo and Live mode)
   */
  const submitJudgeEvaluation = async (
    judgeId: string,
    teamId: string,
    criterionScores: Record<string, number>,
    comment: string
  ): Promise<void> => {
    const isLive = mode === 'live';
    const currentScores = isLive ? getLiveScores() : getStoredScores();
    const chainKey = isLive ? LIVE_AUDIT_STORAGE_KEY : AUDIT_STORAGE_KEY;
    const activeCriteria = isLive ? getLiveCriteria() : RUBRIC_CRITERIA;

    let currentChain = getStoredChain(chainKey);
    if (currentChain.length === 0) {
      currentChain = await buildChain(currentScores);
    }

    const updatedScores = [...currentScores];
    let updatedChain = [...currentChain];
    const timestamp = new Date().toISOString();

    for (const criterion of activeCriteria) {
      const scoreVal = Number((criterionScores[criterion.id] ?? 5).toFixed(1));
      const existingIdx = updatedScores.findIndex(
        (s) =>
          s.judge_id === judgeId &&
          s.team_id === teamId &&
          s.criterion_id === criterion.id
      );

      const scoreId =
        existingIdx !== -1
          ? updatedScores[existingIdx].id
          : `score-${judgeId}-${teamId}-${criterion.id}-${Date.now()}`;

      const newRecord: ScoreRecord = {
        id: scoreId,
        judge_id: judgeId,
        team_id: teamId,
        criterion_id: criterion.id,
        score: scoreVal,
        comment: comment || (existingIdx !== -1 ? updatedScores[existingIdx].comment : 'Evaluated in live session.'),
        order_index: existingIdx !== -1 ? updatedScores[existingIdx].order_index : updatedScores.length + 1,
        timestamp,
      };

      if (existingIdx !== -1) {
        updatedScores[existingIdx] = newRecord;
      } else {
        updatedScores.push(newRecord);
      }

      updatedChain = await addEntry(newRecord, updatedChain);
    }

    if (isLive) {
      saveLiveScores(updatedScores);
      saveChain(updatedChain, LIVE_AUDIT_STORAGE_KEY);
    } else {
      saveScores(updatedScores);
      saveChain(updatedChain, AUDIT_STORAGE_KEY);
    }

    setScores(updatedScores);
    setChain(updatedChain);
    setVerificationResult(null);
    notifyChange();
  };

  /**
   * Run verification of audit chain vs current database
   */
  const runVerify = async (): Promise<VerifyChainResult> => {
    const isLive = mode === 'live';
    const chainKey = isLive ? LIVE_AUDIT_STORAGE_KEY : AUDIT_STORAGE_KEY;
    const activeChain = getStoredChain(chainKey);
    const activeScores = isLive ? getLiveScores() : getStoredScores();
    const result = await verifyChain(activeChain, activeScores);
    setVerificationResult(result);
    return result;
  };

  /**
   * Simulate score tampering
   */
  const simulateTampering = (scoreId?: string) => {
    if (mode === 'live') {
      // In live mode, tamper first available score if any
      const liveScores = getLiveScores();
      if (liveScores.length === 0) return { tamperedScoreId: 'none', originalScore: 0, newScore: 0 };
      const target = liveScores[0];
      const original = target.score;
      const updated = liveScores.map((s, idx) => idx === 0 ? { ...s, score: Math.min(10, s.score + 2.0) } : s);
      saveLiveScores(updated);
      setVerificationResult(null);
      notifyChange();
      return { tamperedScoreId: target.id, originalScore: original, newScore: target.score + 2.0 };
    }

    const res = tamperDemo(scoreId);
    setTamperedInfo({
      scoreId: res.tamperedScoreId,
      original: res.originalScore,
      newScore: res.newScore,
    });
    setVerificationResult(null);
    notifyChange();
    return res;
  };

  /**
   * Restore authentic scores
   */
  const restoreAuthentic = () => {
    if (mode === 'live') {
      // Restore from live audit chain
      const liveChain = getStoredChain(LIVE_AUDIT_STORAGE_KEY);
      if (liveChain.length > 0) {
        const restoredScores: ScoreRecord[] = liveChain.map((entry) => {
          const parsed = JSON.parse(entry.payload);
          return {
            id: entry.score_id,
            judge_id: entry.judge_id,
            team_id: entry.team_id,
            criterion_id: entry.criterion_id,
            score: parsed.score,
            comment: parsed.comment,
            order_index: entry.index + 1,
            timestamp: entry.timestamp,
          };
        });
        saveLiveScores(restoredScores);
      }
      setVerificationResult(null);
      notifyChange();
      return;
    }

    restoreDemo();
    setTamperedInfo(null);
    setVerificationResult(null);
    notifyChange();
  };

  /**
   * Reset demo data to seed state
   */
  const resetDemoData = async () => {
    const freshScores = resetToSeedData();
    localStorage.removeItem('fairpitch_tamper_backup_v1');
    const freshChain = await buildChain(freshScores);
    saveChain(freshChain, AUDIT_STORAGE_KEY);
    setScores(freshScores);
    setChain(freshChain);
    setTamperedInfo(null);
    setVerificationResult(null);
    notifyChange();
  };

  /**
   * Reset live event data back to defaults
   */
  const resetLiveEventData = async () => {
    resetLiveEvent();
    const freshChain = await buildChain([]);
    saveChain(freshChain, LIVE_AUDIT_STORAGE_KEY);
    setScores([]);
    setChain(freshChain);
    setTeams(DEFAULT_LIVE_TEAMS);
    setJudges(DEFAULT_LIVE_JUDGES);
    setCriteria(DEFAULT_LIVE_CRITERIA);
    setVerificationResult(null);
    notifyChange();
  };

  return {
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
  };
}
