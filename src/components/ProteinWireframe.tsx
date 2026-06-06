import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { Protein } from '../types';
import { ELEMENT_COLORS } from '../types';

interface ProteinWireframeProps {
  protein: Protein;
  visibleChains: Set<string>;
}

export function ProteinWireframe({ protein, visibleChains }: ProteinWireframeProps) {
  const groupRef = useRef<THREE.Group>(null);

  const { atoms, bonds } = useMemo(() => {
    const atomResults: { geometry: THREE.SphereGeometry; material: THREE.MeshStandardMaterial; position: [number, number, number]; atom: typeof protein.atoms[0] }[] = [];
    const bondResults: { geometry: THREE.CylinderGeometry; material: THREE.MeshStandardMaterial; position: [number, number, number]; rotation: [number, number, number] }[] = [];

    const atomRadius = 0.15;
    const bondRadius = 0.05;
    const bondCutoff = 1.8;

    const visibleAtoms: typeof protein.atoms = [];

    protein.chains.forEach((chain, chainId) => {
      if (!visibleChains.has(chainId)) return;
      chain.residues.forEach(res => {
        if (!res.isMissing) {
          visibleAtoms.push(...res.atoms);
        }
      });
    });

    for (const atom of visibleAtoms) {
      const color = new THREE.Color(ELEMENT_COLORS[atom.element] || ELEMENT_COLORS.Other);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.1,
      });
      const geometry = new THREE.SphereGeometry(atomRadius, 8, 8);

      atomResults.push({
        geometry,
        material,
        position: [atom.x, atom.y, atom.z],
        atom,
      });
    }

    const up = new THREE.Vector3(0, 1, 0);
    const bondDirection = new THREE.Vector3();

    for (let i = 0; i < visibleAtoms.length; i++) {
      for (let j = i + 1; j < visibleAtoms.length; j++) {
        const a1 = visibleAtoms[i];
        const a2 = visibleAtoms[j];
        const dx = a1.x - a2.x;
        const dy = a1.y - a2.y;
        const dz = a1.z - a2.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < bondCutoff && dist > 0.5) {
          const start = new THREE.Vector3(a1.x, a1.y, a1.z);
          const end = new THREE.Vector3(a2.x, a2.y, a2.z);
          const mid = start.clone().add(end).multiplyScalar(0.5);

          bondDirection.subVectors(end, start).normalize();
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(up, bondDirection);
          const euler = new THREE.Euler().setFromQuaternion(quaternion);

          const color1 = new THREE.Color(ELEMENT_COLORS[a1.element] || ELEMENT_COLORS.Other);
          const color2 = new THREE.Color(ELEMENT_COLORS[a2.element] || ELEMENT_COLORS.Other);

          const halfLength = dist / 2;
          const offset = bondDirection.clone().multiplyScalar(halfLength / 2);
          const startPos = mid.clone().sub(offset);
          const endPos = mid.clone().add(offset);

          const material1 = new THREE.MeshStandardMaterial({
            color: color1,
            roughness: 0.3,
            metalness: 0.1,
          });
          const material2 = new THREE.MeshStandardMaterial({
            color: color2,
            roughness: 0.3,
            metalness: 0.1,
          });

          const geometry1 = new THREE.CylinderGeometry(bondRadius, bondRadius, halfLength, 6);
          const geometry2 = new THREE.CylinderGeometry(bondRadius, bondRadius, halfLength, 6);

          bondResults.push({
            geometry: geometry1,
            material: material1,
            position: [startPos.x, startPos.y, startPos.z],
            rotation: [euler.x, euler.y, euler.z],
          });
          bondResults.push({
            geometry: geometry2,
            material: material2,
            position: [endPos.x, endPos.y, endPos.z],
            rotation: [euler.x, euler.y, euler.z],
          });
        }
      }
    }

    return { atoms: atomResults, bonds: bondResults };
  }, [protein, visibleChains]);

  return (
    <group ref={groupRef}>
      {atoms.map((atom, idx) => (
        <mesh
          key={`atom_${idx}`}
          position={atom.position}
          geometry={atom.geometry}
          material={atom.material}
          userData={{ type: 'protein', atom: atom.atom, isClickable: true }}
        />
      ))}
      {bonds.map((bond, idx) => (
        <mesh
          key={`bond_${idx}`}
          position={bond.position}
          rotation={bond.rotation}
          geometry={bond.geometry}
          material={bond.material}
          userData={{ type: 'protein', isClickable: false }}
        />
      ))}
    </group>
  );
}
