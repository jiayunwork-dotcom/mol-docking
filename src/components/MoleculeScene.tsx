import { useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMolStore } from '../store/molStore';
import { usePharmacophoreStore } from '../store/pharmacophoreStore';
import { ProteinCartoon } from './ProteinCartoon';
import { ProteinWireframe } from './ProteinWireframe';
import { MolecularSurface, PocketSurface } from './MolecularSurface';
import { LigandSticks } from './LigandSticks';
import { InteractionLines } from './InteractionLines';
import { MeasurementAnnotations, SelectedAtomsHighlighter } from './MeasurementAnnotations';
import { PharmacophoreFeatures, ExcludedVolumes, CandidateMoleculeDisplay } from './PharmacophoreFeatures';
import { formatMeasurement } from '../analysis/measurementTools';

export const CONFORMATION_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FFD700',
  '#FF4500', '#1E90FF', '#ADFF2F', '#FF1493', '#00FA9A',
];

function SceneContent() {
  const {
    protein,
    ligand,
    currentConformation,
    visibleConformations,
    proteinRepresentation,
    surfaceColoring,
    surfaceOpacity,
    surfaceResolution,
    wireframeHideHydrogens,
    visibleChains,
    interactions,
    pocketResidues,
    visibleInteractionTypes,
    measurements,
    selectedAtoms,
    measurementMode,
    selectAtom,
    setCameraTarget,
    cameraTarget,
    flyToTarget,
    flyToDistance,
    clipDistance,
    showOnlyNearbyResidues,
  } = useMolStore();

  const {
    model,
    showFeatures,
    showExcludedVolumes,
    showCandidateMolecule,
    manualAddMode,
    addingFeatureType,
    addFeature,
    addExcludedVolume,
    setManualAddMode,
    selectedResult,
    candidateMolecules,
  } = usePharmacophoreStore();

  const { camera, raycaster, gl, scene } = useThree();
  const controlsRef = useRef<any>(null);
  const textLabelsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const animationRef = useRef<{
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null>(null);

  const { filteredProtein } = useMemo(() => {
    let center = { x: 0, y: 0, z: 0 };
    let filteredP = protein;

    if (ligand && showOnlyNearbyResidues && protein) {
      const conf = ligand.conformations[currentConformation];
      if (conf) {
        const ligCenter = conf.atoms.reduce(
          (acc, a) => ({ x: acc.x + a.x, y: acc.y + a.y, z: acc.z + a.z }),
          { x: 0, y: 0, z: 0 }
        );
        center = {
          x: ligCenter.x / conf.atoms.length,
          y: ligCenter.y / conf.atoms.length,
          z: ligCenter.z / conf.atoms.length,
        };

        const nearResidueIds = new Set<number>();
        protein.chains.forEach((chain) => {
          chain.residues.forEach((res) => {
            if (res.isMissing) return;
            for (const atom of res.atoms) {
              const dx = atom.x - center.x;
              const dy = atom.y - center.y;
              const dz = atom.z - center.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (dist <= 5) {
                nearResidueIds.add(res.id);
                break;
              }
            }
          });
        });

        const filteredAtoms = protein.atoms.filter((atom) => {
          const dx = atom.x - center.x;
          const dy = atom.y - center.y;
          const dz = atom.z - center.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return dist <= 5 || nearResidueIds.has(atom.residueId);
        });

        const filteredChains = new Map(protein.chains);
        filteredChains.forEach((chain, chainId) => {
          const filteredResidues = chain.residues.filter((r) => nearResidueIds.has(r.id));
          filteredChains.set(chainId, { ...chain, residues: filteredResidues });
        });

        filteredP = {
          ...protein,
          atoms: filteredAtoms,
          chains: filteredChains,
        };
      }
    } else if (clipDistance !== null && pocketResidues.length > 0) {
      const pocketAtoms = pocketResidues.flatMap((r) => r.atoms);
      if (pocketAtoms.length > 0) {
        const pCenter = pocketAtoms.reduce(
          (acc, a) => ({ x: acc.x + a.x, y: acc.y + a.y, z: acc.z + a.z }),
          { x: 0, y: 0, z: 0 }
        );
        center = {
          x: pCenter.x / pocketAtoms.length,
          y: pCenter.y / pocketAtoms.length,
          z: pCenter.z / pocketAtoms.length,
        };

        const filteredAtoms = protein?.atoms.filter((atom) => {
          const dx = atom.x - center.x;
          const dy = atom.y - center.y;
          const dz = atom.z - center.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return dist <= clipDistance;
        }) || [];

        if (protein) {
          const nearResidueIds = new Set<number>();
          filteredAtoms.forEach((a) => nearResidueIds.add(a.residueId));

          const filteredChains = new Map(protein.chains);
          filteredChains.forEach((chain, chainId) => {
            const filteredResidues = chain.residues.filter((r) => nearResidueIds.has(r.id));
            filteredChains.set(chainId, { ...chain, residues: filteredResidues });
          });

          filteredP = {
            ...protein,
            atoms: filteredAtoms,
            chains: filteredChains,
          };
        }
      }
    }

    return {
      filteredProtein: filteredP,
    };
  }, [protein, ligand, currentConformation, clipDistance, showOnlyNearbyResidues, pocketResidues]);

  const displayProtein = filteredProtein || protein;

  const handleClick = useCallback((event: any) => {
    if (manualAddMode !== 'none' && addingFeatureType !== null) {
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      const ndc = new THREE.Vector3(x, y, 0.5);
      ndc.unproject(camera);
      
      const dir = ndc.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      
      if (manualAddMode === 'feature') {
        addFeature({
          type: addingFeatureType,
          x: pos.x,
          y: pos.y,
          z: pos.z,
        });
      } else if (manualAddMode === 'excluded') {
        addExcludedVolume({
          x: pos.x,
          y: pos.y,
          z: pos.z,
        });
      }
      
      setManualAddMode('none');
      return;
    }

    if (measurementMode === 'none') {
      const intersects = raycaster.intersectObjects(scene.children, true);
      for (const hit of intersects) {
        if (hit.object.userData?.atom) {
          const atom = hit.object.userData.atom;
          camera.lookAt(atom.x, atom.y, atom.z);
          setCameraTarget({ x: atom.x, y: atom.y, z: atom.z });
          return;
        }
      }
    } else {
      const intersects = raycaster.intersectObjects(scene.children, true);
      for (const hit of intersects) {
        if (hit.object.userData?.atom) {
          const atom = hit.object.userData.atom;
          selectAtom(atom);
          return;
        }
      }
    }
  }, [
    manualAddMode,
    addingFeatureType,
    addFeature,
    addExcludedVolume,
    setManualAddMode,
    measurementMode,
    raycaster,
    scene.children,
    camera,
    gl.domElement,
    setCameraTarget,
    selectAtom,
  ]);

  const handleDoubleClick = useCallback(() => {
    const intersects = raycaster.intersectObjects(scene.children, true);
    for (const hit of intersects) {
      if (hit.object.userData?.atom) {
        const atom = hit.object.userData.atom;
        camera.lookAt(atom.x, atom.y, atom.z);
        setCameraTarget({ x: atom.x, y: atom.y, z: atom.z });
        return;
      }
    }
  }, [raycaster, scene.children, camera, setCameraTarget]);

  useEffect(() => {
    if (flyToTarget && controlsRef.current) {
      const target = new THREE.Vector3(flyToTarget.x, flyToTarget.y, flyToTarget.z);
      const direction = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(cameraTarget.x, cameraTarget.y, cameraTarget.z)).normalize();
      const distance = flyToDistance || direction.length();
      const newPos = target.clone().add(direction.multiplyScalar(distance));

      animationRef.current = {
        startPos: camera.position.clone(),
        startTarget: new THREE.Vector3(cameraTarget.x, cameraTarget.y, cameraTarget.z),
        endPos: newPos,
        endTarget: target,
        startTime: performance.now(),
        duration: 500,
      };
    }
  }, [flyToTarget, flyToDistance]);

  useFrame(() => {
    if (animationRef.current && controlsRef.current) {
      const { startPos, startTarget, endPos, endTarget, startTime, duration } = animationRef.current;
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      camera.position.lerpVectors(startPos, endPos, easeT);
      controlsRef.current.target.lerpVectors(startTarget, endTarget, easeT);
      setCameraTarget({ x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z });

      if (t >= 1) {
        animationRef.current = null;
        useMolStore.setState({ flyToTarget: null, flyToDistance: null });
      }
    }

    const container = gl.domElement.parentElement;
    if (container && container.parentElement) {
      const labelsContainer = container.parentElement.querySelector('[data-labels]') as HTMLDivElement | null;
      if (labelsContainer) {
        measurements.forEach((meas, measIdx) => {
          const key = meas.id;
          let label = textLabelsRef.current.get(key);
          if (!label) {
            label = document.createElement('div');
            label.style.position = 'absolute';
            label.style.padding = '4px 8px';
            label.style.background = 'rgba(0, 0, 0, 0.7)';
            label.style.color = 'white';
            label.style.borderRadius = '4px';
            label.style.fontSize = '12px';
            label.style.pointerEvents = 'none';
            label.style.transform = 'translate(-50%, -50%)';
            label.style.zIndex = '1000';
            labelsContainer.appendChild(label);
            textLabelsRef.current.set(key, label);
          }

          const pos = new THREE.Vector3(meas.position.x, meas.position.y, meas.position.z);
          pos.project(camera);
          const rect = container.getBoundingClientRect();
          label.style.left = `${(pos.x * 0.5 + 0.5) * rect.width}px`;
          label.style.top = `${(-pos.y * 0.5 + 0.5) * rect.height}px`;
          label.textContent = `#${measIdx + 1} ${formatMeasurement(meas)}`;
        });

        const toRemove: string[] = [];
        textLabelsRef.current.forEach((label, key) => {
          if (!measurements.find(m => m.id === key)) {
            label.remove();
            toRemove.push(key);
          }
        });
        toRemove.forEach(key => textLabelsRef.current.delete(key));
      }
    }
  });

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('dblclick', handleDoubleClick);
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [handleClick, handleDoubleClick, gl.domElement]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={0.5} />

      <OrbitControls
        ref={controlsRef}
        target={[cameraTarget.x, cameraTarget.y, cameraTarget.z]}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
      />

      {displayProtein && proteinRepresentation === 'cartoon' && (
        <ProteinCartoon protein={displayProtein} visibleChains={visibleChains} />
      )}

      {displayProtein && proteinRepresentation === 'wireframe' && (
        <ProteinWireframe protein={displayProtein} visibleChains={visibleChains} hideHydrogens={wireframeHideHydrogens} />
      )}

      {displayProtein && proteinRepresentation === 'surface' && (
        <MolecularSurface
          protein={displayProtein}
          pocketResidues={pocketResidues}
          visibleChains={visibleChains}
          coloring={surfaceColoring}
          opacity={surfaceOpacity}
          resolution={surfaceResolution}
        />
      )}

      {ligand && visibleConformations.map((confIdx) => {
        const conf = ligand.conformations[confIdx];
        if (!conf) return null;
        const isCurrent = confIdx === currentConformation;
        return (
          <group key={confIdx}>
            <LigandSticks
              conformation={conf}
              opacity={isCurrent ? 1 : 0.6}
            />
            {!isCurrent && (
              <mesh>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color={CONFORMATION_COLORS[confIdx % CONFORMATION_COLORS.length]} transparent opacity={0.8} />
              </mesh>
            )}
          </group>
        );
      })}

      {pocketResidues.length > 0 && (
        <PocketSurface pocketResidues={pocketResidues} opacity={30} />
      )}

      {interactions.length > 0 && (
        <InteractionLines
          interactions={interactions}
          visibleTypes={visibleInteractionTypes}
        />
      )}

      {measurements.length > 0 && (
        <MeasurementAnnotations
          measurements={measurements}
          onRemove={() => {}}
        />
      )}

      {selectedAtoms.length > 0 && (
        <SelectedAtomsHighlighter selectedAtoms={selectedAtoms} />
      )}

      {model && (
        <>
          <PharmacophoreFeatures
            features={model.features}
            showFeatures={showFeatures}
            selectedResult={selectedResult}
            showCandidateMolecule={showCandidateMolecule}
          />
          <ExcludedVolumes
            volumes={model.excludedVolumes}
            showExcludedVolumes={showExcludedVolumes}
          />
          {selectedResult && (
            <CandidateMoleculeDisplay
              result={selectedResult}
              candidates={candidateMolecules}
              show={showCandidateMolecule}
            />
          )}
        </>
      )}

      <primitive object={new THREE.AxesHelper(2)} position={[-20, -20, -20]} />
    </>
  );
}

interface MoleculeSceneProps {
  width: number;
  height: number;
}

export function MoleculeScene({ width, height }: MoleculeSceneProps) {
  const labelsContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ position: 'relative', width, height }}>
      <Canvas
        camera={{ position: [30, 30, 30], fov: 45 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ background: '#1a1a2e' }}
      >
        <SceneContent />
      </Canvas>
      <div ref={labelsContainerRef} data-labels style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
}
