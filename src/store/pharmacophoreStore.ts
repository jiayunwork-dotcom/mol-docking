import { create } from 'zustand';
import type {
  PharmacophoreModel,
  PharmacophoreFeature,
  ExcludedVolume,
  CandidateMolecule,
  ScoringResult,
  PharmacophoreState,
  PharmacophoreFeatureType,
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
  removeFeature: (id: string) => void;
  clearFeatures: () => void;
  addExcludedVolume: (volume: Omit<ExcludedVolume, 'id' | 'radius'> & { radius?: number }) => void;
  updateExcludedVolume: (id: string, updates: Partial<ExcludedVolume>) => void;
  removeExcludedVolume: (id: string) => void;
  clearExcludedVolumes: () => void;
  setCandidateMolecules: (molecules: CandidateMolecule[]) => void;
  clearCandidateMolecules: () => void;
  setScoringResults: (results: ScoringResult[]) => void;
  setSelectedResult: (result: ScoringResult | null) => void;
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
}

const initialState: PharmacophoreState = {
  model: null,
  candidateMolecules: [],
  scoringResults: [],
  selectedResult: null,
  isScoring: false,
  scoringProgress: 0,
  scoringTotal: 0,
  scoringMessage: '',
  showFeatures: true,
  showExcludedVolumes: true,
  showCandidateMolecule: true,
  manualAddMode: 'none',
  addingFeatureType: null,
};

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const usePharmacophoreStore = create<PharmacophoreState & PharmacophoreActions>((set, get) => ({
  ...initialState,

  createModel: (name: string) => {
    const model: PharmacophoreModel = {
      id: generateId(),
      name,
      features: [],
      excludedVolumes: [],
      createdAt: Date.now(),
      minOptionalMatch: 0,
      maxOptionalMatch: 100,
    };
    set({ model });
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

  removeFeature: (id) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        features: model.features.filter((f) => f.id !== id),
      },
    });
  },

  clearFeatures: () => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        features: [],
      },
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

  setCandidateMolecules: (molecules) => set({ candidateMolecules: molecules }),

  clearCandidateMolecules: () => set({ candidateMolecules: [] }),

  setScoringResults: (results) => set({ scoringResults: results }),

  setSelectedResult: (result) => set({ selectedResult: result }),

  clearScoringResults: () => set({ scoringResults: [], selectedResult: null }),

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
}));
