import type { LigandConformation, RMSDMatrix, Atom } from '../types';

function getHeavyAtoms(conformation: LigandConformation): Atom[] {
  return conformation.atoms.filter(a => !a.isHydrogen);
}

function centroid(atoms: Atom[]): { x: number; y: number; z: number } {
  if (atoms.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = atoms.reduce((acc, a) => ({
    x: acc.x + a.x,
    y: acc.y + a.y,
    z: acc.z + a.z
  }), { x: 0, y: 0, z: 0 });
  return {
    x: sum.x / atoms.length,
    y: sum.y / atoms.length,
    z: sum.z / atoms.length
  };
}

export function calculateRMSD(
  conf1: LigandConformation,
  conf2: LigandConformation
): number | null {
  const atoms1 = getHeavyAtoms(conf1);
  const atoms2 = getHeavyAtoms(conf2);

  if (atoms1.length === 0 || atoms1.length !== atoms2.length) {
    return null;
  }

  const c1 = centroid(atoms1);
  const c2 = centroid(atoms2);

  let sumSq = 0;
  for (let i = 0; i < atoms1.length; i++) {
    const a1 = atoms1[i];
    const a2 = atoms2[i];
    const dx = (a1.x - c1.x) - (a2.x - c2.x);
    const dy = (a1.y - c1.y) - (a2.y - c2.y);
    const dz = (a1.z - c1.z) - (a2.z - c2.z);
    sumSq += dx * dx + dy * dy + dz * dz;
  }

  return Math.sqrt(sumSq / atoms1.length);
}

export function generateRMSDMatrix(
  conformations: LigandConformation[]
): RMSDMatrix {
  const n = conformations.length;
  const matrix: (number | null)[][] = [];
  const labels: string[] = conformations.map((_, i) => `Pose ${i + 1}`);
  let max = 0;

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i];
      } else {
        const rmsd = calculateRMSD(conformations[i], conformations[j]);
        matrix[i][j] = rmsd;
        if (rmsd !== null && rmsd > max) max = rmsd;
      }
    }
  }

  return { matrix, max, labels };
}

export function getRMSDColor(value: number | null, max: number): string {
  if (value === null) return '#CCCCCC';
  const ratio = Math.min(1, value / max);
  const r = Math.floor(255 * ratio);
  const g = Math.floor(255 * (1 - ratio));
  const b = 100;
  return `rgb(${r}, ${g}, ${b})`;
}

export function getRMSDHeatmapColor(value: number | null, max: number): string {
  return getRMSDColor(value, max);
}

export function getMatrixMax(matrix: RMSDMatrix): number {
  let max = 0;
  for (const row of matrix.matrix) {
    for (const v of row) {
      if (typeof v === 'number' && v > max) max = v;
    }
  }
  return max;
}
