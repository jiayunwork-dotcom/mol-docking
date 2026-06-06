import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { LigandConformation } from '../types';
import { ELEMENT_COLORS } from '../types';

interface LigandSticksProps {
  conformation: LigandConformation;
  color?: string;
  opacity?: number;
}

export function LigandSticks({ conformation, opacity = 1 }: LigandSticksProps) {
  const groupRef = useRef<THREE.Group>(null);

  const { atomMeshes, bondMeshes } = useMemo(() => {
    const atomResults: { geometry: THREE.SphereGeometry; material: THREE.MeshStandardMaterial; position: [number, number, number] }[] = [];
    const bondResults: { geometry: THREE.CylinderGeometry; material: THREE.MeshStandardMaterial; position: [number, number, number]; rotation: [number, number, number] }[] = [];

    const atomRadius = 0.3;
    const bondRadius = 0.15;

    for (const atom of conformation.atoms) {
      const color = new THREE.Color(ELEMENT_COLORS[atom.element] || ELEMENT_COLORS.Other);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.2,
        metalness: 0.1,
        transparent: opacity < 1,
        opacity,
      });
      const geometry = new THREE.SphereGeometry(atomRadius, 16, 16);

      atomResults.push({
        geometry,
        material,
        position: [atom.x, atom.y, atom.z],
      });
    }

    const bondDirection = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (const bond of conformation.bonds) {
      const atom1 = conformation.atoms[bond.atom1];
      const atom2 = conformation.atoms[bond.atom2];
      if (!atom1 || !atom2) continue;

      const start = new THREE.Vector3(atom1.x, atom1.y, atom1.z);
      const end = new THREE.Vector3(atom2.x, atom2.y, atom2.z);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const length = start.distanceTo(end);

      const color1 = new THREE.Color(ELEMENT_COLORS[atom1.element] || ELEMENT_COLORS.Other);
      const color2 = new THREE.Color(ELEMENT_COLORS[atom2.element] || ELEMENT_COLORS.Other);

      bondDirection.subVectors(end, start).normalize();
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, bondDirection);
      const euler = new THREE.Euler().setFromQuaternion(quaternion);

      const halfLength = length / 2;

      const material1 = new THREE.MeshStandardMaterial({
        color: color1,
        roughness: 0.2,
        metalness: 0.1,
        transparent: opacity < 1,
        opacity,
      });
      const material2 = new THREE.MeshStandardMaterial({
        color: color2,
        roughness: 0.2,
        metalness: 0.1,
        transparent: opacity < 1,
        opacity,
      });

      const geometry1 = new THREE.CylinderGeometry(bondRadius, bondRadius, halfLength, 8);
      const geometry2 = new THREE.CylinderGeometry(bondRadius, bondRadius, halfLength, 8);

      const offset = bondDirection.clone().multiplyScalar(halfLength / 2);
      const startPos = mid.clone().sub(offset);
      const endPos = mid.clone().add(offset);

      if (bond.order === 2) {
        const perp = new THREE.Vector3(0, 0, 1).cross(bondDirection).normalize();
        if (perp.lengthSq() < 0.01) {
          perp.set(1, 0, 0).cross(bondDirection).normalize();
        }
        perp.multiplyScalar(bondRadius * 1.5);

        bondResults.push({
          geometry: geometry1,
          material: material1,
          position: [startPos.x + perp.x, startPos.y + perp.y, startPos.z + perp.z],
          rotation: [euler.x, euler.y, euler.z],
        });
        bondResults.push({
          geometry: geometry2,
          material: material2,
          position: [endPos.x + perp.x, endPos.y + perp.y, endPos.z + perp.z],
          rotation: [euler.x, euler.y, euler.z],
        });
        bondResults.push({
          geometry: geometry1.clone(),
          material: material1.clone(),
          position: [startPos.x - perp.x, startPos.y - perp.y, startPos.z - perp.z],
          rotation: [euler.x, euler.y, euler.z],
        });
        bondResults.push({
          geometry: geometry2.clone(),
          material: material2.clone(),
          position: [endPos.x - perp.x, endPos.y - perp.y, endPos.z - perp.z],
          rotation: [euler.x, euler.y, euler.z],
        });
      } else if (bond.order === 3) {
        const perp1 = new THREE.Vector3(0, 0, 1).cross(bondDirection).normalize();
        if (perp1.lengthSq() < 0.01) {
          perp1.set(1, 0, 0).cross(bondDirection).normalize();
        }
        const perp2 = perp1.clone().cross(bondDirection).normalize();
        perp1.multiplyScalar(bondRadius * 1.5);
        perp2.multiplyScalar(bondRadius * 1.5);

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
        bondResults.push({
          geometry: geometry1.clone(),
          material: material1.clone(),
          position: [startPos.x + perp1.x, startPos.y + perp1.y, startPos.z + perp1.z],
          rotation: [euler.x, euler.y, euler.z],
        });
        bondResults.push({
          geometry: geometry2.clone(),
          material: material2.clone(),
          position: [endPos.x + perp1.x, endPos.y + perp1.y, endPos.z + perp1.z],
          rotation: [euler.x, euler.y, euler.z],
        });
        bondResults.push({
          geometry: geometry1.clone(),
          material: material1.clone(),
          position: [startPos.x - perp1.x, startPos.y - perp1.y, startPos.z - perp1.z],
          rotation: [euler.x, euler.y, euler.z],
        });
        bondResults.push({
          geometry: geometry2.clone(),
          material: material2.clone(),
          position: [endPos.x - perp1.x, endPos.y - perp1.y, endPos.z - perp1.z],
          rotation: [euler.x, euler.y, euler.z],
        });
      } else {
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

    return { atomMeshes: atomResults, bondMeshes: bondResults };
  }, [conformation, opacity]);

  return (
    <group ref={groupRef}>
      {atomMeshes.map((mesh, idx) => (
        <mesh
          key={`atom_${idx}`}
          position={mesh.position}
          geometry={mesh.geometry}
          material={mesh.material}
          userData={{ type: 'ligand', atom: conformation.atoms[idx], isClickable: true }}
        />
      ))}
      {bondMeshes.map((mesh, idx) => (
        <mesh
          key={`bond_${idx}`}
          position={mesh.position}
          rotation={mesh.rotation}
          geometry={mesh.geometry}
          material={mesh.material}
          userData={{ type: 'ligand', isClickable: false }}
        />
      ))}
    </group>
  );
}
