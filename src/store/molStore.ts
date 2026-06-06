import { create } from 'zustand';
import type {
  Protein,
  Ligand,
  Interaction,
  Measurement,
  ProteinRepresentation,
  SurfaceColoring,
  InteractionType,
  Residue,
  Atom,
  RMSDMatrix,
} from '../types';
import { detectInteractions } from '../analysis/interactionDetector';
import { generateRMSDMatrix } from '../analysis/rmsdCalculator';
import {
  createDistanceMeasurement,
  createAngleMeasurement,
  createDihedralMeasurement,
} from '../analysis/measurementTools';

interface MolState {
  protein: Protein | null;
  ligand: Ligand | null;
  currentConformation: number;
  visibleConformations: number[];
  interactions: Interaction[];
  pocketResidues: Residue[];
  hasIncompletePocket: boolean;
  pocketHasMissing: boolean;
  measurements: Measurement[];
  selectedAtoms: Atom[];
  measurementMode: 'none' | 'distance' | 'angle' | 'dihedral';
  proteinRepresentation: ProteinRepresentation;
  surfaceColoring: SurfaceColoring;
  surfaceOpacity: number;
  surfaceResolution: number;
  visibleChains: Set<string>;
  visibleInteractionTypes: Set<InteractionType>;
  rmsdMatrix: RMSDMatrix | null;
  highlightedConformation: number | null;
  loading: boolean;
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  error: string | null;
  warnings: string[];
  cameraTarget: { x: number; y: number; z: number };
}

interface MolActions {
  setProtein: (protein: Protein | null) => void;
  setLigand: (ligand: Ligand | null) => void;
  setCurrentConformation: (index: number) => void;
  toggleConformationVisibility: (index: number) => void;
  setProteinRepresentation: (repr: ProteinRepresentation) => void;
  setSurfaceColoring: (coloring: SurfaceColoring) => void;
  setSurfaceOpacity: (opacity: number) => void;
  setSurfaceResolution: (res: number) => void;
  toggleChainVisibility: (chainId: string) => void;
  toggleChain: (chainId: string) => void;
  toggleInteractionType: (type: InteractionType) => void;
  computeInteractions: () => Promise<void>;
  computeRMSDMatrix: () => void;
  setMeasurementMode: (mode: 'none' | 'distance' | 'angle' | 'dihedral') => void;
  addMeasurement: (measurement: Measurement) => void;
  removeMeasurement: (id: string) => void;
  clearMeasurements: () => void;
  selectAtom: (atom: Atom) => void;
  clearSelectedAtoms: () => void;
  setHighlightedConformation: (index: number | null) => void;
  setCameraTarget: (target: { x: number; y: number; z: number }) => void;
  setLoading: (loading: boolean, message?: string) => void;
  setLoadingProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  addWarning: (warning: string) => void;
  clearWarnings: () => void;
  resetAll: () => void;
}

const initialVisibleInteractions: Set<InteractionType> = new Set([
  'hydrogen_bond',
  'hydrophobic',
  'pi_pi',
  'salt_bridge',
  'halogen_bond',
]);

export const useMolStore = create<MolState & MolActions>((set, get) => ({
  protein: null,
  ligand: null,
  currentConformation: 0,
  visibleConformations: [0],
  interactions: [],
  pocketResidues: [],
  hasIncompletePocket: false,
  pocketHasMissing: false,
  measurements: [],
  selectedAtoms: [],
  measurementMode: 'none',
  proteinRepresentation: 'cartoon',
  surfaceColoring: 'electrostatic',
  surfaceOpacity: 70,
  surfaceResolution: 1.0,
  visibleChains: new Set(),
  visibleInteractionTypes: initialVisibleInteractions,
  rmsdMatrix: null,
  highlightedConformation: null,
  loading: false,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  error: null,
  warnings: [],
  cameraTarget: { x: 0, y: 0, z: 0 },

  setProtein: (protein) => {
    const visibleChains = new Set<string>();
    if (protein) {
      protein.chains.forEach((chain, id) => {
        if (chain.visible) visibleChains.add(id);
      });
    }
    set({ protein, visibleChains });
  },

  setLigand: (ligand) => {
    set({
      ligand,
      currentConformation: ligand?.currentConformation || 0,
      visibleConformations: ligand?.visibleConformations || [0],
    });
  },

  setCurrentConformation: (index) => {
    const { ligand } = get();
    if (!ligand || index >= ligand.conformations.length) return;
    set({ currentConformation: index });
    get().computeInteractions();
  },

  toggleConformationVisibility: (index) => {
    const { visibleConformations } = get();
    const newVisible = new Set(visibleConformations);
    if (newVisible.has(index)) {
      newVisible.delete(index);
    } else {
      newVisible.add(index);
    }
    set({ visibleConformations: Array.from(newVisible) });
  },

  setProteinRepresentation: (repr) => set({ proteinRepresentation: repr }),
  setSurfaceColoring: (coloring) => set({ surfaceColoring: coloring }),
  setSurfaceOpacity: (opacity) => set({ surfaceOpacity: Math.max(0, Math.min(100, opacity)) }),
  setSurfaceResolution: (res) => set({ surfaceResolution: Math.max(0.5, Math.min(2.0, res)) }),

  toggleChainVisibility: (chainId) => {
    const { visibleChains } = get();
    const newVisible = new Set(visibleChains);
    if (newVisible.has(chainId)) {
      newVisible.delete(chainId);
    } else {
      newVisible.add(chainId);
    }
    set({ visibleChains: newVisible });
  },

  toggleChain: (chainId) => {
    const { visibleChains } = get();
    const newVisible = new Set(visibleChains);
    if (newVisible.has(chainId)) {
      newVisible.delete(chainId);
    } else {
      newVisible.add(chainId);
    }
    set({ visibleChains: newVisible });
  },

  toggleInteractionType: (type) => {
    const { visibleInteractionTypes } = get();
    const newVisible = new Set(visibleInteractionTypes);
    if (newVisible.has(type)) {
      newVisible.delete(type);
    } else {
      newVisible.add(type);
    }
    set({ visibleInteractionTypes: newVisible });
  },

  computeInteractions: async () => {
    const { protein, ligand, currentConformation } = get();
    if (!protein || !ligand) return;

    const conformation = ligand.conformations[currentConformation];
    if (!conformation) return;

    set({ isLoading: true, loadingMessage: 'Detecting interactions...' });

    try {
      const isLarge = conformation.atoms.length > 200;
      if (isLarge) {
        set({ loadingMessage: 'Large ligand, computing interactions asynchronously...' });
      }

      const result = await detectInteractions(conformation, protein);

      const warnings: string[] = [];
      if (result.hasMissing) {
        warnings.push('结合口袋不完整,结果可能不准确');
      }

      set({
        interactions: result.interactions,
        pocketResidues: result.pocketResidues,
        hasIncompletePocket: result.hasMissing,
        pocketHasMissing: result.hasMissing,
        warnings,
        isLoading: false,
        loading: false,
      });
    } catch (e) {
      set({
        error: 'Failed to compute interactions',
        isLoading: false,
      });
    }
  },

  computeRMSDMatrix: () => {
    const { ligand } = get();
    if (!ligand) return;
    const matrix = generateRMSDMatrix(ligand.conformations);
    set({ rmsdMatrix: matrix });
  },

  setMeasurementMode: (mode) => {
    set({ measurementMode: mode, selectedAtoms: [] });
  },

  addMeasurement: (measurement) => {
    set((state) => ({
      measurements: [...state.measurements, measurement],
      selectedAtoms: [],
      measurementMode: 'none',
    }));
  },

  removeMeasurement: (id) => {
    set((state) => ({
      measurements: state.measurements.filter((m) => m.id !== id),
    }));
  },

  clearMeasurements: () => set({ measurements: [] }),

  selectAtom: (atom) => {
    const { selectedAtoms, measurementMode, addMeasurement } = get();
    if (measurementMode === 'none') return;

    const newSelected = [...selectedAtoms, atom];

    if (measurementMode === 'distance' && newSelected.length === 2) {
      const measurement = createDistanceMeasurement(newSelected as [Atom, Atom]);
      addMeasurement(measurement);
      return;
    }

    if (measurementMode === 'angle' && newSelected.length === 3) {
      const measurement = createAngleMeasurement(newSelected as [Atom, Atom, Atom]);
      addMeasurement(measurement);
      return;
    }

    if (measurementMode === 'dihedral' && newSelected.length === 4) {
      const measurement = createDihedralMeasurement(newSelected as [Atom, Atom, Atom, Atom]);
      addMeasurement(measurement);
      return;
    }

    set({ selectedAtoms: newSelected });
  },

  clearSelectedAtoms: () => set({ selectedAtoms: [] }),

  setHighlightedConformation: (index) => {
    set({ highlightedConformation: index });
    if (index !== null) {
      set({ currentConformation: index });
      get().computeInteractions();
    }
  },

  setCameraTarget: (target) => set({ cameraTarget: target }),

  setLoading: (loading, message = '') => set({ loading, isLoading: loading, loadingMessage: message, loadingProgress: 0 }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setError: (error) => set({ error }),
  addWarning: (warning) => set((state) => ({ warnings: [...state.warnings, warning] })),
  clearWarnings: () => set({ warnings: [] }),

  resetAll: () => {
    set({
      protein: null,
      ligand: null,
      currentConformation: 0,
      visibleConformations: [0],
      interactions: [],
      pocketResidues: [],
      hasIncompletePocket: false,
      measurements: [],
      selectedAtoms: [],
      measurementMode: 'none',
      rmsdMatrix: null,
      highlightedConformation: null,
      error: null,
      warnings: [],
    });
  },
}));
