import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import type { Protein, Residue, SurfaceColoring } from '../types';
import { generateSurface, colorSurface, adjustResolutionForPerformance } from '../analysis/surfaceGenerator';

interface MolecularSurfaceProps {
  protein: Protein;
  pocketResidues: Residue[];
  visibleChains: Set<string>;
  coloring: SurfaceColoring;
  opacity: number;
  resolution: number;
  showPocketOnly?: boolean;
}

export function MolecularSurface({
  protein,
  pocketResidues,
  visibleChains,
  coloring,
  opacity,
  resolution,
  showPocketOnly = false,
}: MolecularSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [, setIsGenerating] = useState(false);
  const [surfaceData, setSurfaceData] = useState<{
    geometry: THREE.BufferGeometry;
    material: THREE.MeshStandardMaterial;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      setIsGenerating(true);

      try {
        await new Promise(resolve => setTimeout(resolve, 0));

        const relevantAtoms: typeof protein.atoms = [];
        if (showPocketOnly) {
          for (const res of pocketResidues) {
            if (!res.isMissing && visibleChains.has(res.chainId)) {
              relevantAtoms.push(...res.atoms);
            }
          }
        } else {
          for (const chain of protein.chains.values()) {
            if (visibleChains.has(chain.id)) {
              for (const res of chain.residues) {
                if (!res.isMissing) {
                  relevantAtoms.push(...res.atoms);
                }
              }
            }
          }
        }

        if (relevantAtoms.length === 0) {
          setSurfaceData(null);
          setIsGenerating(false);
          return;
        }

        const { resolution: adjustedRes } = adjustResolutionForPerformance(
          relevantAtoms,
          resolution,
          500000
        );

        const { mesh, points } = generateSurface(relevantAtoms, adjustedRes, 1.4);

        if (cancelled) return;

        const colors = colorSurface(points, relevantAtoms, pocketResidues, coloring, 10.0);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
        geometry.setIndex(new THREE.Uint32BufferAttribute(mesh.indices, 1));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          transparent: opacity < 100,
          opacity: opacity / 100,
          roughness: 0.5,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });

        if (cancelled) return;
        setSurfaceData({ geometry, material });
      } catch (e) {
        console.error('Failed to generate surface:', e);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [protein, pocketResidues, visibleChains, coloring, opacity, resolution, showPocketOnly]);

  if (!surfaceData) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={surfaceData.geometry}
      material={surfaceData.material}
      userData={{ type: 'surface', isClickable: false }}
    />
  );
}

export function PocketSurface({
  pocketResidues,
  opacity = 30,
}: {
  pocketResidues: Residue[];
  opacity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const surface = useMemo(() => {
    const atoms: { x: number; y: number; z: number; vdwRadius: number }[] = [];
    for (const res of pocketResidues) {
      if (!res.isMissing) {
        for (const atom of res.atoms) {
          atoms.push({
            x: atom.x,
            y: atom.y,
            z: atom.z,
            vdwRadius: atom.vdwRadius,
          });
        }
      }
    }

    if (atoms.length === 0) return null;

    const { mesh } = generateSurface(atoms as any, 1.0, 1.4);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
    geometry.setIndex(new THREE.Uint32BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: opacity / 100,
      wireframe: true,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    return { geometry, material };
  }, [pocketResidues, opacity]);

  if (!surface) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={surface.geometry}
      material={surface.material}
      userData={{ type: 'pocket', isClickable: false }}
    />
  );
}
