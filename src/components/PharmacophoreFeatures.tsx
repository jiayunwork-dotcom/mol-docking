import { useMemo } from 'react';
import * as THREE from 'three';
import type { PharmacophoreFeature, ExcludedVolume, ScoringResult, FeatureMatch, CandidateMolecule, Atom, Bond } from '../types';
import { PHARMACOPHORE_COLORS } from '../types';

interface PharmacophoreFeaturesProps {
  features: PharmacophoreFeature[];
  showFeatures: boolean;
  selectedResult?: ScoringResult | null;
  showCandidateMolecule?: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0.5, g: 0.5, b: 0.5 };
}

export function PharmacophoreFeatures({
  features,
  showFeatures,
  selectedResult,
  showCandidateMolecule = true,
}: PharmacophoreFeaturesProps) {
  const matchMap = useMemo(() => {
    if (!selectedResult) return new Map<string, FeatureMatch>();
    const map = new Map<string, FeatureMatch>();
    selectedResult.matchedFeatures.forEach((m) => {
      map.set(m.modelFeatureId, m);
      map.set(m.candidateFeatureId, m);
    });
    return map;
  }, [selectedResult]);

  const candidateFeatureMap = useMemo(() => {
    if (!selectedResult || !showCandidateMolecule) return new Map<string, PharmacophoreFeature>();
    const map = new Map<string, PharmacophoreFeature>();
    selectedResult.candidateFeatures.forEach((f) => map.set(f.id, f));
    return map;
  }, [selectedResult, showCandidateMolecule]);

  if (!showFeatures) return null;

  return (
    <group name="pharmacophore-features">
      {features.map((feature) => {
        const color = PHARMACOPHORE_COLORS[feature.type];
        const rgb = hexToRgb(color);
        const isMatched = matchMap.has(feature.id);
        const match = matchMap.get(feature.id);
        const candidateFeature = match ? candidateFeatureMap.get(match.candidateFeatureId) : null;

        return (
          <group key={feature.id} name={`feature-${feature.id}`}>
            <mesh position={[feature.x, feature.y, feature.z]}>
              <sphereGeometry args={[feature.radius, 32, 32]} />
              <meshStandardMaterial
                color={new THREE.Color(rgb.r, rgb.g, rgb.b)}
                transparent
                opacity={feature.isRequired ? 0.4 : 0.25}
                side={THREE.DoubleSide}
              />
            </mesh>

            <mesh position={[feature.x, feature.y, feature.z]}>
              <sphereGeometry args={[feature.radius * 0.15, 16, 16]} />
              <meshBasicMaterial color={new THREE.Color(rgb.r, rgb.g, rgb.b)} />
            </mesh>

            {!feature.isRequired && (
              <mesh position={[feature.x, feature.y + feature.radius + 0.3, feature.z]}>
                <torusGeometry args={[0.2, 0.05, 8, 16]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            )}

            {feature.type === 'aromatic_ring' && feature.normal && (
              <group>
                <mesh
                  position={[
                    feature.x + feature.normal.x * feature.radius * 0.8,
                    feature.y + feature.normal.y * feature.radius * 0.8,
                    feature.z + feature.normal.z * feature.radius * 0.8,
                  ]}
                >
                  <coneGeometry args={[0.2, 0.5, 8]} />
                  <meshBasicMaterial color={new THREE.Color(rgb.r, rgb.g, rgb.b)} />
                  <quaternion
                    attach="quaternion"
                    args={[
                      ...new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        new THREE.Vector3(feature.normal.x, feature.normal.y, feature.normal.z).normalize()
                      ).toArray(),
                    ]}
                  />
                </mesh>
              </group>
            )}

            {isMatched && candidateFeature && showCandidateMolecule && (
              <lineSegments>
                <bufferGeometry
                  ref={(geo) => {
                    if (geo) {
                      const positions = new Float32Array([
                        feature.x, feature.y, feature.z,
                        candidateFeature.x, candidateFeature.y, candidateFeature.z,
                      ]);
                      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                      geo.computeBoundingSphere();
                    }
                  }}
                />
                <lineDashedMaterial color="#00FF00" linewidth={2} dashSize={0.3} gapSize={0.15} />
              </lineSegments>
            )}

            {!isMatched && selectedResult && showCandidateMolecule && (
              <group position={[feature.x, feature.y, feature.z]}>
                <mesh rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.3, 0.05, 0.3]} />
                  <meshBasicMaterial color="#FF0000" />
                </mesh>
                <mesh rotation={[0, 0, -Math.PI / 4]}>
                  <boxGeometry args={[0.3, 0.05, 0.3]} />
                  <meshBasicMaterial color="#FF0000" />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

interface ExcludedVolumesProps {
  volumes: ExcludedVolume[];
  showExcludedVolumes: boolean;
}

export function ExcludedVolumes({ volumes, showExcludedVolumes }: ExcludedVolumesProps) {
  if (!showExcludedVolumes || volumes.length === 0) return null;

  return (
    <group name="excluded-volumes">
      {volumes.map((volume) => (
        <mesh
          key={volume.id}
          position={[volume.x, volume.y, volume.z]}
          name={`excluded-${volume.id}`}
        >
          <sphereGeometry args={[volume.radius, 24, 24]} />
          <meshStandardMaterial
            color="#808080"
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

interface CandidateMoleculeDisplayProps {
  result: ScoringResult | null;
  candidates: CandidateMolecule[];
  show: boolean;
}

export function CandidateMoleculeDisplay({ result, candidates, show }: CandidateMoleculeDisplayProps) {
  if (!result || !show) return null;

  const candidate = candidates.find((c) => c.id === result.moleculeId);
  if (!candidate) return null;

  const conf = candidate.conformations[result.bestConformationIndex];
  if (!conf) return null;

  const atomMap = new Map<number, Atom>();
  conf.atoms.forEach((a, i) => atomMap.set(i, a));
  
  const ELEMENT_COLORS: Record<string, string> = {
    C: '#808080', N: '#3333FF', O: '#FF3333', S: '#FFFF33', P: '#FFA500',
    F: '#00FF00', Cl: '#00FF00', Br: '#8B4513', I: '#9400D3', H: '#FFFFFF',
  };

  return (
    <group name="candidate-molecule">
      {conf.atoms.map((atom: Atom, idx: number) => {
        if (atom.isHydrogen) return null;
        const color = ELEMENT_COLORS[atom.element] || '#9400D3';
        const rgb = hexToRgb(color);
        const radius = atom.element === 'C' ? 0.25 : 0.2;
        return (
          <mesh
            key={`atom-${idx}`}
            position={[atom.x, atom.y, atom.z]}
          >
            <sphereGeometry args={[radius, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color(rgb.r, rgb.g, rgb.b)} />
          </mesh>
        );
      })}

      {conf.bonds.map((bond: Bond, idx: number) => {
        const a1 = atomMap.get(bond.atom1);
        const a2 = atomMap.get(bond.atom2);
        if (!a1 || !a2 || a1.isHydrogen || a2.isHydrogen) return null;

        const midX = (a1.x + a2.x) / 2;
        const midY = (a1.y + a2.y) / 2;
        const midZ = (a1.z + a2.z) / 2;
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dz = a2.z - a1.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const order = bond.order;

        const bondRadius = 0.08;

        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(dx, dy, dz).normalize()
        );

        if (order === 1) {
          return (
            <mesh key={`bond-${idx}`} position={[midX, midY, midZ]}>
              <cylinderGeometry args={[bondRadius, bondRadius, length, 8]} />
              <meshStandardMaterial color="#666666" />
              <quaternion
                attach="quaternion"
                args={[...quaternion.toArray()]}
              />
            </mesh>
          );
        }

        if (order === 2) {
          const offset1 = new THREE.Vector3(0, 0.08, 0).applyQuaternion(quaternion.clone().invert());
          const offset2 = new THREE.Vector3(0, -0.08, 0).applyQuaternion(quaternion.clone().invert());
          return (
            <group key={`bond-${idx}`}>
              <mesh position={[midX + offset1.x, midY + offset1.y, midZ + offset1.z]}>
                <cylinderGeometry args={[bondRadius * 0.6, bondRadius * 0.6, length, 6]} />
                <meshStandardMaterial color="#666666" />
                <quaternion
                  attach="quaternion"
                  args={[...quaternion.toArray()]}
                />
              </mesh>
              <mesh position={[midX + offset2.x, midY + offset2.y, midZ + offset2.z]}>
                <cylinderGeometry args={[bondRadius * 0.6, bondRadius * 0.6, length, 6]} />
                <meshStandardMaterial color="#666666" />
                <quaternion
                  attach="quaternion"
                  args={[...quaternion.toArray()]}
                />
              </mesh>
            </group>
          );
        }

        return (
          <mesh key={`bond-${idx}`} position={[midX, midY, midZ]}>
            <cylinderGeometry args={[bondRadius, bondRadius, length, 8]} />
            <meshStandardMaterial color="#666666" />
            <quaternion
              attach="quaternion"
              args={[...quaternion.toArray()]}
            />
          </mesh>
        );
      })}
    </group>
  );
}
