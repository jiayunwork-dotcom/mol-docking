import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { Protein } from '../types';
import { SECONDARY_STRUCTURE_COLORS } from '../types';

interface ProteinCartoonProps {
  protein: Protein;
  visibleChains: Set<string>;
}

export function ProteinCartoon({ protein, visibleChains }: ProteinCartoonProps) {
  const groupRef = useRef<THREE.Group>(null);

  const meshes = useMemo(() => {
    const result: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; position: [number, number, number]; rotation?: [number, number, number] }[] = [];

    protein.chains.forEach((chain, chainId) => {
      if (!visibleChains.has(chainId)) return;

      const caAtoms = chain.residues
        .filter(r => !r.isMissing)
        .map(r => r.atoms.find(a => a.atomName === 'CA' || a.atomName === 'C'))
        .filter(Boolean);

      if (caAtoms.length < 2) return;

      for (let i = 0; i < caAtoms.length - 1; i++) {
        const current = caAtoms[i]!;
        const next = caAtoms[i + 1]!;
        const residue = chain.residues.find(r => r.seqNum === current.residueId)!;

        const start = new THREE.Vector3(current.x, current.y, current.z);
        const end = new THREE.Vector3(next.x, next.y, next.z);
        const direction = end.clone().sub(start).normalize();
        const length = start.distanceTo(end);

        const color = new THREE.Color(SECONDARY_STRUCTURE_COLORS[residue.secondaryStructure]);
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.3,
          metalness: 0.1,
        });

        if (residue.secondaryStructure === 'helix') {
          const geometry = new THREE.CylinderGeometry(1.2, 1.2, length, 8);
          const mid = start.clone().add(end).multiplyScalar(0.5);
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
          const euler = new THREE.Euler().setFromQuaternion(quaternion);

          result.push({
            geometry,
            material,
            position: [mid.x, mid.y, mid.z],
            rotation: [euler.x, euler.y, euler.z],
          });
        } else if (residue.secondaryStructure === 'sheet') {
          const geometry = new THREE.BoxGeometry(2.5, 0.4, length);
          const mid = start.clone().add(end).multiplyScalar(0.5);
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
          const euler = new THREE.Euler().setFromQuaternion(quaternion);

          result.push({
            geometry,
            material,
            position: [mid.x, mid.y, mid.z],
            rotation: [euler.x, euler.y, euler.z],
          });
        } else {
          const geometry = new THREE.CylinderGeometry(0.3, 0.3, length, 6);
          const mid = start.clone().add(end).multiplyScalar(0.5);
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
          const euler = new THREE.Euler().setFromQuaternion(quaternion);

          result.push({
            geometry,
            material,
            position: [mid.x, mid.y, mid.z],
            rotation: [euler.x, euler.y, euler.z],
          });
        }
      }
    });

    return result;
  }, [protein, visibleChains]);

  return (
    <group ref={groupRef}>
      {meshes.map((mesh, idx) => (
        <mesh
          key={idx}
          position={mesh.position}
          rotation={mesh.rotation}
          geometry={mesh.geometry}
          material={mesh.material}
          userData={{ type: 'protein', isClickable: true }}
        />
      ))}
    </group>
  );
}
