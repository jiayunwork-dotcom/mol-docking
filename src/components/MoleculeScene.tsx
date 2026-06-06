import { useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMolStore } from '../store/molStore';
import { ProteinCartoon } from './ProteinCartoon';
import { ProteinWireframe } from './ProteinWireframe';
import { MolecularSurface, PocketSurface } from './MolecularSurface';
import { LigandSticks } from './LigandSticks';
import { InteractionLines } from './InteractionLines';
import { MeasurementAnnotations, SelectedAtomsHighlighter } from './MeasurementAnnotations';
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
  } = useMolStore();

  const { camera, raycaster, gl, scene } = useThree();
  const textLabelsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleClick = useCallback(() => {
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
  }, [measurementMode, raycaster, scene.children, camera, setCameraTarget, selectAtom]);

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

  useFrame(() => {
    const container = gl.domElement.parentElement;
    if (container && container.parentElement) {
      const labelsContainer = container.parentElement.querySelector('[data-labels]') as HTMLDivElement | null;
      if (labelsContainer) {
        measurements.forEach((meas) => {
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
          label.textContent = formatMeasurement(meas);
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
        target={[cameraTarget.x, cameraTarget.y, cameraTarget.z]}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
      />

      {protein && proteinRepresentation === 'cartoon' && (
        <ProteinCartoon protein={protein} visibleChains={visibleChains} />
      )}

      {protein && proteinRepresentation === 'wireframe' && (
        <ProteinWireframe protein={protein} visibleChains={visibleChains} />
      )}

      {protein && proteinRepresentation === 'surface' && (
        <MolecularSurface
          protein={protein}
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
