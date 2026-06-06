import type { Atom, Protein, Chain, Residue, Element } from '../types';
import { VDW_RADII, KYTE_DOOLITTLE } from '../types';

function parseElement(symbol: string): Element {
  const clean = symbol.trim().toUpperCase();
  if (['C', 'N', 'O', 'S', 'P', 'F', 'CL', 'BR', 'I', 'H'].includes(clean)) {
    if (clean === 'CL') return 'Cl';
    if (clean === 'BR') return 'Br';
    return clean as Element;
  }
  return 'Other';
}

function getSecondaryStructure(helixRanges: Map<string, Set<number>>, sheetRanges: Map<string, Set<number>>, chainId: string, seqNum: number): 'helix' | 'sheet' | 'loop' {
  const helixSet = helixRanges.get(chainId);
  if (helixSet?.has(seqNum)) return 'helix';
  const sheetSet = sheetRanges.get(chainId);
  if (sheetSet?.has(seqNum)) return 'sheet';
  return 'loop';
}

export async function parsePDB(content: string, filename: string, onProgress?: (progress: number) => Promise<void>): Promise<Protein> {
  const lines = content.split('\n');
  const atoms: Atom[] = [];
  const helixRanges = new Map<string, Set<number>>();
  const sheetRanges = new Map<string, Set<number>>();
  const residueMap = new Map<string, Residue>();
  const seqNumsByChain = new Map<string, Set<number>>();
  let atomId = 0;
  let hasMissingResidues = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (onProgress && i % 1000 === 0) {
      await onProgress(i / lines.length);
    }

    if (line.startsWith('HELIX')) {
      const chainId = line.substring(19, 20).trim();
      const start = parseInt(line.substring(21, 25).trim());
      const end = parseInt(line.substring(33, 37).trim());
      if (!helixRanges.has(chainId)) helixRanges.set(chainId, new Set());
      const set = helixRanges.get(chainId)!;
      for (let j = start; j <= end; j++) set.add(j);
    }

    if (line.startsWith('SHEET')) {
      const chainId = line.substring(21, 22).trim();
      const start = parseInt(line.substring(22, 26).trim());
      const end = parseInt(line.substring(33, 37).trim());
      if (!sheetRanges.has(chainId)) sheetRanges.set(chainId, new Set());
      const set = sheetRanges.get(chainId)!;
      for (let j = start; j <= end; j++) set.add(j);
    }

    if (line.startsWith('MISSING RESIDUES') || line.startsWith('REMARK 465')) {
      hasMissingResidues = true;
    }

    if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
      const element = parseElement(line.substring(76, 78));
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const z = parseFloat(line.substring(46, 54));
      const chainId = line.substring(21, 22).trim();
      const residueName = line.substring(17, 20).trim();
      const seqNum = parseInt(line.substring(22, 26).trim());
      const atomName = line.substring(12, 16).trim();

      if (!seqNumsByChain.has(chainId)) {
        seqNumsByChain.set(chainId, new Set());
      }
      seqNumsByChain.get(chainId)!.add(seqNum);

      const residueKey = `${chainId}_${seqNum}_${residueName}`;
      if (!residueMap.has(residueKey)) {
        const ss = getSecondaryStructure(helixRanges, sheetRanges, chainId, seqNum);
        residueMap.set(residueKey, {
          id: seqNum,
          name: residueName,
          chainId,
          seqNum,
          atoms: [],
          secondaryStructure: ss,
          isMissing: false,
          hydrophobicity: KYTE_DOOLITTLE[residueName] ?? 0,
        });
      }

      const atom: Atom = {
        id: atomId++,
        element,
        x, y, z,
        chainId,
        residueName,
        residueId: seqNum,
        atomName,
        vdwRadius: VDW_RADII[element],
        isHydrogen: element === 'H',
      };

      atoms.push(atom);
      residueMap.get(residueKey)!.atoms.push(atom);
    }
  }

  const chains = new Map<string, Chain>();
  seqNumsByChain.forEach((seqNums, chainId) => {
    const sortedSeqNums = Array.from(seqNums).sort((a, b) => a - b);
    const minSeq = Math.min(...sortedSeqNums);
    const maxSeq = Math.max(...sortedSeqNums);
    const chainResidues: Residue[] = [];

    for (let seq = minSeq; seq <= maxSeq; seq++) {
      let found = false;
      for (const res of residueMap.values()) {
        if (res.chainId === chainId && res.seqNum === seq) {
          chainResidues.push(res);
          found = true;
          break;
        }
      }
      if (!found) {
        hasMissingResidues = true;
        chainResidues.push({
          id: seq,
          name: '???',
          chainId,
          seqNum: seq,
          atoms: [],
          secondaryStructure: 'loop',
          isMissing: true,
        });
      }
    }

    chains.set(chainId, {
      id: chainId,
      name: chainId,
      residues: chainResidues,
      visible: true,
    });
  });

  if (onProgress) await onProgress(1);

  let numResidues = 0;
  chains.forEach(chain => {
    numResidues += chain.residues.length;
  });

  return {
    id: `prot_${Date.now()}`,
    name: filename.replace(/\.(pdb|cif)$/i, ''),
    atoms,
    chains,
    hasMissingResidues,
    filename,
    format: 'pdb',
    numResidues,
  };
}

export async function parseMMCIF(content: string, filename: string, onProgress?: (progress: number) => Promise<void>): Promise<Protein> {
  const lines = content.split('\n');
  const atoms: Atom[] = [];
  const helixRanges = new Map<string, Set<number>>();
  const sheetRanges = new Map<string, Set<number>>();
  const residueMap = new Map<string, Residue>();
  const seqNumsByChain = new Map<string, Set<number>>();
  let atomId = 0;
  let hasMissingResidues = false;
  let inAtomLoop = false;
  // let inStructConf = false;
  // let inStructSheet = false;
  let atomColumns: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (onProgress && i % 1000 === 0) {
      await onProgress(i / lines.length);
    }

    if (line.startsWith('loop_')) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine?.startsWith('_atom_site.')) {
        inAtomLoop = true;
        atomColumns = {};
        let j = i + 1;
        while (lines[j]?.trim().startsWith('_atom_site.')) {
          const colName = lines[j].trim().substring(11);
          atomColumns[colName] = j - (i + 1);
          j++;
        }
        i = j - 1;
        continue;
      } else if (nextLine?.startsWith('_struct_conf.')) {
        // inStructConf = true;
        let j = i + 1;
        const confColumns: Record<string, number> = {};
        while (lines[j]?.trim().startsWith('_struct_conf.')) {
          const colName = lines[j].trim().substring(14);
          confColumns[colName] = j - (i + 1);
          j++;
        }
        while (lines[j]?.trim() && !lines[j].startsWith('#') && !lines[j].startsWith('loop_')) {
          const parts = lines[j].trim().split(/\s+/);
          const type = parts[confColumns['conf_type_id'] || 0];
          const chainId = parts[confColumns['beg_auth_asym_id'] || 1];
          const start = parseInt(parts[confColumns['beg_auth_seq_id'] || 3]);
          const end = parseInt(parts[confColumns['end_auth_seq_id'] || 5]);
          if (type === 'HELX' || type.startsWith('HELIX')) {
            if (!helixRanges.has(chainId)) helixRanges.set(chainId, new Set());
            for (let k = start; k <= end; k++) helixRanges.get(chainId)!.add(k);
          }
          j++;
        }
        i = j - 1;
        continue;
      } else if (nextLine?.startsWith('_struct_sheet_range.')) {
        // inStructSheet = true;
        let j = i + 1;
        const sheetColumns: Record<string, number> = {};
        while (lines[j]?.trim().startsWith('_struct_sheet_range.')) {
          const colName = lines[j].trim().substring(19);
          sheetColumns[colName] = j - (i + 1);
          j++;
        }
        while (lines[j]?.trim() && !lines[j].startsWith('#') && !lines[j].startsWith('loop_')) {
          const parts = lines[j].trim().split(/\s+/);
          const chainId = parts[sheetColumns['auth_asym_id'] || 1];
          const start = parseInt(parts[sheetColumns['auth_seq_id'] || 2]);
          const end = parseInt(parts[sheetColumns['auth_seq_id'] || 2]) + 1;
          if (!sheetRanges.has(chainId)) sheetRanges.set(chainId, new Set());
          for (let k = start; k <= end; k++) sheetRanges.get(chainId)!.add(k);
          j++;
        }
        i = j - 1;
        continue;
      }
    }

    if (inAtomLoop && line && !line.startsWith('#') && !line.startsWith('_') && !line.startsWith('loop_')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 10) {
        const group = parts[atomColumns['group_PDB'] || 0];
        if (group === 'ATOM' || group === 'HETATM') {
          const element = parseElement(parts[atomColumns['type_symbol'] || parts.length - 1]);
          const x = parseFloat(parts[atomColumns['Cartn_x'] || 10]);
          const y = parseFloat(parts[atomColumns['Cartn_y'] || 11]);
          const z = parseFloat(parts[atomColumns['Cartn_z'] || 12]);
          const chainId = parts[atomColumns['auth_asym_id'] || 6];
          const residueName = parts[atomColumns['auth_comp_id'] || 5];
          const seqNum = parseInt(parts[atomColumns['auth_seq_id'] || 8]);
          const atomName = parts[atomColumns['auth_atom_id'] || 3];

          if (!seqNumsByChain.has(chainId)) {
            seqNumsByChain.set(chainId, new Set());
          }
          seqNumsByChain.get(chainId)!.add(seqNum);

          const residueKey = `${chainId}_${seqNum}_${residueName}`;
          if (!residueMap.has(residueKey)) {
            const ss = getSecondaryStructure(helixRanges, sheetRanges, chainId, seqNum);
            residueMap.set(residueKey, {
              id: seqNum,
              name: residueName,
              chainId,
              seqNum,
              atoms: [],
              secondaryStructure: ss,
              isMissing: false,
              hydrophobicity: KYTE_DOOLITTLE[residueName] ?? 0,
            });
          }

          const atom: Atom = {
            id: atomId++,
            element,
            x, y, z,
            chainId,
            residueName,
            residueId: seqNum,
            atomName,
            vdwRadius: VDW_RADII[element],
            isHydrogen: element === 'H',
          };

          atoms.push(atom);
          residueMap.get(residueKey)!.atoms.push(atom);
        }
      }
    }

    if (line.startsWith('#') && inAtomLoop) {
      inAtomLoop = false;
    }
  }

  const chains = new Map<string, Chain>();
  seqNumsByChain.forEach((seqNums, chainId) => {
    const sortedSeqNums = Array.from(seqNums).sort((a, b) => a - b);
    const minSeq = Math.min(...sortedSeqNums);
    const maxSeq = Math.max(...sortedSeqNums);
    const chainResidues: Residue[] = [];

    for (let seq = minSeq; seq <= maxSeq; seq++) {
      let found = false;
      for (const res of residueMap.values()) {
        if (res.chainId === chainId && res.seqNum === seq) {
          chainResidues.push(res);
          found = true;
          break;
        }
      }
      if (!found) {
        hasMissingResidues = true;
        chainResidues.push({
          id: seq,
          name: '???',
          chainId,
          seqNum: seq,
          atoms: [],
          secondaryStructure: 'loop',
          isMissing: true,
        });
      }
    }

    chains.set(chainId, {
      id: chainId,
      name: chainId,
      residues: chainResidues,
      visible: true,
    });
  });

  if (onProgress) await onProgress(1);

  let numResidues = 0;
  chains.forEach(chain => {
    numResidues += chain.residues.length;
  });

  return {
    id: `prot_${Date.now()}`,
    name: filename.replace(/\.(pdb|cif)$/i, ''),
    atoms,
    chains,
    hasMissingResidues,
    filename,
    format: 'mmcif',
    numResidues,
  };
}
