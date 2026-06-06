import type { Atom, Interaction, Residue, LigandConformation, Protein } from '../types';

const HBOND_DONORS = ['N', 'O', 'F'];
const HBOND_ACCEPTORS = ['N', 'O', 'F'];
const AROMATIC_RESIDUES = ['PHE', 'TYR', 'TRP', 'HIS'];
const POSITIVE_RESIDUES = ['LYS', 'ARG', 'HIS'];
const NEGATIVE_RESIDUES = ['ASP', 'GLU'];
const HALOGENS = ['F', 'Cl', 'Br', 'I'];
const NONPOLAR_RESIDUES = ['ALA', 'VAL', 'LEU', 'ILE', 'PHE', 'MET', 'TRP', 'PRO'];

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

function getResidueCenter(residue: Residue): { x: number; y: number; z: number } {
  const heavyAtoms = residue.atoms.filter(a => !a.isHydrogen);
  if (heavyAtoms.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = heavyAtoms.reduce((acc, a) => ({ x: acc.x + a.x, y: acc.y + a.y, z: acc.z + a.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / heavyAtoms.length, y: sum.y / heavyAtoms.length, z: sum.z / heavyAtoms.length };
}

function getRingAtoms(residue: Residue, atoms: Atom[]): Atom[] {
  if (residue.name === 'PHE' || residue.name === 'TYR') {
    const ringNames = ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'];
    return atoms.filter(a => a.residueId === residue.seqNum && a.chainId === residue.chainId && ringNames.includes(a.atomName));
  }
  if (residue.name === 'TRP') {
    const indoleNames = ['CG', 'CD1', 'CD2', 'NE1', 'CE2', 'CE3', 'CZ2', 'CZ3', 'CH2'];
    return atoms.filter(a => a.residueId === residue.seqNum && a.chainId === residue.chainId && indoleNames.includes(a.atomName));
  }
  if (residue.name === 'HIS') {
    const imidazoleNames = ['CG', 'ND1', 'CD2', 'CE1', 'NE2'];
    return atoms.filter(a => a.residueId === residue.seqNum && a.chainId === residue.chainId && imidazoleNames.includes(a.atomName));
  }
  return [];
}

function getRingNormal(atoms: Atom[]): { x: number; y: number; z: number } {
  if (atoms.length < 3) return { x: 0, y: 1, z: 0 };
  const center = atoms.reduce((acc, a) => ({ x: acc.x + a.x, y: acc.y + a.y, z: acc.z + a.z }), { x: 0, y: 0, z: 0 });
  const cx = center.x / atoms.length, cy = center.y / atoms.length, cz = center.z / atoms.length;

  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i], b = atoms[(i + 1) % atoms.length];
    const v1x = a.x - cx, v1y = a.y - cy, v1z = a.z - cz;
    const v2x = b.x - cx, v2y = b.y - cy, v2z = b.z - cz;
    nx += v1y * v2z - v1z * v2y;
    ny += v1z * v2x - v1x * v2z;
    nz += v1x * v2y - v1y * v2x;
  }

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return len > 0 ? { x: nx / len, y: ny / len, z: nz / len } : { x: 0, y: 1, z: 0 };
}

function detectHBonds(ligandAtoms: Atom[], proteinAtoms: Atom[], residues: Residue[]): Interaction[] {
  const interactions: Interaction[] = [];
  const residueMap = new Map<string, Residue>();
  residues.forEach(r => residueMap.set(`${r.chainId}_${r.seqNum}`, r));

  for (const ligAtom of ligandAtoms) {
    if (ligAtom.isHydrogen) continue;

    for (const protAtom of proteinAtoms) {
      if (protAtom.isHydrogen) continue;

      const dist = distance(ligAtom, protAtom);
      if (dist > 3.5) continue;

      let isDonorAcceptor = false;
      let donor: Atom = ligAtom;
      let acceptor: Atom = protAtom;

      if (HBOND_DONORS.includes(ligAtom.element) && HBOND_ACCEPTORS.includes(protAtom.element)) {
        isDonorAcceptor = true;
        donor = ligAtom;
        acceptor = protAtom;
      } else if (HBOND_DONORS.includes(protAtom.element) && HBOND_ACCEPTORS.includes(ligAtom.element)) {
        isDonorAcceptor = true;
        donor = protAtom;
        acceptor = ligAtom;
      }

      if (!isDonorAcceptor) continue;

      let hasAngle = false;
      let bondAngle = 0;

      for (const a of ligandAtoms.concat(proteinAtoms)) {
        if (a.id === donor.id || a.id === acceptor.id || a.isHydrogen) continue;
        if (distance(a, donor) > 2.0) continue;
        const ang = angle(a, donor, acceptor);
        if (ang > 120) {
          hasAngle = true;
          bondAngle = ang;
          break;
        }
      }

      if (hasAngle || ligAtom.isHydrogen || protAtom.isHydrogen) {
        const donorRes = residueMap.get(`${donor.chainId}_${donor.residueId}`);
        const acceptorRes = residueMap.get(`${acceptor.chainId}_${acceptor.residueId}`);
        interactions.push({
          type: 'hydrogen_bond',
          donorAtom: donor,
          acceptorAtom: acceptor,
          donorResidue: donorRes,
          acceptorResidue: acceptorRes,
          distance: dist,
          angle: bondAngle,
        });
      }
    }
  }

  return interactions;
}

function detectHydrophobicInteractions(ligandAtoms: Atom[], residues: Residue[]): Interaction[] {
  const interactions: Interaction[] = [];
  const ligCarbons = ligandAtoms.filter(a => a.element === 'C' && !a.isHydrogen);

  for (const residue of residues) {
    if (!NONPOLAR_RESIDUES.includes(residue.name)) continue;
    if (residue.isMissing) continue;
    const protCarbons = residue.atoms.filter(a => a.element === 'C' && !a.isHydrogen);

    for (const lc of ligCarbons) {
      for (const pc of protCarbons) {
        const dist = distance(lc, pc);
        if (dist < 4.0) {
          interactions.push({
            type: 'hydrophobic',
            donorAtom: lc,
            acceptorAtom: pc,
            donorResidue: {
              id: 0, name: 'LIG', chainId: 'LIG', seqNum: 1, atoms: ligandAtoms,
              secondaryStructure: 'loop', isMissing: false
            },
            acceptorResidue: residue,
            distance: dist,
          });
          break;
        }
      }
    }
  }

  return interactions;
}

function detectPiPiStacking(ligandAtoms: Atom[], residues: Residue[], proteinAtoms: Atom[]): Interaction[] {
  const interactions: Interaction[] = [];

  const ligAromaticAtoms = ligandAtoms.filter(a => a.isAromatic);
  if (ligAromaticAtoms.length < 6) return interactions;

  const ligCenter = ligAromaticAtoms.reduce((acc, a) => ({ x: acc.x + a.x, y: acc.y + a.y, z: acc.z + a.z }), { x: 0, y: 0, z: 0 });
  ligCenter.x /= ligAromaticAtoms.length;
  ligCenter.y /= ligAromaticAtoms.length;
  ligCenter.z /= ligAromaticAtoms.length;

  const ligNormal = getRingNormal(ligAromaticAtoms);

  for (const residue of residues) {
    if (!AROMATIC_RESIDUES.includes(residue.name) || residue.isMissing) continue;
    const ringAtoms = getRingAtoms(residue, proteinAtoms);
    if (ringAtoms.length < 5) continue;

    const protCenter = getResidueCenter(residue);
    const protNormal = getRingNormal(ringAtoms);

    const dist = Math.sqrt(
      Math.pow(ligCenter.x - protCenter.x, 2) +
      Math.pow(ligCenter.y - protCenter.y, 2) +
      Math.pow(ligCenter.z - protCenter.z, 2)
    );

    if (dist > 5.5) continue;

    const dot = Math.abs(ligNormal.x * protNormal.x + ligNormal.y * protNormal.y + ligNormal.z * protNormal.z);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;

    if (angle < 30 || angle > 60) {
      const avgAtom = ringAtoms[0];
      interactions.push({
        type: 'pi_pi',
        donorAtom: ligAromaticAtoms[0],
        acceptorAtom: avgAtom,
        donorResidue: {
          id: 0, name: 'LIG', chainId: 'LIG', seqNum: 1, atoms: ligandAtoms,
          secondaryStructure: 'loop', isMissing: false
        },
        acceptorResidue: residue,
        distance: dist,
        angle,
      });
    }
  }

  return interactions;
}

function detectSaltBridges(ligandAtoms: Atom[], residues: Residue[]): Interaction[] {
  const interactions: Interaction[] = [];

  const ligCharged = ligandAtoms.filter(a =>
    (a.formalCharge && a.formalCharge !== 0) ||
    (a.charge && Math.abs(a.charge) > 0.3)
  );

  for (const residue of residues) {
    if (residue.isMissing) continue;
    const isPositive = POSITIVE_RESIDUES.includes(residue.name);
    const isNegative = NEGATIVE_RESIDUES.includes(residue.name);
    if (!isPositive && !isNegative) continue;

    for (const ligAtom of ligCharged) {
      for (const protAtom of residue.atoms) {
        if (protAtom.isHydrogen) continue;

        const ligCharge = ligAtom.charge || ligAtom.formalCharge || 0;
        const hasOppositeCharge =
          (isPositive && ligCharge < 0) ||
          (isNegative && ligCharge > 0);

        if (!hasOppositeCharge) continue;

        const dist = distance(ligAtom, protAtom);
        if (dist < 4.0) {
          interactions.push({
            type: 'salt_bridge',
            donorAtom: ligAtom,
            acceptorAtom: protAtom,
            donorResidue: {
              id: 0, name: 'LIG', chainId: 'LIG', seqNum: 1, atoms: ligandAtoms,
              secondaryStructure: 'loop', isMissing: false
            },
            acceptorResidue: residue,
            distance: dist,
          });
          break;
        }
      }
    }
  }

  return interactions;
}

function detectHalogenBonds(ligandAtoms: Atom[], proteinAtoms: Atom[], residues: Residue[]): Interaction[] {
  const interactions: Interaction[] = [];
  const residueMap = new Map<string, Residue>();
  residues.forEach(r => residueMap.set(`${r.chainId}_${r.seqNum}`, r));

  const ligHalogens = ligandAtoms.filter(a => HALOGENS.includes(a.element));

  for (const halogen of ligHalogens) {
    for (const protAtom of proteinAtoms) {
      if (protAtom.isHydrogen) continue;
      if (!HBOND_ACCEPTORS.includes(protAtom.element)) continue;

      const dist = distance(halogen, protAtom);
      if (dist > 3.5) continue;

      let hasAngle = false;
      for (const a of ligandAtoms) {
        if (a.id === halogen.id || a.isHydrogen) continue;
        if (distance(a, halogen) > 2.0) continue;
        const ang = angle(a, halogen, protAtom);
        if (ang > 140) {
          hasAngle = true;
          break;
        }
      }

      if (hasAngle) {
        const donorRes = residueMap.get(`${halogen.chainId}_${halogen.residueId}`);
        const acceptorRes = residueMap.get(`${protAtom.chainId}_${protAtom.residueId}`);
        interactions.push({
          type: 'halogen_bond',
          donorAtom: halogen,
          acceptorAtom: protAtom,
          donorResidue: donorRes,
          acceptorResidue: acceptorRes,
          distance: dist,
        });
      }
    }
  }

  return interactions;
}

export function getBindingPocketResidues(
  conformation: LigandConformation,
  protein: Protein,
  cutoff: number = 5.0
): Residue[] {
  const pocketResidues = new Map<string, Residue>();
  const ligandAtoms = conformation.atoms;

  for (const chain of protein.chains.values()) {
    for (const residue of chain.residues) {
      if (residue.atoms.length === 0) continue;

      for (const protAtom of residue.atoms) {
        for (const ligAtom of ligandAtoms) {
          const dist = distance(protAtom, ligAtom);
          if (dist < cutoff) {
            pocketResidues.set(`${residue.chainId}_${residue.seqNum}`, residue);
            break;
          }
        }
        if (pocketResidues.has(`${residue.chainId}_${residue.seqNum}`)) break;
      }
    }
  }

  return Array.from(pocketResidues.values());
}

export function hasMissingPocketResidues(pocketResidues: Residue[]): boolean {
  return pocketResidues.some(r => r.isMissing);
}

export async function detectInteractions(
  conformation: LigandConformation,
  protein: Protein,
  pocketCutoff: number = 8.0
): Promise<{ interactions: Interaction[]; pocketResidues: Residue[]; hasMissing: boolean }> {
  const pocketResidues = getBindingPocketResidues(conformation, protein, pocketCutoff);
  const hasMissing = hasMissingPocketResidues(pocketResidues);

  const ligandAtoms = conformation.atoms;
  const proteinAtoms: Atom[] = [];
  for (const res of pocketResidues) {
    if (!res.isMissing) {
      proteinAtoms.push(...res.atoms);
    }
  }

  const allResidues: Residue[] = [];
  for (const chain of protein.chains.values()) {
    allResidues.push(...chain.residues);
  }

  const isLarge = ligandAtoms.length > 200;

  if (isLarge) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const hbonds = detectHBonds(ligandAtoms, proteinAtoms, allResidues);
  const hydrophobic = detectHydrophobicInteractions(ligandAtoms, pocketResidues);
  const piPi = detectPiPiStacking(ligandAtoms, pocketResidues, proteinAtoms);
  const saltBridges = detectSaltBridges(ligandAtoms, pocketResidues);
  const halogenBonds = detectHalogenBonds(ligandAtoms, proteinAtoms, allResidues);

  return {
    interactions: [...hbonds, ...hydrophobic, ...piPi, ...saltBridges, ...halogenBonds],
    pocketResidues,
    hasMissing,
  };
}
