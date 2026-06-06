export type Element = 'C' | 'N' | 'O' | 'S' | 'P' | 'F' | 'Cl' | 'Br' | 'I' | 'H' | 'Other';

export type SecondaryStructure = 'helix' | 'sheet' | 'loop';

export type ProteinRepresentation = 'cartoon' | 'surface' | 'wireframe';

export type SurfaceColoring = 'electrostatic' | 'hydrophobic' | 'hbond';

export type ViewMode = 'global' | 'pocket' | 'ligand';

export interface RenderModeSettings {
  surface: {
    coloring: SurfaceColoring;
    opacity: number;
    resolution: number;
  };
  wireframe: {
    hideHydrogens: boolean;
  };
}

export type InteractionType = 'hydrogen_bond' | 'hydrophobic' | 'pi_pi' | 'salt_bridge' | 'halogen_bond';

export interface Atom {
  id: number;
  element: Element;
  x: number;
  y: number;
  z: number;
  chainId: string;
  residueName: string;
  residueId: number;
  atomName: string;
  formalCharge?: number;
  charge?: number;
  vdwRadius: number;
  isHydrogen: boolean;
  isAromatic?: boolean;
}

export interface Bond {
  atom1: number;
  atom2: number;
  order: 1 | 2 | 3 | 4;
}

export interface Residue {
  id: number;
  name: string;
  chainId: string;
  seqNum: number;
  atoms: Atom[];
  secondaryStructure: SecondaryStructure;
  isMissing: boolean;
  hydrophobicity?: number;
}

export interface Chain {
  id: string;
  name: string;
  residues: Residue[];
  visible: boolean;
}

export interface Protein {
  id: string;
  name: string;
  atoms: Atom[];
  chains: Map<string, Chain>;
  hasMissingResidues: boolean;
  filename: string;
  format: 'pdb' | 'mmcif';
  numResidues: number;
}

export interface LigandConformation {
  id: number;
  atoms: Atom[];
  bonds: Bond[];
  bindingEnergy: number;
  rmsd: number | null;
  name: string;
}

export interface Ligand {
  id: string;
  name: string;
  conformations: LigandConformation[];
  currentConformation: number;
  filename: string;
  format: 'sdf' | 'mol2';
  visibleConformations: number[];
}

export interface Interaction {
  type: InteractionType;
  donorAtom?: Atom;
  acceptorAtom?: Atom;
  donorResidue?: Residue;
  acceptorResidue?: Residue;
  distance: number;
  angle?: number;
}

export interface Measurement {
  id: string;
  type: 'distance' | 'angle' | 'dihedral';
  atoms: Atom[];
  value: number;
  position: { x: number; y: number; z: number };
}

export interface SurfacePoint {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  potential?: number;
  hydrophobicity?: number;
  isDonor?: boolean;
  isAcceptor?: boolean;
}

export interface SurfaceMesh {
  vertices: number[];
  indices: number[];
  colors: number[];
  triangleCount: number;
}

export interface RMSDMatrix {
  matrix: (number | null)[][];
  max: number;
  labels: string[];
}

export const INTERACTION_COLORS: Record<InteractionType, string> = {
  hydrogen_bond: '#FFD700',
  hydrophobic: '#32CD32',
  pi_pi: '#9932CC',
  salt_bridge: '#FF8C00',
  halogen_bond: '#00CED1',
};

export const ELEMENT_COLORS: Record<Element, string> = {
  C: '#808080',
  N: '#3333FF',
  O: '#FF3333',
  S: '#FFFF33',
  P: '#FFA500',
  F: '#00FF00',
  Cl: '#00FF00',
  Br: '#8B4513',
  I: '#9400D3',
  H: '#FFFFFF',
  Other: '#9400D3',
};

export const SECONDARY_STRUCTURE_COLORS: Record<SecondaryStructure, string> = {
  helix: '#FF6B6B',
  sheet: '#4ECDC4',
  loop: '#95E1D3',
};

export const VDW_RADII: Record<Element, number> = {
  C: 1.70,
  N: 1.55,
  O: 1.52,
  S: 1.80,
  P: 1.80,
  F: 1.47,
  Cl: 1.75,
  Br: 1.85,
  I: 1.98,
  H: 1.20,
  Other: 1.80,
};

export const KYTE_DOOLITTLE: Record<string, number> = {
  ALA: 1.8, ARG: -4.5, ASN: -3.5, ASP: -3.5, CYS: 2.5,
  GLN: -3.5, GLU: -3.5, GLY: -0.4, HIS: -3.2, ILE: 4.5,
  LEU: 3.8, LYS: -3.9, MET: 1.9, PHE: 2.8, PRO: -1.6,
  SER: -0.8, THR: -0.7, TRP: -0.9, TYR: -1.3, VAL: 4.2,
};

export type PharmacophoreFeatureType = 
  | 'hydrogen_bond_donor' 
  | 'hydrogen_bond_acceptor' 
  | 'positive_charge' 
  | 'negative_charge' 
  | 'hydrophobic' 
  | 'aromatic_ring';

export interface PharmacophoreFeature {
  id: string;
  type: PharmacophoreFeatureType;
  x: number;
  y: number;
  z: number;
  radius: number;
  isRequired: boolean;
  normal?: { x: number; y: number; z: number };
}

export interface ExcludedVolume {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface PharmacophoreModel {
  id: string;
  name: string;
  features: PharmacophoreFeature[];
  excludedVolumes: ExcludedVolume[];
  createdAt: number;
  minOptionalMatch: number;
  maxOptionalMatch: number;
}

export interface CandidateMolecule {
  id: string;
  name: string;
  smiles?: string;
  conformations: LigandConformation[];
  sourceData?: string;
}

export interface FeatureMatch {
  modelFeatureId: string;
  candidateFeatureId: string;
  distance: number;
}

export interface ScoringResult {
  moleculeId: string;
  moleculeName: string;
  smiles?: string;
  finalScore: number;
  baseScore: number;
  excludedVolumePenalty: number;
  matchedRequiredCount: number;
  matchedOptionalCount: number;
  totalRequiredCount: number;
  totalOptionalCount: number;
  unmatchedRequiredCount: number;
  intrudingAtomCount: number;
  matchedFeatures: FeatureMatch[];
  bestConformationIndex: number;
  candidateFeatures: PharmacophoreFeature[];
}

export interface PharmacophoreState {
  model: PharmacophoreModel | null;
  candidateMolecules: CandidateMolecule[];
  scoringResults: ScoringResult[];
  selectedResult: ScoringResult | null;
  isScoring: boolean;
  scoringProgress: number;
  scoringTotal: number;
  scoringMessage: string;
  showFeatures: boolean;
  showExcludedVolumes: boolean;
  showCandidateMolecule: boolean;
  manualAddMode: 'none' | 'feature' | 'excluded';
  addingFeatureType: PharmacophoreFeatureType | null;
}

export const PHARMACOPHORE_COLORS: Record<PharmacophoreFeatureType, string> = {
  hydrogen_bond_donor: '#3333FF',
  hydrogen_bond_acceptor: '#FF3333',
  positive_charge: '#9932CC',
  negative_charge: '#FF8C00',
  hydrophobic: '#32CD32',
  aromatic_ring: '#FFD700',
};

export const PHARMACOPHORE_ICONS: Record<PharmacophoreFeatureType, string> = {
  hydrogen_bond_donor: '💧',
  hydrogen_bond_acceptor: '🔴',
  positive_charge: '➕',
  negative_charge: '➖',
  hydrophobic: '💚',
  aromatic_ring: '🔶',
};

export const PHARMACOPHORE_LABELS: Record<PharmacophoreFeatureType, string> = {
  hydrogen_bond_donor: '氢键供体',
  hydrogen_bond_acceptor: '氢键受体',
  positive_charge: '正电荷中心',
  negative_charge: '负电荷中心',
  hydrophobic: '疏水中心',
  aromatic_ring: '芳香环中心',
};

export const DEFAULT_FEATURE_RADII: Record<PharmacophoreFeatureType, number> = {
  hydrogen_bond_donor: 1.5,
  hydrogen_bond_acceptor: 1.5,
  positive_charge: 2.0,
  negative_charge: 2.0,
  hydrophobic: 1.8,
  aromatic_ring: 1.2,
};

export interface WorkerMessage {
  type: 'start' | 'progress' | 'complete' | 'error' | 'cancel';
  payload?: unknown;
}

export interface ScoringWorkerData {
  model: PharmacophoreModel;
  candidates: CandidateMolecule[];
}

export interface ScoringProgressData {
  processed: number;
  total: number;
  currentName: string;
  elapsedMs: number;
}

export interface ScoringCompleteData {
  results: ScoringResult[];
  totalMs: number;
}
