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
  RenderModeSettings,
  ViewMode,
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
  wireframeHideHydrogens: boolean;
  renderModeSettings: RenderModeSettings;
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
  flyToTarget: { x: number; y: number; z: number } | null;
  flyToDistance: number | null;
  viewMode: ViewMode;
  clipDistance: number | null;
  showOnlyNearbyResidues: boolean;
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
  setWireframeHideHydrogens: (hide: boolean) => void;
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
  flyTo: (target: { x: number; y: number; z: number }, distance?: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setClipDistance: (distance: number | null) => void;
  setShowOnlyNearbyResidues: (show: boolean) => void;
  goToGlobalView: () => void;
  goToPocketView: () => void;
  goToLigandView: () => void;
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

const initialRenderSettings: RenderModeSettings = {
  surface: {
    coloring: 'electrostatic',
    opacity: 70,
    resolution: 1.0,
  },
  wireframe: {
    hideHydrogens: false,
  },
};

function getProteinCenter(protein: Protein): { x: number; y: number; z: number } {
  if (!protein || protein.atoms.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = protein.atoms.reduce(
    (acc, atom) => ({
      x: acc.x + atom.x,
      y: acc.y + atom.y,
      z: acc.z + atom.z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / protein.atoms.length,
    y: sum.y / protein.atoms.length,
    z: sum.z / protein.atoms.length,
  };
}

function getProteinRadius(protein: Protein, center: { x: number; y: number; z: number }): number {
  if (!protein || protein.atoms.length === 0) return 30;
  let maxDist = 0;
  protein.atoms.forEach((atom) => {
    const dx = atom.x - center.x;
    const dy = atom.y - center.y;
    const dz = atom.z - center.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > maxDist) maxDist = dist;
  });
  return maxDist + 10;
}

function getLigandCenter(ligand: Ligand, conformationIdx: number): { x: number; y: number; z: number } {
  const conf = ligand.conformations[conformationIdx];
  if (!conf || conf.atoms.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = conf.atoms.reduce(
    (acc, atom) => ({
      x: acc.x + atom.x,
      y: acc.y + atom.y,
      z: acc.z + atom.z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / conf.atoms.length,
    y: sum.y / conf.atoms.length,
    z: sum.z / conf.atoms.length,
  };
}

function getPocketCenter(pocketResidues: Residue[]): { x: number; y: number; z: number } {
  if (pocketResidues.length === 0) return { x: 0, y: 0, z: 0 };
  const atoms = pocketResidues.flatMap((r) => r.atoms);
  if (atoms.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = atoms.reduce(
    (acc, atom) => ({
      x: acc.x + atom.x,
      y: acc.y + atom.y,
      z: acc.z + atom.z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / atoms.length,
    y: sum.y / atoms.length,
    z: sum.z / atoms.length,
  };
}

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
  wireframeHideHydrogens: false,
  renderModeSettings: initialRenderSettings,
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
  flyToTarget: null,
  flyToDistance: null,
  viewMode: 'global',
  clipDistance: null,
  showOnlyNearbyResidues: false,

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

  setProteinRepresentation: (repr) => {
    const { renderModeSettings } = get();
    if (repr === 'surface') {
      set({
        proteinRepresentation: repr,
        surfaceColoring: renderModeSettings.surface.coloring,
        surfaceOpacity: renderModeSettings.surface.opacity,
        surfaceResolution: renderModeSettings.surface.resolution,
      });
    } else if (repr === 'wireframe') {
      set({
        proteinRepresentation: repr,
        wireframeHideHydrogens: renderModeSettings.wireframe.hideHydrogens,
      });
    } else {
      set({ proteinRepresentation: repr });
    }
  },
  setSurfaceColoring: (coloring) => {
    set({ surfaceColoring: coloring });
    set((state) => ({
      renderModeSettings: {
        ...state.renderModeSettings,
        surface: {
          ...state.renderModeSettings.surface,
          coloring,
        },
      },
    }));
  },
  setSurfaceOpacity: (opacity) => {
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    set({ surfaceOpacity: clampedOpacity });
    set((state) => ({
      renderModeSettings: {
        ...state.renderModeSettings,
        surface: {
          ...state.renderModeSettings.surface,
          opacity: clampedOpacity,
        },
      },
    }));
  },
  setSurfaceResolution: (res) => {
    const clampedRes = Math.max(0.5, Math.min(2.0, res));
    set({ surfaceResolution: clampedRes });
    set((state) => ({
      renderModeSettings: {
        ...state.renderModeSettings,
        surface: {
          ...state.renderModeSettings.surface,
          resolution: clampedRes,
        },
      },
    }));
  },
  setWireframeHideHydrogens: (hide) => {
    set({ wireframeHideHydrogens: hide });
    set((state) => ({
      renderModeSettings: {
        ...state.renderModeSettings,
        wireframe: {
          ...state.renderModeSettings.wireframe,
          hideHydrogens: hide,
        },
      },
    }));
  },

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

  flyTo: (target, distance) => {
    set({ flyToTarget: target, flyToDistance: distance || null });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setClipDistance: (distance) => set({ clipDistance: distance }),
  setShowOnlyNearbyResidues: (show) => set({ showOnlyNearbyResidues: show }),

  goToGlobalView: () => {
    const { protein, flyTo } = get();
    if (!protein) return;
    const center = getProteinCenter(protein);
    const radius = getProteinRadius(protein, center);
    set({
      viewMode: 'global',
      clipDistance: null,
      showOnlyNearbyResidues: false,
    });
    flyTo(center, radius);
  },

  goToPocketView: () => {
    const { pocketResidues, protein, flyTo } = get();
    if (pocketResidues.length === 0 && !protein) return;
    const center = pocketResidues.length > 0
      ? getPocketCenter(pocketResidues)
      : getProteinCenter(protein!);
    set({
      viewMode: 'pocket',
      clipDistance: 15,
      showOnlyNearbyResidues: false,
    });
    flyTo(center, 25);
  },

  goToLigandView: () => {
    const { ligand, currentConformation, flyTo } = get();
    if (!ligand) return;
    const center = getLigandCenter(ligand, currentConformation);
    set({
      viewMode: 'ligand',
      clipDistance: null,
      showOnlyNearbyResidues: true,
    });
    flyTo(center, 15);
  },

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
      proteinRepresentation: 'cartoon',
      surfaceColoring: 'electrostatic',
      surfaceOpacity: 70,
      surfaceResolution: 1.0,
      wireframeHideHydrogens: false,
      renderModeSettings: initialRenderSettings,
      rmsdMatrix: null,
      highlightedConformation: null,
      error: null,
      warnings: [],
      flyToTarget: null,
      flyToDistance: null,
      viewMode: 'global',
      clipDistance: null,
      showOnlyNearbyResidues: false,
    });
  },
}));
