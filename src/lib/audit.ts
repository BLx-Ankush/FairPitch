import {
  SEED_SCORES,
  ScoreRecord,
  getStoredScores,
  saveScores,
} from './data';

export interface AuditEntry {
  index: number;
  score_id: string;
  judge_id: string;
  team_id: string;
  criterion_id: string;
  score: number;
  comment: string;
  timestamp: string;
  payload: string; // JSON with sorted keys
  prev_hash: string;
  hash: string;
}

export type RowStatus = 'valid' | 'corrupted_hash' | 'tampered_score';

export interface AuditRowVerification {
  index: number;
  entry: AuditEntry;
  storedScore?: ScoreRecord;
  status: RowStatus;
  computedHash: string;
  expectedPrevHash: string;
  discrepancy?: string;
}

export interface VerifyChainResult {
  valid: boolean;
  firstBrokenIndex: number | null;
  rows: AuditRowVerification[];
}

export const AUDIT_STORAGE_KEY = 'fairpitch_audit_chain_v1';
export const LIVE_AUDIT_STORAGE_KEY = 'fairpitch_live_audit_chain_v1';
const TAMPER_BACKUP_KEY = 'fairpitch_tamper_backup_v1';

/**
 * SHA-256 hash using browser / standard Web Crypto API.
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Serialize score into JSON payload with strictly sorted keys:
 * comment, criterion_id, judge_id, score, team_id, timestamp
 */
export function serializePayload(score: ScoreRecord): string {
  const sorted = {
    comment: score.comment,
    criterion_id: score.criterion_id,
    judge_id: score.judge_id,
    score: Number(score.score.toFixed(1)),
    team_id: score.team_id,
    timestamp: score.timestamp,
  };
  return JSON.stringify(sorted);
}

/**
 * Builds a complete audit hash chain from an ordered list of score records.
 * First entry uses prev_hash = "GENESIS".
 * Each subsequent entry uses prev_hash = chain[i - 1].hash.
 * hash = SHA256(prev_hash + payload).
 */
export async function buildChain(scores: ScoreRecord[]): Promise<AuditEntry[]> {
  const chain: AuditEntry[] = [];

  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const payload = serializePayload(s);
    const prev_hash = i === 0 ? 'GENESIS' : chain[i - 1].hash;
    const hash = await sha256(prev_hash + payload);

    chain.push({
      index: i,
      score_id: s.id,
      judge_id: s.judge_id,
      team_id: s.team_id,
      criterion_id: s.criterion_id,
      score: s.score,
      comment: s.comment,
      timestamp: s.timestamp,
      payload,
      prev_hash,
      hash,
    });
  }

  return chain;
}

/**
 * Retrieves the stored audit chain from localStorage or initializes it.
 */
export function getStoredChain(storageKey = AUDIT_STORAGE_KEY): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read audit chain from localStorage', e);
  }
  return [];
}

/**
 * Saves audit chain to localStorage.
 */
export function saveChain(chain: AuditEntry[], storageKey = AUDIT_STORAGE_KEY): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(chain));
  } catch (e) {
    console.error('Failed to save audit chain to localStorage', e);
  }
}

/**
 * Initializes audit chain on first load from scores if not already existing.
 */
export async function initAuditChain(
  scores: ScoreRecord[] = SEED_SCORES
): Promise<AuditEntry[]> {
  const existing = getStoredChain();
  if (existing.length > 0) {
    return existing;
  }
  const chain = await buildChain(scores);
  saveChain(chain);
  return chain;
}

/**
 * Appends a new score entry to the cryptographic audit chain.
 */
export async function addEntry(
  score: ScoreRecord,
  existingChain?: AuditEntry[]
): Promise<AuditEntry[]> {
  const chain = existingChain || getStoredChain();
  const index = chain.length;
  const payload = serializePayload(score);
  const prev_hash = index === 0 ? 'GENESIS' : chain[index - 1].hash;
  const hash = await sha256(prev_hash + payload);

  const entry: AuditEntry = {
    index,
    score_id: score.id,
    judge_id: score.judge_id,
    team_id: score.team_id,
    criterion_id: score.criterion_id,
    score: score.score,
    comment: score.comment,
    timestamp: score.timestamp,
    payload,
    prev_hash,
    hash,
  };

  const updatedChain = [...chain, entry];
  saveChain(updatedChain);
  return updatedChain;
}

/**
 * Verifies the audit chain integrity:
 * 1. Recomputes every cryptographic hash along the chain.
 * 2. Compares each entry's recorded payload with current stored score in localStorage.
 * Returns { valid, firstBrokenIndex, rows with status }.
 */
export async function verifyChain(
  chain?: AuditEntry[],
  currentScores?: ScoreRecord[]
): Promise<VerifyChainResult> {
  const activeChain = chain || getStoredChain();
  const scores = currentScores || getStoredScores();

  const rows: AuditRowVerification[] = [];
  let firstBrokenIndex: number | null = null;
  let isValid = true;

  for (let i = 0; i < activeChain.length; i++) {
    const entry = activeChain[i];
    const expectedPrev = i === 0 ? 'GENESIS' : activeChain[i - 1].hash;
    const computedHash = await sha256(entry.prev_hash + entry.payload);

    let status: RowStatus = 'valid';
    let discrepancy: string | undefined;

    // Check hash continuity
    if (entry.prev_hash !== expectedPrev || entry.hash !== computedHash) {
      status = 'corrupted_hash';
      discrepancy =
        entry.prev_hash !== expectedPrev
          ? `Broken link: expected prev_hash ${expectedPrev.substring(0, 8)}... but got ${entry.prev_hash.substring(0, 8)}...`
          : `Hash mismatch: expected ${computedHash.substring(0, 8)}... but got ${entry.hash.substring(0, 8)}...`;
    }

    // Compare payload with current stored score
    const storedScore = scores.find((s) => s.id === entry.score_id);
    if (!storedScore) {
      status = 'tampered_score';
      discrepancy = `Stored score record ${entry.score_id} not found in database.`;
    } else {
      const currentStoredPayload = serializePayload(storedScore);
      if (currentStoredPayload !== entry.payload) {
        status = 'tampered_score';
        discrepancy = `Score modified without audit log update! Audit log has ${entry.score.toFixed(1)}, but current store has ${storedScore.score.toFixed(1)}.`;
      }
    }

    if (status !== 'valid' && firstBrokenIndex === null) {
      firstBrokenIndex = i;
      isValid = false;
    }

    rows.push({
      index: i,
      entry,
      storedScore,
      status,
      computedHash,
      expectedPrevHash: expectedPrev,
      discrepancy,
    });
  }

  return {
    valid: isValid,
    firstBrokenIndex,
    rows,
  };
}

/**
 * Simulates tampering:
 * Modifies that stored score by +2 without touching the audit log.
 */
export function tamperDemo(scoreId?: string): {
  tamperedScoreId: string;
  originalScore: number;
  newScore: number;
} {
  const currentScores = getStoredScores();
  // Default to Team 4's score under Judge 3 or first score
  const targetId =
    scoreId ||
    currentScores.find((s) => s.judge_id === 'judge-3' && s.team_id === 'team-4')?.id ||
    currentScores[0].id;

  const targetIndex = currentScores.findIndex((s) => s.id === targetId);
  if (targetIndex === -1) {
    throw new Error(`Score ID ${targetId} not found`);
  }

  const original = currentScores[targetIndex];
  const originalScore = original.score;
  const newScore = Math.min(10, Number((originalScore + 2.0).toFixed(1)));

  // Save backup of original score before tampering
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        TAMPER_BACKUP_KEY,
        JSON.stringify({
          scoreId: targetId,
          originalScore,
          tamperedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.error('Failed to save tamper backup', e);
    }
  }

  const updatedScores = [...currentScores];
  updatedScores[targetIndex] = {
    ...original,
    score: newScore,
  };

  saveScores(updatedScores);

  return {
    tamperedScoreId: targetId,
    originalScore,
    newScore,
  };
}

/**
 * Restores the stored score back to its authentic audit state.
 */
export function restoreDemo(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const backupRaw = localStorage.getItem(TAMPER_BACKUP_KEY);
    const chain = getStoredChain();

    if (backupRaw) {
      const backup = JSON.parse(backupRaw);
      const currentScores = getStoredScores();
      const idx = currentScores.findIndex((s) => s.id === backup.scoreId);
      if (idx !== -1) {
        currentScores[idx].score = backup.originalScore;
        saveScores(currentScores);
        localStorage.removeItem(TAMPER_BACKUP_KEY);
        return true;
      }
    }

    // Fallback: restore from audit chain payloads if backup was missing
    if (chain.length > 0) {
      const currentScores = getStoredScores();
      for (const entry of chain) {
        const idx = currentScores.findIndex((s) => s.id === entry.score_id);
        if (idx !== -1) {
          try {
            const parsed = JSON.parse(entry.payload);
            currentScores[idx].score = parsed.score;
            currentScores[idx].comment = parsed.comment;
          } catch {}
        }
      }
      saveScores(currentScores);
      localStorage.removeItem(TAMPER_BACKUP_KEY);
      return true;
    }
  } catch (e) {
    console.error('Failed to restore demo score', e);
  }

  return false;
}
