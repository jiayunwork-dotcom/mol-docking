import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { Measurement } from '../types';
import { formatMeasurement } from '../analysis/measurementTools';

interface MeasurementAnnotationsProps {
  measurements: Measurement[];
  onRemove: (id: string) => void;
}

export function MeasurementAnnotations({ measurements }: MeasurementAnnotationsProps) {
  const groupRef = useRef<THREE.Group>(null);

  const elements = useMemo(() => {
    const result: {
      type: 'line' | 'arc' | 'text';
      geometry?: THREE.BufferGeometry;
      material?: THREE.LineBasicMaterial;
      position?: [number, number, number];
      text?: string;
      color: string;
    }[] = [];

    for (const meas of measurements) {
      const color = meas.type === 'distance' ? '#00ff00' : meas.type === 'angle' ? '#ff00ff' : '#00ffff';

      if (meas.type === 'distance' && meas.atoms.length >= 2) {
        const a1 = meas.atoms[0];
        const a2 = meas.atoms[1];
        const positions = [a1.x, a1.y, a1.z, a2.x, a2.y, a2.z];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color });

        result.push({
          type: 'line',
          geometry,
          material,
          text: formatMeasurement(meas),
          position: [meas.position.x, meas.position.y, meas.position.z],
          color,
        });
      } else if (meas.type === 'angle' && meas.atoms.length >= 3) {
        const a1 = meas.atoms[0];
        const a2 = meas.atoms[1];
        const a3 = meas.atoms[2];

        const positions1 = [a1.x, a1.y, a1.z, a2.x, a2.y, a2.z];
        const positions2 = [a2.x, a2.y, a2.z, a3.x, a3.y, a3.z];

        const geometry1 = new THREE.BufferGeometry();
        geometry1.setAttribute('position', new THREE.Float32BufferAttribute(positions1, 3));
        const geometry2 = new THREE.BufferGeometry();
        geometry2.setAttribute('position', new THREE.Float32BufferAttribute(positions2, 3));
        const material = new THREE.LineBasicMaterial({ color });

        result.push({ type: 'line', geometry: geometry1, material, color });
        result.push({ type: 'line', geometry: geometry2, material, color });
        result.push({
          type: 'text',
          text: formatMeasurement(meas),
          position: [meas.position.x, meas.position.y, meas.position.z],
          color,
        });
      } else if (meas.type === 'dihedral' && meas.atoms.length >= 4) {
        const a1 = meas.atoms[0];
        const a2 = meas.atoms[1];
        const a3 = meas.atoms[2];
        const a4 = meas.atoms[3];

        const positions1 = [a1.x, a1.y, a1.z, a2.x, a2.y, a2.z];
        const positions2 = [a2.x, a2.y, a2.z, a3.x, a3.y, a3.z];
        const positions3 = [a3.x, a3.y, a3.z, a4.x, a4.y, a4.z];

        const geometry1 = new THREE.BufferGeometry();
        geometry1.setAttribute('position', new THREE.Float32BufferAttribute(positions1, 3));
        const geometry2 = new THREE.BufferGeometry();
        geometry2.setAttribute('position', new THREE.Float32BufferAttribute(positions2, 3));
        const geometry3 = new THREE.BufferGeometry();
        geometry3.setAttribute('position', new THREE.Float32BufferAttribute(positions3, 3));
        const material = new THREE.LineBasicMaterial({ color });

        result.push({ type: 'line', geometry: geometry1, material, color });
        result.push({ type: 'line', geometry: geometry2, material, color });
        result.push({ type: 'line', geometry: geometry3, material, color });
        result.push({
          type: 'text',
          text: formatMeasurement(meas),
          position: [meas.position.x, meas.position.y, meas.position.z],
          color,
        });
      }
    }

    return result;
  }, [measurements]);

  return (
    <group ref={groupRef}>
      {elements.map((elem, idx) => {
        if (elem.type === 'line' && elem.geometry && elem.material) {
          return (
            <primitive
              key={`line_${idx}`}
              object={new THREE.Line(elem.geometry, elem.material)}
              userData={{ type: 'measurement', isClickable: false }}
            />
          );
        }
        return null;
      })}
    </group>
  );
}

export function SelectedAtomsHighlighter({ selectedAtoms }: { selectedAtoms: any[] }) {
  const groupRef = useRef<THREE.Group>(null);

  const spheres = useMemo(() => {
    return selectedAtoms.map((atom) => {
      const geometry = new THREE.SphereGeometry(0.5, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.5,
      });
      return {
        geometry,
        material,
        position: [atom.x, atom.y, atom.z] as [number, number, number],
      };
    });
  }, [selectedAtoms]);

  return (
    <group ref={groupRef}>
      {spheres.map((sphere, idx) => (
        <mesh
          key={idx}
          position={sphere.position}
          geometry={sphere.geometry}
          material={sphere.material}
          userData={{ type: 'highlight', isClickable: false }}
        />
      ))}
    </group>
  );
}
