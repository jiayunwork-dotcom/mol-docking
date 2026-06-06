import type {
  PharmacophoreModel,
  CandidateMolecule,
  ScoringProgressData,
  ScoringCompleteData,
  WorkerMessage,
  ScoringLogEntry,
  ScoringLogData,
} from '../types';
import { scoreMultipleCandidates } from '../analysis/pharmacophoreScoring';

let isCancelled = false;

interface WorkerInput {
  model: PharmacophoreModel;
  candidates: CandidateMolecule[];
}

self.onmessage = function(e: MessageEvent) {
  const { type, payload } = e.data as WorkerMessage;

  if (type === 'cancel') {
    isCancelled = true;
    return;
  }

  if (type === 'start') {
    isCancelled = false;
    const { model, candidates } = payload as WorkerInput;

    try {
      const startTime = Date.now();

      const results = scoreMultipleCandidates(
        candidates,
        model,
        (processed, total, currentName, elapsedMs) => {
          const progressData: ScoringProgressData = {
            processed,
            total,
            currentName,
            elapsedMs,
          };
          self.postMessage({
            type: 'progress',
            payload: progressData,
          } as WorkerMessage);
        },
        () => isCancelled,
        (entry: ScoringLogEntry) => {
          const logData: ScoringLogData = {
            entry,
          };
          self.postMessage({
            type: 'log',
            payload: logData,
          } as WorkerMessage);
        }
      );

      const totalMs = Date.now() - startTime;
      const completeData: ScoringCompleteData = {
        results,
        totalMs,
      };
      self.postMessage({
        type: 'complete',
        payload: completeData,
      } as WorkerMessage);

    } catch (error) {
      self.postMessage({
        type: 'error',
        payload: error instanceof Error ? error.message : '未知错误',
      } as WorkerMessage);
    }
  }
};

export {};
