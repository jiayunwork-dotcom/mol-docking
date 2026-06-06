import type { Atom, Bond, LigandConformation, Protein, PharmacophoreFeature, ExcludedVolume } from '../types';
import type { PharmacophoreFeatureType } from '../types';
import { DEFAULT_FEATURE_RADII } from '../types';

function generateFeatureId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateVolumeId(): string {
  return `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function distance3D(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getBondedAtoms(atomId: number, atoms: Atom[], bonds: Bond[]): Atom[] {
  const bonded: Atom[] = [];
  const atomMap = new Map(atoms.map(a => [a.id, a]));
  
  for (const bond of bonds) {
    if (bond.atom1 === atomId) {
      const other = atomMap.get(bond.atom2);
      if (other) bonded.push(other);
    } else if (bond.atom2 === atomId) {
      const other = atomMap.get(bond.atom1);
      if (other) bonded.push(other);
    }
  }
  
  return bonded;
}

function hasBondedHydrogen(atom: Atom, atoms: Atom[], bonds: Bond[]): boolean {
  const bonded = getBondedAtoms(atom.id, atoms, bonds);
  return bonded.some(a => a.element === 'H');
}

function findRings(atoms: Atom[], bonds: Bond[]): Atom[][] {
  const atomMap = new Map(atoms.map(a => [a.id, a]));
  const adjacency = new Map<number, number[]>();
  
  atoms.forEach(a => adjacency.set(a.id, []));
  bonds.forEach(b => {
    adjacency.get(b.atom1)?.push(b.atom2);
    adjacency.get(b.atom2)?.push(b.atom1);
  });

  const rings: Atom[][] = [];
  const visited = new Set<string>();

  function dfs(start: number, current: number, path: number[], depth: number): void {
    if (depth > 8) return;
    
    for (const neighbor of adjacency.get(current) || []) {
      if (neighbor === start && depth >= 3) {
        const ringPath = [...path];
        const ringKey = ringPath.sort((a, b) => a - b).join('-');
        if (!visited.has(ringKey)) {
          visited.add(ringKey);
          const ringAtoms = ringPath.map(id => atomMap.get(id)!).filter(Boolean);
          if (ringAtoms.length >= 5 && ringAtoms.length <= 7) {
            rings.push(ringAtoms);
          }
        }
        continue;
      }
      if (!path.includes(neighbor)) {
        dfs(start, neighbor, [...path, neighbor], depth + 1);
      }
    }
  }

  atoms.forEach(atom => {
    if (atom.element === 'C' || atom.element === 'N') {
      dfs(atom.id, atom.id, [atom.id], 0);
    }
  });

  const uniqueRings: Atom[][] = [];
  const seen = new Set<string>();
  
  for (const ring of rings) {
    const key = ring.map(a => a.id).sort((a, b) => a - b).join('-');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRings.push(ring);
    }
  }

  return uniqueRings;
}

function isAromaticRing(ring: Atom[], bonds: Bond[]): boolean {
  const ringIds = new Set(ring.map(a => a.id));
  const aromaticCount = ring.filter(a => a.isAromatic).length;
  
  if (aromaticCount >= ring.length * 0.6) return true;
  
  const aromaticBondCount = bonds.filter(b => 
    b.order === 4 && ringIds.has(b.atom1) && ringIds.has(b.atom2)
  ).length;
  
  return aromaticBondCount >= Math.floor(ring.length / 2);
}

function calculateRingNormal(ring: Atom[]): { x: number; y: number; z: number } {
  const cx = ring.reduce((s, a) => s + a.x, 0) / ring.length;
  const cy = ring.reduce((s, a) => s + a.y, 0) / ring.length;
  const cz = ring.reduce((s, a) => s + a.z, 0) / ring.length;

  let nx = 0, ny = 0, nz = 0;
  const n = ring.length;
  
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    
    const v1x = a.x - cx, v1y = a.y - cy, v1z = a.z - cz;
    const v2x = b.x - cx, v2y = b.y - cy, v2z = b.z - cz;
    
    nx += v1y * v2z - v1z * v2y;
    ny += v1z * v2x - v1x * v2z;
    nz += v1x * v2y - v1y * v2x;
  }

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-6) return { x: 0, y: 1, z: 0 };
  
  return { x: nx / len, y: ny / len, z: nz / len };
}

function findConnectedCarbonClusters(atoms: Atom[], bonds: Bond[]): Atom[][] {
  const carbonAtoms = atoms.filter(a => a.element === 'C' && !a.isHydrogen);
  if (carbonAtoms.length < 3) return [];

  const atomMap = new Map(carbonAtoms.map(a => [a.id, a]));
  const adjacency = new Map<number, number[]>();
  
  carbonAtoms.forEach(a => adjacency.set(a.id, []));
  bonds.forEach(b => {
    if (atomMap.has(b.atom1) && atomMap.has(b.atom2)) {
      adjacency.get(b.atom1)?.push(b.atom2);
      adjacency.get(b.atom2)?.push(b.atom1);
    }
  });

  const visited = new Set<number>();
  const clusters: Atom[][] = [];

  function dfs(atomId: number, cluster: Atom[]): void {
    if (visited.has(atomId)) return;
    visited.add(atomId);
    const atom = atomMap.get(atomId);
    if (atom) cluster.push(atom);
    
    for (const neighbor of adjacency.get(atomId) || []) {
      dfs(neighbor, cluster);
    }
  }

  for (const atom of carbonAtoms) {
    if (!visited.has(atom.id)) {
      const cluster: Atom[] = [];
      dfs(atom.id, cluster);
      if (cluster.length >= 3) {
        clusters.push(cluster);
      }
    }
  }

  return clusters;
}

function isQuaternaryNitrogen(atom: Atom, atoms: Atom[], bonds: Bond[]): boolean {
  if (atom.element !== 'N') return false;
  
  const bonded = getBondedAtoms(atom.id, atoms, bonds);
  const heavyBonded = bonded.filter(a => !a.isHydrogen);
  
  if (heavyBonded.length === 4) return true;
  
  if (atom.formalCharge !== undefined && atom.formalCharge > 0) return true;
  
  if (atom.charge !== undefined && atom.charge > 0.2) return true;
  
  return false;
}

function isGuanidiniumGroup(atom: Atom, atoms: Atom[], bonds: Bond[]): boolean {
  if (atom.element !== 'N') return false;
  
  const bonded = getBondedAtoms(atom.id, atoms, bonds);
  for (const neighbor of bonded) {
    if (neighbor.element === 'C') {
      const neighborBonded = getBondedAtoms(neighbor.id, atoms, bonds);
      const nitrogenCount = neighborBonded.filter(a => a.element === 'N').length;
      if (nitrogenCount >= 3) return true;
    }
  }
  
  return false;
}

function isDeprotonatedCarboxyl(atom: Atom, atoms: Atom[], bonds: Bond[]): boolean {
  if (atom.element !== 'O') return false;
  
  const bonded = getBondedAtoms(atom.id, atoms, bonds);
  for (const neighbor of bonded) {
    if (neighbor.element === 'C') {
      const neighborBonded = getBondedAtoms(neighbor.id, atoms, bonds);
      const oxygenCount = neighborBonded.filter(a => a.element === 'O').length;
      const hasDoubleBond = bonds.some(b => 
        (b.atom1 === neighbor.id || b.atom2 === neighbor.id) && 
        b.order === 2
      );
      if (oxygenCount >= 2 && hasDoubleBond) {
        if (atom.formalCharge !== undefined && atom.formalCharge < 0) return true;
        if (atom.charge !== undefined && atom.charge < -0.2) return true;
      }
    }
  }
  
  return false;
}

function isPhosphateGroup(atom: Atom, atoms: Atom[], bonds: Bond[]): boolean {
  if (atom.element !== 'O') return false;
  
  const bonded = getBondedAtoms(atom.id, atoms, bonds);
  for (const neighbor of bonded) {
    if (neighbor.element === 'P') {
      const neighborBonded = getBondedAtoms(neighbor.id, atoms, bonds);
      const oxygenCount = neighborBonded.filter(a => a.element === 'O').length;
      if (oxygenCount >= 3) {
        if (atom.formalCharge !== undefined && atom.formalCharge < 0) return true;
        if (atom.charge !== undefined && atom.charge < -0.2) return true;
      }
    }
  }
  
  return false;
}

export function extractPharmacophoreFeatures(
  conformation: LigandConformation
): PharmacophoreFeature[] {
  const { atoms, bonds } = conformation;
  const features: PharmacophoreFeature[] = [];
  const processedAtoms = new Set<number>();

  for (const atom of atoms) {
    if (atom.isHydrogen) continue;
    if (processedAtoms.has(atom.id)) continue;

    if ((atom.element === 'N' || atom.element === 'O') && hasBondedHydrogen(atom, atoms, bonds)) {
      features.push({
        id: generateFeatureId(),
        type: 'hydrogen_bond_donor',
        x: atom.x,
        y: atom.y,
        z: atom.z,
        radius: DEFAULT_FEATURE_RADII.hydrogen_bond_donor,
        isRequired: true,
      });
      processedAtoms.add(atom.id);
      continue;
    }

    if ((atom.element === 'N' || atom.element === 'O') && !hasBondedHydrogen(atom, atoms, bonds)) {
      features.push({
        id: generateFeatureId(),
        type: 'hydrogen_bond_acceptor',
        x: atom.x,
        y: atom.y,
        z: atom.z,
        radius: DEFAULT_FEATURE_RADII.hydrogen_bond_acceptor,
        isRequired: true,
      });
      processedAtoms.add(atom.id);
      continue;
    }

    if (atom.element === 'N' && (isQuaternaryNitrogen(atom, atoms, bonds) || isGuanidiniumGroup(atom, atoms, bonds))) {
      features.push({
        id: generateFeatureId(),
        type: 'positive_charge',
        x: atom.x,
        y: atom.y,
        z: atom.z,
        radius: DEFAULT_FEATURE_RADII.positive_charge,
        isRequired: true,
      });
      processedAtoms.add(atom.id);
      continue;
    }

    if (atom.element === 'O' && (isDeprotonatedCarboxyl(atom, atoms, bonds) || isPhosphateGroup(atom, atoms, bonds))) {
      features.push({
        id: generateFeatureId(),
        type: 'negative_charge',
        x: atom.x,
        y: atom.y,
        z: atom.z,
        radius: DEFAULT_FEATURE_RADII.negative_charge,
        isRequired: true,
      });
      processedAtoms.add(atom.id);
      continue;
    }
  }

  const carbonClusters = findConnectedCarbonClusters(atoms, bonds);
  for (const cluster of carbonClusters) {
    const center = {
      x: cluster.reduce((s, a) => s + a.x, 0) / cluster.length,
      y: cluster.reduce((s, a) => s + a.y, 0) / cluster.length,
      z: cluster.reduce((s, a) => s + a.z, 0) / cluster.length,
    };
    
    features.push({
      id: generateFeatureId(),
      type: 'hydrophobic',
      x: center.x,
      y: center.y,
      z: center.z,
      radius: DEFAULT_FEATURE_RADII.hydrophobic,
      isRequired: true,
    });
    
    cluster.forEach(a => processedAtoms.add(a.id));
  }

  const rings = findRings(atoms, bonds);
  const processedRingAtoms = new Set<number>();
  
  for (const ring of rings) {
    if (!isAromaticRing(ring, bonds)) continue;
    
    const ringAtomIds = ring.map(a => a.id);
    if (ringAtomIds.some(id => processedRingAtoms.has(id))) continue;
    
    const center = {
      x: ring.reduce((s, a) => s + a.x, 0) / ring.length,
      y: ring.reduce((s, a) => s + a.y, 0) / ring.length,
      z: ring.reduce((s, a) => s + a.z, 0) / ring.length,
    };
    
    const normal = calculateRingNormal(ring);
    
    features.push({
      id: generateFeatureId(),
      type: 'aromatic_ring',
      x: center.x,
      y: center.y,
      z: center.z,
      radius: DEFAULT_FEATURE_RADII.aromatic_ring,
      isRequired: true,
      normal,
    });
    
    ringAtomIds.forEach(id => processedRingAtoms.add(id));
  }

  return features;
}

export function extractPharmacophoreFeaturesByType(
  conformation: LigandConformation,
  type: PharmacophoreFeatureType
): PharmacophoreFeature[] {
  const features = extractPharmacophoreFeatures(conformation);
  return features.filter(f => f.type === type);
}

export function generateExcludedVolumes(
  protein: Protein,
  ligandConformation: LigandConformation,
  minDistance: number = 3.0,
  maxDistance: number = 6.0,
  radius: number = 1.5
): ExcludedVolume[] {
  const volumes: ExcludedVolume[] = [];
  const ligandAtoms = ligandConformation.atoms.filter(a => !a.isHydrogen);
  const proteinHeavyAtoms = protein.atoms.filter(a => !a.isHydrogen);

  for (const protAtom of proteinHeavyAtoms) {
    let minDistToLigand = Infinity;
    
    for (const ligAtom of ligandAtoms) {
      const dist = distance3D(protAtom, ligAtom);
      if (dist < minDistToLigand) {
        minDistToLigand = dist;
      }
    }
    
    if (minDistToLigand >= minDistance && minDistToLigand <= maxDistance) {
      volumes.push({
        id: generateVolumeId(),
        x: protAtom.x,
        y: protAtom.y,
        z: protAtom.z,
        radius,
      });
    }
  }

  return volumes;
}

export function validateModelForScreening(features: PharmacophoreFeature[]): { valid: boolean; message?: string } {
  if (features.length < 2) {
    return {
      valid: false,
      message: '特征点过少无法有效筛选，至少需要2个特征点',
    };
  }
  return { valid: true };
}
