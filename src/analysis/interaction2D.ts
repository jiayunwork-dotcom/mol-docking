import type { Interaction, Residue, LigandConformation } from '../types';
import { INTERACTION_COLORS } from '../types';

interface Node2D {
  id: string;
  x: number;
  y: number;
  type: 'ligand' | 'residue';
  residue?: Residue;
  label: string;
  radius: number;
  color: string;
}

interface Edge2D {
  id: string;
  from: string;
  to: string;
  type: string;
  color: string;
  distance: number;
}

function getMinInteractionDistance(residue: Residue, interactions: Interaction[]): number {
  let minDist = Infinity;
  for (const inter of interactions) {
    if (inter.donorResidue?.id === residue.id ||
        inter.acceptorResidue?.id === residue.id) {
      minDist = Math.min(minDist, inter.distance);
    }
  }
  return minDist;
}

// function distanceSq2D(x1: number, y1: number, x2: number, y2: number): number {
//   const dx = x1 - x2, dy = y1 - y2;
//   return dx * dx + dy * dy;
// }

export function generate2DLayout(
  _conformation: LigandConformation,
  interactions: Interaction[],
  pocketResidues: Residue[]
): { nodes: Node2D[]; edges: Edge2D[] } {
  const nodes: Node2D[] = [];
  const edges: Edge2D[] = [];

  nodes.push({
    id: 'ligand',
    x: 0,
    y: 0,
    type: 'ligand',
    label: 'Ligand',
    radius: 40,
    color: '#4A90D9',
  });

  const residueSet = new Set<string>();
  for (const inter of interactions) {
    if (inter.donorResidue && !inter.donorResidue.isMissing) {
      residueSet.add(`${inter.donorResidue.chainId}_${inter.donorResidue.seqNum}`);
    }
    if (inter.acceptorResidue && !inter.acceptorResidue.isMissing) {
      residueSet.add(`${inter.acceptorResidue.chainId}_${inter.acceptorResidue.seqNum}`);
    }
  }

  const interactingResidues = pocketResidues.filter(r =>
    residueSet.has(`${r.chainId}_${r.seqNum}`)
  );

  const residuesByLayer = new Map<number, Residue[]>();
  for (const res of interactingResidues) {
    const dist = getMinInteractionDistance(res, interactions);
    const layer = Math.floor(dist / 2);
    if (!residuesByLayer.has(layer)) {
      residuesByLayer.set(layer, []);
    }
    residuesByLayer.get(layer)!.push(res);
  }

  const layerRadii: number[] = [];
  let currentRadius = 80;
  const layers = Array.from(residuesByLayer.keys()).sort((a, b) => a - b);
  for (let i = 0; i < layers.length; i++) {
    layerRadii.push(currentRadius);
    currentRadius += 60;
  }

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const residues = residuesByLayer.get(layer)!
      .sort((a, b) => a.seqNum - b.seqNum);
    const radius = layerRadii[li];
    const n = residues.length;

    for (let ri = 0; ri < n; ri++) {
      const res = residues[ri];
      const angle = (2 * Math.PI * ri) / n;
      nodes.push({
        id: `${res.chainId}_${res.seqNum}`,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        type: 'residue',
        residue: res,
        label: `${res.name} ${res.seqNum}`,
        radius: 25,
        color: getResidueColor(res),
      });
    }
  }

  for (let iter = 0; iter < 5; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    nodes.forEach(n => forces.set(n.id, { fx: 0, fy: 0 }));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 0.01;
        const minDist = n1.radius + n2.radius + 10;

        if (dist < minDist) {
          const force = (minDist - dist) * 0.1;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const f1 = forces.get(n1.id)!;
          const f2 = forces.get(n2.id)!;
          f1.fx -= fx;
          f1.fy -= fy;
          f2.fx += fx;
          f2.fy += fy;
        }
      }
    }

    nodes.forEach(node => {
      if (node.id === 'ligand') return;
      const f = forces.get(node.id)!;
      const dist = Math.sqrt(node.x * node.x + node.y * node.y) || 1;
      const angle = Math.atan2(node.y, node.x);
      const targetRadius = Math.max(80, dist + f.fy * 0.5);
      node.x = targetRadius * Math.cos(angle) + f.fx * 0.5;
      node.y = targetRadius * Math.sin(angle);
    });
  }

  for (let i = 0; i < interactions.length; i++) {
    const inter = interactions[i];
    let fromId = 'ligand';
    let toId = '';

    if (inter.donorResidue && !inter.donorResidue.isMissing) {
      toId = `${inter.donorResidue.chainId}_${inter.donorResidue.seqNum}`;
    } else if (inter.acceptorResidue && !inter.acceptorResidue.isMissing) {
      toId = `${inter.acceptorResidue.chainId}_${inter.acceptorResidue.seqNum}`;
    }

    if (toId && nodes.find(n => n.id === toId)) {
      edges.push({
        id: `edge_${i}`,
        from: fromId,
        to: toId,
        type: inter.type,
        color: INTERACTION_COLORS[inter.type],
        distance: inter.distance,
      });
    }
  }

  return { nodes, edges };
}

function getResidueColor(res: Residue): string {
  const hydrophobic = ['ALA', 'VAL', 'LEU', 'ILE', 'PHE', 'MET', 'TRP'];
  const positive = ['LYS', 'ARG', 'HIS'];
  const negative = ['ASP', 'GLU'];
  const polar = ['SER', 'THR', 'ASN', 'GLN', 'TYR'];

  if (hydrophobic.includes(res.name)) return '#FFD59E';
  if (positive.includes(res.name)) return '#99CCFF';
  if (negative.includes(res.name)) return '#FF9999';
  if (polar.includes(res.name)) return '#99FF99';
  if (res.name === 'CYS') return '#FFFF99';
  if (res.name === 'PRO') return '#CCCCCC';
  if (res.name === 'GLY') return '#FFFFFF';
  return '#CCCCCC';
}

export function renderInteraction2D(
  ctx: CanvasRenderingContext2D,
  nodes: Node2D[],
  edges: Edge2D[],
  width: number,
  height: number,
  highlightedResidue?: string
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, -1);

  edges.forEach(edge => {
    const from = nodes.find(n => n.id === edge.from);
    const to = nodes.find(n => n.id === edge.to);
    if (!from || !to) return;

    const isHighlighted = edge.to === highlightedResidue || edge.from === highlightedResidue;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = edge.color;
    ctx.lineWidth = isHighlighted ? 3 : 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  nodes.forEach(node => {
    const isHighlighted = node.id === highlightedResidue;

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.strokeStyle = isHighlighted ? '#FF0000' : '#333333';
    ctx.lineWidth = isHighlighted ? 3 : 1;
    ctx.stroke();

    ctx.save();
    ctx.scale(1, -1);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, node.x, -node.y);
    ctx.restore();
  });

  ctx.restore();
}

export function draw2DInteraction(
  ctx: CanvasRenderingContext2D,
  layout: { nodes: Node2D[]; edges: Edge2D[] },
  width: number,
  height: number
): void {
  renderInteraction2D(ctx, layout.nodes, layout.edges, width, height);
}
