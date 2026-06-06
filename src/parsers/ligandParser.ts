import type { Atom, Ligand, LigandConformation, Bond, Element } from '../types';
import { VDW_RADII } from '../types';

function parseElement(symbol: string): Element {
  const clean = symbol.trim().toUpperCase();
  if (['C', 'N', 'O', 'S', 'P', 'F', 'CL', 'BR', 'I', 'H'].includes(clean)) {
    if (clean === 'CL') return 'Cl';
    if (clean === 'BR') return 'Br';
    return clean as Element;
  }
  return 'Other';
}

function detectAromaticity(atoms: Atom[], bonds: Bond[]): void {
  const atomBonds = new Map<number, Bond[]>();
  atoms.forEach(a => atomBonds.set(a.id, []));
  bonds.forEach(b => {
    atomBonds.get(b.atom1)?.push(b);
    atomBonds.get(b.atom2)?.push(b);
  });

  atoms.forEach(atom => {
    if (atom.element !== 'C' && atom.element !== 'N') return;
    const connected = atomBonds.get(atom.id) || [];
    const aromaticBonds = connected.filter(b => b.order === 4);
    atom.isAromatic = aromaticBonds.length >= 2;
  });
}

function computeGasteigerCharges(atoms: Atom[], bonds: Bond[]): void {
  const electronegativity: Record<string, number> = {
    H: 2.20, C: 2.55, N: 3.04, O: 3.44, S: 2.58, P: 2.19,
    F: 3.98, Cl: 3.16, Br: 2.96, I: 2.66,
  };

  const atomBonds = new Map<number, Bond[]>();
  atoms.forEach(a => atomBonds.set(a.id, []));
  bonds.forEach(b => {
    atomBonds.get(b.atom1)?.push(b);
    atomBonds.get(b.atom2)?.push(b);
  });

  const totalAtoms = atoms.length;
  const charge = new Float64Array(totalAtoms);

  for (let iter = 0; iter < 6; iter++) {
    const newCharge = new Float64Array(charge);

    for (let i = 0; i < totalAtoms; i++) {
      const atom = atoms[i];
      const connected = atomBonds.get(atom.id) || [];
      const en1 = electronegativity[atom.element] || 2.5;

      for (const bond of connected) {
        const j = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
        const other = atoms.find(a => a.id === j);
        if (!other) continue;
        const en2 = electronegativity[other.element] || 2.5;
        const enDiff = en2 - en1;
        const factor = bond.order === 1 ? 1.0 : bond.order === 2 ? 1.5 : bond.order === 3 ? 2.0 : 1.2;
        const delta = 0.5 * factor * Math.tanh(0.2 * enDiff) / totalAtoms;
        newCharge[i] += delta;
        newCharge[j] -= delta;
      }
    }

    for (let i = 0; i < totalAtoms; i++) {
      charge[i] = newCharge[i];
    }
  }

  for (let i = 0; i < totalAtoms; i++) {
    const atom = atoms[i];
    if (atom) {
      atom.charge = charge[i] || 0;
      if (atom.formalCharge !== undefined) {
        atom.charge = (atom.charge || 0) + atom.formalCharge;
      }
    }
  }
}

export async function parseSDF(content: string, filename: string, maxConformations: number = 20): Promise<{ ligand: Ligand; wasTruncated: boolean }> {
  const blocks = content.split(/\$\$\$\$/).filter(b => b.trim().length > 0);
  
  if (blocks.length === 0) {
    throw new Error('SDF文件为空，无法解析任何有效构象');
  }

  const totalBlocks = blocks.length;
  const wasTruncated = totalBlocks > maxConformations;
  const numConfs = Math.min(totalBlocks, maxConformations);

  const conformations: LigandConformation[] = [];
  let validConfsCount = 0;

  for (let confIdx = 0; confIdx < numConfs; confIdx++) {
    const block = blocks[confIdx];
    const lines = block.trim().split('\n');
    
    if (lines.length < 4) continue;

    const header = lines[0].trim();
    const countsLine = lines[3];
    
    if (countsLine.length < 6) continue;
    
    const atomCount = parseInt(countsLine.substring(0, 3).trim());
    const bondCount = parseInt(countsLine.substring(3, 6).trim());

    if (isNaN(atomCount) || atomCount <= 0) continue;

    const atoms: Atom[] = [];
    const bonds: Bond[] = [];
    let atomId = 0;
    let hasValidCoordinates = false;

    for (let i = 4; i < 4 + atomCount && i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.length < 34) continue;
      
      const x = parseFloat(line.substring(0, 10));
      const y = parseFloat(line.substring(10, 20));
      const z = parseFloat(line.substring(20, 30));
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
      if (x === 0 && y === 0 && z === 0) continue;
      
      hasValidCoordinates = true;
      const element = parseElement(line.substring(31, 34));
      const formalCharge = parseInt(line.substring(36, 39)) || 0;

      atoms.push({
        id: atomId,
        element,
        x, y, z,
        chainId: 'LIG',
        residueName: 'LIG',
        residueId: 1,
        atomName: `${element}${atomId}`,
        formalCharge,
        vdwRadius: VDW_RADII[element],
        isHydrogen: element === 'H',
      });
      atomId++;
    }

    if (!hasValidCoordinates || atoms.length === 0) continue;

    for (let i = 4 + atomCount; i < 4 + atomCount + bondCount && i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.length < 9) continue;
      const atom1 = parseInt(line.substring(0, 3).trim()) - 1;
      const atom2 = parseInt(line.substring(3, 6).trim()) - 1;
      const order = parseInt(line.substring(6, 9).trim()) as 1 | 2 | 3 | 4;

      if (!isNaN(atom1) && !isNaN(atom2) && !isNaN(order)) {
        bonds.push({ atom1, atom2, order });
      }
    }

    let bindingAffinity = 0;
    let rmsd: number | null = null;
    for (let i = 4 + atomCount + bondCount; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('> <SCORE>') || line.includes('> <docking_score>') || line.includes('> <binding_affinity>')) {
        const val = parseFloat(lines[i + 1]?.trim() || '0');
        if (!isNaN(val)) bindingAffinity = val;
      } else if (line.includes('> <RMSD>') || line.includes('> <rmsd>')) {
        const val = parseFloat(lines[i + 1]?.trim() || '');
        if (!isNaN(val)) rmsd = val;
      }
    }

    detectAromaticity(atoms, bonds);
    computeGasteigerCharges(atoms, bonds);

    conformations.push({
      id: validConfsCount,
      atoms,
      bonds,
      bindingEnergy: bindingAffinity,
      rmsd,
      name: `${header || 'Pose'} ${validConfsCount + 1}`,
    });
    validConfsCount++;
  }

  if (conformations.length === 0) {
    throw new Error('SDF文件格式错误，无法解析出有效原子坐标，请检查文件格式');
  }

  return {
    wasTruncated,
    ligand: {
      id: `lig_${Date.now()}`,
      name: filename.replace(/\.(sdf|sd)$/i, ''),
      conformations: conformations.sort((a, b) => a.bindingEnergy - b.bindingEnergy),
      currentConformation: 0,
      filename,
      format: 'sdf',
      visibleConformations: [0],
    },
  };
}

export async function parseMOL2(content: string, filename: string, maxConformations: number = 20): Promise<{ ligand: Ligand; wasTruncated: boolean }> {
  const blocks = content.split(/@<TRIPOS>MOLECULE/).filter(b => b.trim());
  
  if (blocks.length === 0) {
    throw new Error('MOL2文件为空，无法解析任何有效构象');
  }

  const totalBlocks = blocks.length;
  const wasTruncated = totalBlocks > maxConformations;
  const numConfs = Math.min(totalBlocks, maxConformations);

  const conformations: LigandConformation[] = [];
  let validConfsCount = 0;

  for (let confIdx = 0; confIdx < numConfs; confIdx++) {
    const block = blocks[confIdx];
    const lines = block.trim().split('\n');

    const name = lines[0]?.trim() || `Pose ${confIdx + 1}`;
    let i = 1;
    while (i < lines.length && !lines[i].includes('@<TRIPOS>')) i++;
    if (i >= lines.length) continue;

    const counts = lines[i - 1].trim().split(/\s+/);
    const atomCount = parseInt(counts[0] || '0');
    const bondCount = parseInt(counts[1] || '0');

    if (isNaN(atomCount) || atomCount <= 0) continue;

    const atoms: Atom[] = [];
    const bonds: Bond[] = [];

    i++;
    while (i < lines.length && !lines[i].includes('@<TRIPOS>ATOM')) i++;
    i++;

    let atomId = 0;
    let hasValidCoordinates = false;
    for (let j = 0; j < atomCount && i < lines.length; j++, i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 6) continue;
      const atomName = parts[1];
      const x = parseFloat(parts[2]);
      const y = parseFloat(parts[3]);
      const z = parseFloat(parts[4]);
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
      if (x === 0 && y === 0 && z === 0) continue;
      
      hasValidCoordinates = true;
      const typeParts = parts[5].split('.');
      const element = parseElement(typeParts[0]);
      const formalCharge = parts.length > 8 ? parseInt(parts[8]) || 0 : 0;

      atoms.push({
        id: atomId,
        element,
        x, y, z,
        chainId: 'LIG',
        residueName: 'LIG',
        residueId: 1,
        atomName,
        formalCharge,
        vdwRadius: VDW_RADII[element],
        isHydrogen: element === 'H',
      });
      atomId++;
    }

    if (!hasValidCoordinates || atoms.length === 0) continue;

    while (i < lines.length && !lines[i].includes('@<TRIPOS>BOND')) i++;
    i++;

    for (let j = 0; j < bondCount && i < lines.length; j++, i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 4) continue;
      const atom1 = parseInt(parts[1]) - 1;
      const atom2 = parseInt(parts[2]) - 1;
      const orderStr = parts[3];
      let order: 1 | 2 | 3 | 4 = 1;
      if (orderStr === '2') order = 2;
      else if (orderStr === '3') order = 3;
      else if (orderStr === 'ar' || orderStr === 'AR' || orderStr === 'Aromatic') order = 4;

      if (!isNaN(atom1) && !isNaN(atom2)) {
        bonds.push({ atom1, atom2, order });
      }
    }

    let bindingAffinity = 0;
    let rmsd: number | null = null;
    while (i < lines.length) {
      const line = lines[i];
      if (line.includes('SCORE') || line.includes('docking_score') || line.includes('binding_affinity')) {
        const match = line.match(/-?\d+\.?\d*/);
        if (match) bindingAffinity = parseFloat(match[0]);
      } else if (line.includes('RMSD') || line.includes('rmsd')) {
        const match = line.match(/-?\d+\.?\d*/);
        if (match) rmsd = parseFloat(match[0]);
      }
      i++;
    }

    detectAromaticity(atoms, bonds);
    computeGasteigerCharges(atoms, bonds);

    conformations.push({
      id: validConfsCount,
      atoms,
      bonds,
      bindingEnergy: bindingAffinity,
      rmsd,
      name,
    });
    validConfsCount++;
  }

  if (conformations.length === 0) {
    throw new Error('MOL2文件格式错误，无法解析出有效原子坐标，请检查文件格式');
  }

  return {
    wasTruncated,
    ligand: {
      id: `lig_${Date.now()}`,
      name: filename.replace(/\.(mol2|ml2)$/i, ''),
      conformations: conformations.sort((a, b) => a.bindingEnergy - b.bindingEnergy),
      currentConformation: 0,
      filename,
      format: 'mol2',
      visibleConformations: [0],
    },
  };
}
