import type { Atom, Measurement } from '../types';

function distance(a: Atom, b: Atom): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function angle(a: Atom, b: Atom, c: Atom): number {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = a.z - b.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  return Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
}

function dihedral(a: Atom, b: Atom, c: Atom, d: Atom): number {
  const v1x = b.x - a.x, v1y = b.y - a.y, v1z = b.z - a.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const v3x = d.x - c.x, v3y = d.y - c.y, v3z = d.z - c.z;

  const n1x = v1y * v2z - v1z * v2y;
  const n1y = v1z * v2x - v1x * v2z;
  const n1z = v1x * v2y - v1y * v2x;

  const n2x = v2y * v3z - v2z * v3y;
  const n2y = v2z * v3x - v2x * v3z;
  const n2z = v2x * v3y - v2y * v3x;

  const len1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z) || 1;
  const len2 = Math.sqrt(n2x * n2x + n2y * n2y + n2z * n2z) || 1;

  const nx1 = n1x / len1, ny1 = n1y / len1, nz1 = n1z / len1;
  const nx2 = n2x / len2, ny2 = n2y / len2, nz2 = n2z / len2;

  const dot = nx1 * nx2 + ny1 * ny2 + nz1 * nz2;

  const mx = v2x / (Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z) || 1);
  const my = v2y / (Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z) || 1);
  const mz = v2z / (Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z) || 1);

  const cx = ny1 * nz2 - nz1 * ny2;
  const cy = nz1 * nx2 - nx1 * nz2;
  const cz = nx1 * ny2 - ny1 * nx2;

  const sin = cx * mx + cy * my + cz * mz;

  return Math.atan2(sin, dot) * 180 / Math.PI;
}

export function createDistanceMeasurement(atoms: [Atom, Atom]): Measurement {
  const value = distance(atoms[0], atoms[1]);
  const position = {
    x: (atoms[0].x + atoms[1].x) / 2,
    y: (atoms[0].y + atoms[1].y) / 2,
    z: (atoms[0].z + atoms[1].z) / 2,
  };
  return {
    id: `dist_${Date.now()}_${Math.random()}`,
    type: 'distance',
    atoms: [...atoms],
    value,
    position,
  };
}

export function createAngleMeasurement(atoms: [Atom, Atom, Atom]): Measurement {
  const value = angle(atoms[0], atoms[1], atoms[2]);
  const position = {
    x: atoms[1].x,
    y: atoms[1].y,
    z: atoms[1].z,
  };
  return {
    id: `angle_${Date.now()}_${Math.random()}`,
    type: 'angle',
    atoms: [...atoms],
    value,
    position,
  };
}

export function createDihedralMeasurement(atoms: [Atom, Atom, Atom, Atom]): Measurement {
  const value = dihedral(atoms[0], atoms[1], atoms[2], atoms[3]);
  const position = {
    x: (atoms[1].x + atoms[2].x) / 2,
    y: (atoms[1].y + atoms[2].y) / 2,
    z: (atoms[1].z + atoms[2].z) / 2,
  };
  return {
    id: `dihedral_${Date.now()}_${Math.random()}`,
    type: 'dihedral',
    atoms: [...atoms],
    value,
    position,
  };
}

export function formatMeasurement(measurement: Measurement): string {
  if (measurement.type === 'distance') {
    return `${measurement.value.toFixed(2)} Å`;
  } else if (measurement.type === 'angle') {
    return `${measurement.value.toFixed(1)}°`;
  } else {
    return `${measurement.value.toFixed(1)}°`;
  }
}
