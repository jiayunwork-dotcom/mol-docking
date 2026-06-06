import type {
  PharmacophoreModel,
  PharmacophoreFeature,
  CandidateMolecule,
  ScoringResult,
  FeatureMatch,
  LigandConformation,
  DistanceConstraint,
  ScoringLogEntry,
} from '../types';
import { extractPharmacophoreFeatures } from './pharmacophoreExtractor';

function distance3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function angleBetweenNormals(
  n1: { x: number; y: number; z: number },
  n2: { x: number; y: number; z: number }
): number {
  const dot = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  const len1 = Math.sqrt(n1.x * n1.x + n1.y * n1.y + n1.z * n1.z);
  const len2 = Math.sqrt(n2.x * n2.x + n2.y * n2.y + n2.z * n2.z);
  const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return Math.acos(cosAngle) * 180 / Math.PI;
}

interface PotentialMatch {
  modelFeature: PharmacophoreFeature;
  candidateFeature: PharmacophoreFeature;
  distance: number;
  angleValid: boolean;
}

function findPotentialMatches(
  modelFeatures: PharmacophoreFeature[],
  candidateFeatures: PharmacophoreFeature[]
): PotentialMatch[] {
  const matches: PotentialMatch[] = [];

  for (const modelFeat of modelFeatures) {
    for (const candFeat of candidateFeatures) {
      if (modelFeat.type !== candFeat.type) continue;

      const dist = distance3D(modelFeat, candFeat);
      if (dist > modelFeat.radius) continue;

      let angleValid = true;
      if (modelFeat.type === 'aromatic_ring' && modelFeat.normal && candFeat.normal) {
        const angle = angleBetweenNormals(modelFeat.normal, candFeat.normal);
        const minAngle = Math.min(angle, 180 - angle);
        if (minAngle > 30) {
          angleValid = false;
        }
      }

      matches.push({
        modelFeature: modelFeat,
        candidateFeature: candFeat,
        distance: dist,
        angleValid,
      });
    }
  }

  return matches;
}

function greedyMatching(
  modelFeatures: PharmacophoreFeature[],
  candidateFeatures: PharmacophoreFeature[]
): { matches: FeatureMatch[] } {
  const potentialMatches = findPotentialMatches(modelFeatures, candidateFeatures)
    .filter(m => m.angleValid)
    .sort((a, b) => a.distance - b.distance);

  const usedModelIds = new Set<string>();
  const usedCandidateIds = new Set<string>();
  const matches: FeatureMatch[] = [];

  for (const pm of potentialMatches) {
    if (usedModelIds.has(pm.modelFeature.id)) continue;
    if (usedCandidateIds.has(pm.candidateFeature.id)) continue;

    matches.push({
      modelFeatureId: pm.modelFeature.id,
      candidateFeatureId: pm.candidateFeature.id,
      distance: pm.distance,
    });

    usedModelIds.add(pm.modelFeature.id);
    usedCandidateIds.add(pm.candidateFeature.id);
  }

  return { matches };
}

function countIntrudingAtoms(
  conformation: LigandConformation,
  excludedVolumes: { x: number; y: number; z: number; radius: number }[]
): number {
  let count = 0;
  const atoms = conformation.atoms.filter(a => !a.isHydrogen);

  for (const atom of atoms) {
    for (const volume of excludedVolumes) {
      const dist = distance3D(atom, volume);
      if (dist < volume.radius) {
        count++;
        break;
      }
    }
  }

  return count;
}

function checkDistanceConstraints(
  matches: FeatureMatch[],
  constraints: DistanceConstraint[],
  _modelFeatures: PharmacophoreFeature[],
  candidateFeatures: PharmacophoreFeature[]
): { violations: number; penalty: number } {
  let violations = 0;
  const candidateFeatureMap = new Map(candidateFeatures.map(f => [f.id, f]));
  const modelToCandidateMap = new Map(matches.map(m => [m.modelFeatureId, m.candidateFeatureId]));

  for (const constraint of constraints) {
    const candIdA = modelToCandidateMap.get(constraint.featureIdA);
    const candIdB = modelToCandidateMap.get(constraint.featureIdB);

    if (!candIdA || !candIdB) {
      continue;
    }

    const candFeatA = candidateFeatureMap.get(candIdA);
    const candFeatB = candidateFeatureMap.get(candIdB);

    if (!candFeatA || !candFeatB) {
      continue;
    }

    const distance = distance3D(candFeatA, candFeatB);

    if (distance < constraint.minDistance || distance > constraint.maxDistance) {
      violations++;
    }
  }

  return {
    violations,
    penalty: violations * (-10),
  };
}

export function scoreConformation(
  conformation: LigandConformation,
  model: PharmacophoreModel
): {
  score: number;
  baseScore: number;
  excludedVolumePenalty: number;
  distanceConstraintPenalty: number;
  distanceConstraintViolations: number;
  matches: FeatureMatch[];
  matchedRequiredCount: number;
  matchedOptionalCount: number;
  unmatchedRequiredCount: number;
  intrudingAtomCount: number;
  candidateFeatures: PharmacophoreFeature[];
} {
  const candidateFeatures = extractPharmacophoreFeatures(conformation);

  const requiredFeatures = model.features.filter(f => f.isRequired);
  const optionalFeatures = model.features.filter(f => !f.isRequired);

  const { matches } = greedyMatching(model.features, candidateFeatures);

  const matchedModelIds = new Set(matches.map(m => m.modelFeatureId));
  const matchedRequiredCount = requiredFeatures.filter(f => matchedModelIds.has(f.id)).length;
  const matchedOptionalCount = optionalFeatures.filter(f => matchedModelIds.has(f.id)).length;
  const unmatchedRequiredCount = requiredFeatures.filter(f => !matchedModelIds.has(f.id)).length;

  const clampedOptionalCount = Math.min(
    Math.max(matchedOptionalCount, model.minOptionalMatch),
    model.maxOptionalMatch
  );

  const baseScore =
    matchedRequiredCount * 10 +
    clampedOptionalCount * 5 -
    unmatchedRequiredCount * 20;

  const intrudingAtomCount = countIntrudingAtoms(conformation, model.excludedVolumes);
  const excludedVolumePenalty = intrudingAtomCount * (-15);

  const { violations: distanceConstraintViolations, penalty: distanceConstraintPenalty } = checkDistanceConstraints(
    matches,
    model.distanceConstraints || [],
    model.features,
    candidateFeatures
  );

  const finalScore = baseScore + excludedVolumePenalty + distanceConstraintPenalty;

  return {
    score: finalScore,
    baseScore,
    excludedVolumePenalty,
    distanceConstraintPenalty,
    distanceConstraintViolations,
    matches,
    matchedRequiredCount,
    matchedOptionalCount,
    unmatchedRequiredCount,
    intrudingAtomCount,
    candidateFeatures,
  };
}

export function scoreCandidateMolecule(
  candidate: CandidateMolecule,
  model: PharmacophoreModel,
  onLog?: (entry: ScoringLogEntry) => void
): ScoringResult {
  let bestResult: ReturnType<typeof scoreConformation> | null = null;
  let bestConformationIndex = 0;

  for (let i = 0; i < candidate.conformations.length; i++) {
    const conf = candidate.conformations[i];
    const result = scoreConformation(conf, model);

    if (!bestResult || result.score > bestResult.score) {
      bestResult = result;
      bestConformationIndex = i;
    }
  }

  if (!bestResult) {
    return {
      moleculeId: candidate.id,
      moleculeName: candidate.name,
      smiles: candidate.smiles,
      finalScore: 0,
      baseScore: 0,
      excludedVolumePenalty: 0,
      distanceConstraintPenalty: 0,
      distanceConstraintViolations: 0,
      matchedRequiredCount: 0,
      matchedOptionalCount: 0,
      totalRequiredCount: model.features.filter(f => f.isRequired).length,
      totalOptionalCount: model.features.filter(f => !f.isRequired).length,
      unmatchedRequiredCount: model.features.filter(f => f.isRequired).length,
      intrudingAtomCount: 0,
      matchedFeatures: [],
      bestConformationIndex: 0,
      candidateFeatures: [],
    };
  }

  if (onLog) {
    const logEntry: ScoringLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      moleculeName: candidate.name,
      featureCount: bestResult.candidateFeatures.length,
      matchedRequired: bestResult.matchedRequiredCount,
      totalRequired: model.features.filter(f => f.isRequired).length,
      intrudingAtomCount: bestResult.intrudingAtomCount,
      finalScore: bestResult.score,
      distanceConstraintViolations: bestResult.distanceConstraintViolations,
    };
    onLog(logEntry);
  }

  return {
    moleculeId: candidate.id,
    moleculeName: candidate.name,
    smiles: candidate.smiles,
    finalScore: bestResult.score,
    baseScore: bestResult.baseScore,
    excludedVolumePenalty: bestResult.excludedVolumePenalty,
    distanceConstraintPenalty: bestResult.distanceConstraintPenalty,
    distanceConstraintViolations: bestResult.distanceConstraintViolations,
    matchedRequiredCount: bestResult.matchedRequiredCount,
    matchedOptionalCount: bestResult.matchedOptionalCount,
    totalRequiredCount: model.features.filter(f => f.isRequired).length,
    totalOptionalCount: model.features.filter(f => !f.isRequired).length,
    unmatchedRequiredCount: bestResult.unmatchedRequiredCount,
    intrudingAtomCount: bestResult.intrudingAtomCount,
    matchedFeatures: bestResult.matches,
    bestConformationIndex,
    candidateFeatures: bestResult.candidateFeatures,
  };
}

export function scoreMultipleCandidates(
  candidates: CandidateMolecule[],
  model: PharmacophoreModel,
  onProgress?: (processed: number, total: number, currentName: string, elapsedMs: number) => void,
  shouldCancel?: () => boolean,
  onLog?: (entry: ScoringLogEntry) => void
): ScoringResult[] {
  const results: ScoringResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < candidates.length; i++) {
    if (shouldCancel?.()) {
      break;
    }

    const candidate = candidates[i];
    const result = scoreCandidateMolecule(candidate, model, onLog);
    results.push(result);

    if (onProgress && ((i + 1) % 10 === 0 || i === candidates.length - 1)) {
      const elapsed = Date.now() - startTime;
      onProgress(i + 1, candidates.length, candidate.name, elapsed);
    }
  }

  return results.sort((a, b) => b.finalScore - a.finalScore);
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m${remainingSeconds}s`;
}

export function estimateRemainingTime(
  processed: number,
  total: number,
  elapsedMs: number
): string {
  if (processed === 0) return '计算中...';
  const rate = elapsedMs / processed;
  const remaining = rate * (total - processed);
  return formatTime(remaining);
}

export function getScoreGroup(score: number): 'excellent' | 'good' | 'fair' {
  if (score >= 80) return 'excellent';
  if (score >= 40) return 'good';
  return 'fair';
}

export const SCORE_GROUP_LABELS: Record<'excellent' | 'good' | 'fair', string> = {
  excellent: '优秀 (≥80分)',
  good: '良好 (40~79分)',
  fair: '一般 (<40分)',
};

export const SCORE_GROUP_COLORS: Record<'excellent' | 'good' | 'fair', string> = {
  excellent: '#22c55e',
  good: '#eab308',
  fair: '#ef4444',
};
