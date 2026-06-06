import { create } from 'zustand';
import type {
  PharmacophoreModel,
  PharmacophoreFeature,
  ExcludedVolume,
  CandidateMolecule,
  ScoringResult,
  PharmacophoreState,
  PharmacophoreFeatureType,
  DistanceConstraint,
  ScoringLogEntry,
  ResultFilterConfig,
  ScoreGroup,
  PharmacophoreModelVersion,
  VersionDiff,
} from '../types';
import { DEFAULT_FEATURE_RADII } from '../types';

interface PharmacophoreActions {
  createModel: (name: string) => void;
  setModel: (model: PharmacophoreModel | null) => void;
  addFeature: (feature: Omit<PharmacophoreFeature, 'id' | 'radius' | 'isRequired'> & {
    radius?: number;
    isRequired?: boolean;
  }) => void;
  updateFeature: (id: string, updates: Partial<PharmacophoreFeature>) => void;
  updateFeatureType: (id: string, newType: PharmacophoreFeatureType) => void;
  removeFeature: (id: string) => void;
  clearFeatures: () => void;
  addExcludedVolume: (volume: Omit<ExcludedVolume, 'id' | 'radius'> & { radius?: number }) => void;
  updateExcludedVolume: (id: string, updates: Partial<ExcludedVolume>) => void;
  removeExcludedVolume: (id: string) => void;
  clearExcludedVolumes: () => void;
  addDistanceConstraint: (featureIdA: string, featureIdB: string, minDistance: number, maxDistance: number) => void;
  removeDistanceConstraint: (id: string) => void;
  clearDistanceConstraints: () => void;
  setCandidateMolecules: (molecules: CandidateMolecule[]) => void;
  clearCandidateMolecules: () => void;
  setScoringResults: (results: ScoringResult[]) => void;
  setSelectedResult: (result: ScoringResult | null) => void;
  toggleSelectedResult: (moleculeId: string) => void;
  clearSelectedResults: () => void;
  clearScoringResults: () => void;
  setIsScoring: (scoring: boolean) => void;
  setScoringProgress: (processed: number, total: number, message?: string) => void;
  setScoringMessage: (message: string) => void;
  setShowFeatures: (show: boolean) => void;
  setShowExcludedVolumes: (show: boolean) => void;
  setShowCandidateMolecule: (show: boolean) => void;
  setManualAddMode: (mode: 'none' | 'feature' | 'excluded') => void;
  setAddingFeatureType: (type: PharmacophoreFeatureType | null) => void;
  setOptionalMatchConfig: (min: number, max: number) => void;
  resetPharmacophore: () => void;
  toggleFeatureSelection: (featureId: string) => void;
  clearFeatureSelection: () => void;
  setResultFilter: (filter: Partial<ResultFilterConfig>) => void;
  resetResultFilter: () => void;
  setShowScoreGroups: (show: boolean) => void;
  toggleScoreGroupExpansion: (group: ScoreGroup) => void;
  addScoringLog: (entry: ScoringLogEntry) => void;
  clearScoringLogs: () => void;
  setShowScoringLogs: (show: boolean) => void;
  exportScoringLogs: () => string;
  saveModelVersion: (description?: string) => void;
  restoreModelVersion: (version: number) => void;
  setCompareVersion: (version: number | null) => void;
  compareVersions: (versionA: number, versionB: number) => VersionDiff | null;
  deleteModelVersion: (version: number) => void;
  clearModelVersions: () => void;
}

const initialState: PharmacophoreState = {
  model: null,
  candidateMolecules: [],
  scoringResults: [],
  selectedResult: null,
  selectedResults: [],
  isScoring: false,
  scoringProgress: 0,
  scoringTotal: 0,
  scoringMessage: '',
  showFeatures: true,
  showExcludedVolumes: true,
  showCandidateMolecule: true,
  manualAddMode: 'none',
  addingFeatureType: null,
  selectedFeatureIds: [],
  resultFilter: {
    minScore: -Infinity,
    maxScore: Infinity,
    minMatchedFeatures: 0,
    maxExcludedVolumePenalty: Infinity,
  },
  showScoreGroups: true,
  expandedScoreGroups: ['excellent', 'good', 'fair'],
  scoringLogs: [],
  showScoringLogs: false,
  modelVersions: [],
  currentVersion: null,
  compareVersion: null,
};

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createInitialFilter(): ResultFilterConfig {
  return {
    minScore: -Infinity,
    maxScore: Infinity,
    minMatchedFeatures: 0,
    maxExcludedVolumePenalty: Infinity,
  };
}

export const usePharmacophoreStore = create<PharmacophoreState & PharmacophoreActions>((set, get) => ({
  ...initialState,

  createModel: (name: string) => {
    const model: PharmacophoreModel = {
      id: generateId(),
      name,
      features: [],
      excludedVolumes: [],
      distanceConstraints: [],
      createdAt: Date.now(),
      minOptionalMatch: 0,
      maxOptionalMatch: 100,
    };
    set({ model, currentVersion: null, modelVersions: [], compareVersion: null });
  },

  setModel: (model) => set({ model }),

  addFeature: (featureData) => {
    const { model } = get();
    if (!model) return;

    const feature: PharmacophoreFeature = {
      id: generateId(),
      type: featureData.type,
      x: featureData.x,
      y: featureData.y,
      z: featureData.z,
      radius: featureData.radius ?? DEFAULT_FEATURE_RADII[featureData.type],
      isRequired: featureData.isRequired ?? true,
      normal: featureData.normal,
    };

    set({
      model: {
        ...model,
        features: [...model.features, feature],
      },
    });
  },

  updateFeature: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        features: model.features.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        ),
      },
    });
  },

  updateFeatureType: (id, newType) => {
    const { model } = get();
    if (!model) return;

    const newRadius = DEFAULT_FEATURE_RADII[newType];

    set({
      model: {
        ...model,
        features: model.features.map((f) =>
          f.id === id
            ? {
                ...f,
                type: newType,
                radius: newRadius,
                originalRadius: f.radius,
              }
            : f
        ),
      },
    });
  },

  removeFeature: (id) => {
    const { model } = get();
    if (!model) return;

    const updatedConstraints = model.distanceConstraints.filter(
      (c) => c.featureIdA !== id && c.featureIdB !== id
    );

    set({
      model: {
        ...model,
        features: model.features.filter((f) => f.id !== id),
        distanceConstraints: updatedConstraints,
      },
      selectedFeatureIds: get().selectedFeatureIds.filter((fid) => fid !== id),
    });
  },

  clearFeatures: () => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        features: [],
        distanceConstraints: [],
      },
      selectedFeatureIds: [],
    });
  },

  addExcludedVolume: (volumeData) => {
    const { model } = get();
    if (!model) return;

    const volume: ExcludedVolume = {
      id: generateId(),
      x: volumeData.x,
      y: volumeData.y,
      z: volumeData.z,
      radius: volumeData.radius ?? 1.5,
    };

    set({
      model: {
        ...model,
        excludedVolumes: [...model.excludedVolumes, volume],
      },
    });
  },

  updateExcludedVolume: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        excludedVolumes: model.excludedVolumes.map((v) =>
          v.id === id ? { ...v, ...updates } : v
        ),
      },
    });
  },

  removeExcludedVolume: (id) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        excludedVolumes: model.excludedVolumes.filter((v) => v.id !== id),
      },
    });
  },

  clearExcludedVolumes: () => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        excludedVolumes: [],
      },
    });
  },

  addDistanceConstraint: (featureIdA, featureIdB, minDistance, maxDistance) => {
    const { model } = get();
    if (!model) return;
    if (featureIdA === featureIdB) return;

    const exists = model.distanceConstraints.some(
      (c) =>
        (c.featureIdA === featureIdA && c.featureIdB === featureIdB) ||
        (c.featureIdA === featureIdB && c.featureIdB === featureIdA)
    );
    if (exists) return;

    const constraint: DistanceConstraint = {
      id: generateId(),
      featureIdA,
      featureIdB,
      minDistance,
      maxDistance,
    };

    set({
      model: {
        ...model,
        distanceConstraints: [...model.distanceConstraints, constraint],
      },
    });
  },

  removeDistanceConstraint: (id) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        distanceConstraints: model.distanceConstraints.filter((c) => c.id !== id),
      },
    });
  },

  clearDistanceConstraints: () => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        distanceConstraints: [],
      },
    });
  },

  setCandidateMolecules: (molecules) => set({ candidateMolecules: molecules }),

  clearCandidateMolecules: () => set({ candidateMolecules: [] }),

  setScoringResults: (results) => {
    const filtered = results.length > 0 ? [
      { minScore: Math.min(...results.map((r) => r.finalScore)), maxScore: Math.max(...results.map((r) => r.finalScore)) }
    ] : [];
    const defaultFilter = filtered.length > 0
      ? {
          minScore: filtered[0].minScore,
          maxScore: filtered[0].maxScore,
          minMatchedFeatures: 0,
          maxExcludedVolumePenalty: 0,
        }
      : createInitialFilter();

    set({
      scoringResults: results,
      resultFilter: defaultFilter,
    });
  },

  setSelectedResult: (result) => {
    if (result) {
      set({
        selectedResult: result,
        selectedResults: [result.moleculeId],
      });
    } else {
      set({
        selectedResult: null,
        selectedResults: [],
      });
    }
  },

  toggleSelectedResult: (moleculeId) => {
    const { selectedResults } = get();
    const isSelected = selectedResults.includes(moleculeId);

    let newSelected: string[];
    if (isSelected) {
      newSelected = selectedResults.filter((id) => id !== moleculeId);
    } else {
      if (selectedResults.length >= 5) {
        alert('最多只能同时选择5个分子进行对比');
        return;
      }
      newSelected = [...selectedResults, moleculeId];
    }

    const { scoringResults } = get();
    const newSelectedResult = newSelected.length > 0
      ? scoringResults.find((r) => r.moleculeId === newSelected[0]) || null
      : null;

    set({
      selectedResults: newSelected,
      selectedResult: newSelectedResult,
    });
  },

  clearSelectedResults: () => {
    set({
      selectedResults: [],
      selectedResult: null,
    });
  },

  clearScoringResults: () => set({
    scoringResults: [],
    selectedResult: null,
    selectedResults: [],
    resultFilter: createInitialFilter(),
  }),

  setIsScoring: (scoring) => set({ isScoring: scoring }),

  setScoringProgress: (processed, total, message) => {
    set({
      scoringProgress: processed,
      scoringTotal: total,
      scoringMessage: message || get().scoringMessage,
    });
  },

  setScoringMessage: (message) => set({ scoringMessage: message }),

  setShowFeatures: (show) => set({ showFeatures: show }),

  setShowExcludedVolumes: (show) => set({ showExcludedVolumes: show }),

  setShowCandidateMolecule: (show) => set({ showCandidateMolecule: show }),

  setManualAddMode: (mode) => set({ manualAddMode: mode, addingFeatureType: mode === 'none' ? null : get().addingFeatureType }),

  setAddingFeatureType: (type) => set({ addingFeatureType: type }),

  setOptionalMatchConfig: (min, max) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        minOptionalMatch: min,
        maxOptionalMatch: max,
      },
    });
  },

  resetPharmacophore: () => set(initialState),

  toggleFeatureSelection: (featureId) => {
    const { selectedFeatureIds } = get();
    const isSelected = selectedFeatureIds.includes(featureId);

    set({
      selectedFeatureIds: isSelected
        ? selectedFeatureIds.filter((id) => id !== featureId)
        : [...selectedFeatureIds, featureId],
    });
  },

  clearFeatureSelection: () => {
    set({ selectedFeatureIds: [] });
  },

  setResultFilter: (filter) => {
    const { resultFilter } = get();
    set({
      resultFilter: {
        ...resultFilter,
        ...filter,
      },
    });
  },

  resetResultFilter: () => {
    const { scoringResults } = get();
    if (scoringResults.length > 0) {
      const minScore = Math.min(...scoringResults.map((r) => r.finalScore));
      const maxScore = Math.max(...scoringResults.map((r) => r.finalScore));
      set({
        resultFilter: {
          minScore,
          maxScore,
          minMatchedFeatures: 0,
          maxExcludedVolumePenalty: 0,
        },
      });
    } else {
      set({ resultFilter: createInitialFilter() });
    }
  },

  setShowScoreGroups: (show) => set({ showScoreGroups: show }),

  toggleScoreGroupExpansion: (group) => {
    const { expandedScoreGroups } = get();
    const isExpanded = expandedScoreGroups.includes(group);

    set({
      expandedScoreGroups: isExpanded
        ? expandedScoreGroups.filter((g) => g !== group)
        : [...expandedScoreGroups, group],
    });
  },

  addScoringLog: (entry) => {
    const { scoringLogs } = get();
    const newLogs = [...scoringLogs, entry];
    if (newLogs.length > 200) {
      newLogs.shift();
    }
    set({ scoringLogs: newLogs });
  },

  clearScoringLogs: () => set({ scoringLogs: [] }),

  setShowScoringLogs: (show) => set({ showScoringLogs: show }),

  exportScoringLogs: () => {
    const { scoringLogs } = get();
    const lines = scoringLogs.map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `[${time}] ${entry.moleculeName} -> 提取了${entry.featureCount}个特征点 -> 匹配了${entry.matchedRequired}/${entry.totalRequired}个必须特征 -> 排除体积侵入${entry.intrudingAtomCount}个原子 -> 距离约束违反${entry.distanceConstraintViolations}条 -> 最终得分${entry.finalScore}`;
    });
    return lines.join('\n');
  },

  saveModelVersion: (description) => {
    const { model, modelVersions } = get();
    if (!model) return;

    const newVersion: PharmacophoreModelVersion = {
      version: modelVersions.length + 1,
      name: `版本 ${modelVersions.length + 1}`,
      createdAt: Date.now(),
      features: JSON.parse(JSON.stringify(model.features)),
      excludedVolumes: JSON.parse(JSON.stringify(model.excludedVolumes)),
      distanceConstraints: JSON.parse(JSON.stringify(model.distanceConstraints)),
      featureCount: model.features.length,
      excludedVolumeCount: model.excludedVolumes.length,
      description,
    };

    set({
      modelVersions: [...modelVersions, newVersion],
      currentVersion: newVersion.version,
    });
  },

  restoreModelVersion: (version) => {
    const { model, modelVersions } = get();
    const targetVersion = modelVersions.find((v) => v.version === version);
    if (!targetVersion || !model) return;

    set({
      model: {
        ...model,
        features: JSON.parse(JSON.stringify(targetVersion.features)),
        excludedVolumes: JSON.parse(JSON.stringify(targetVersion.excludedVolumes)),
        distanceConstraints: JSON.parse(JSON.stringify(targetVersion.distanceConstraints)),
      },
      currentVersion: version,
      selectedFeatureIds: [],
    });
  },

  setCompareVersion: (version) => {
    set({ compareVersion: version });
  },

  compareVersions: (versionA, versionB) => {
    const { modelVersions } = get();
    const vA = modelVersions.find((v) => v.version === versionA);
    const vB = modelVersions.find((v) => v.version === versionB);

    if (!vA || !vB) return null;

    const added: PharmacophoreFeature[] = [];
    const removed: PharmacophoreFeature[] = [];
    const modified: { old: PharmacophoreFeature; new: PharmacophoreFeature }[] = [];

    const featuresA = new Map(vA.features.map((f) => [f.id, f]));
    const featuresB = new Map(vB.features.map((f) => [f.id, f]));

    for (const [id, featB] of featuresB) {
      if (!featuresA.has(id)) {
        added.push(featB);
      } else {
        const featA = featuresA.get(id)!;
        if (
          featA.type !== featB.type ||
          featA.x !== featB.x ||
          featA.y !== featB.y ||
          featA.z !== featB.z ||
          featA.radius !== featB.radius ||
          featA.isRequired !== featB.isRequired
        ) {
          modified.push({ old: featA, new: featB });
        }
      }
    }

    for (const [id, featA] of featuresA) {
      if (!featuresB.has(id)) {
        removed.push(featA);
      }
    }

    return { added, removed, modified };
  },

  deleteModelVersion: (version) => {
    const { modelVersions, currentVersion } = get();
    const newVersions = modelVersions.filter((v) => v.version !== version);
    set({
      modelVersions: newVersions,
      currentVersion: currentVersion === version ? null : currentVersion,
      compareVersion: get().compareVersion === version ? null : get().compareVersion,
    });
  },

  clearModelVersions: () => {
    set({
      modelVersions: [],
      currentVersion: null,
      compareVersion: null,
    });
  },
}));
