import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { Interaction, InteractionType } from '../types';
import { INTERACTION_COLORS } from '../types';

interface InteractionLinesProps {
  interactions: Interaction[];
  visibleTypes: Set<InteractionType>;
}

export function InteractionLines({ interactions, visibleTypes }: InteractionLinesProps) {
  const groupRef = useRef<THREE.Group>(null);

  const lines = useMemo(() => {
    const result: { geometry: THREE.BufferGeometry; material: THREE.LineDashedMaterial; positions: number[] }[] = [];

    for (const inter of interactions) {
      if (!visibleTypes.has(inter.type) || !inter.donorAtom || !inter.acceptorAtom) continue;

      const positions = [
        inter.donorAtom?.x || 0, inter.donorAtom?.y || 0, inter.donorAtom?.z || 0,
        inter.acceptorAtom?.x || 0, inter.acceptorAtom?.y || 0, inter.acceptorAtom?.z || 0,
      ];

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      const color = new THREE.Color(INTERACTION_COLORS[inter.type]);
      const material = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.3,
        gapSize: 0.2,
        linewidth: 2,
      });

      result.push({ geometry, material, positions });
    }

    return result;
  }, [interactions, visibleTypes]);

  return (
    <group ref={groupRef}>
      {lines.map((line, idx) => (
        <lineSegments
          key={idx}
          geometry={line.geometry}
          material={line.material}
          computeLineDistances
          userData={{ type: 'interaction', isClickable: false }}
        />
      ))}
    </group>
  );
}
