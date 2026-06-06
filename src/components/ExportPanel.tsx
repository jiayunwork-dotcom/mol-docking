import { useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useMolStore } from '../store/molStore';
import { exportPNG, exportCSV, exportPyMOL } from '../utils/exporters';

export function ExportPanel() {
  const { protein, ligand, interactions, measurements } = useMolStore();
  const { camera } = useThree();
  const [exporting, setExporting] = useState(false);

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    setExporting(true);
    setTimeout(() => {
      exportPNG(canvas, 'molecular-view.png', measurements);
      setExporting(false);
    }, 100);
  };

  const handleExportCSV = () => {
    if (interactions.length === 0) {
      alert('没有可导出的相互作用数据');
      return;
    }
    exportCSV(interactions, 'interactions.csv');
  };

  const handleExportPyMOL = () => {
    if (!protein && !ligand) {
      alert('没有可导出的分子数据');
      return;
    }

    const cam = camera as unknown as THREE.PerspectiveCamera;
    exportPyMOL(protein, ligand, interactions, measurements, cam, 'scene.pml');
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">导出</h3>

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={handleExportPNG}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {exporting ? '导出中...' : '截图 (PNG)'}
        </button>

        <button
          onClick={handleExportCSV}
          disabled={interactions.length === 0}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          相互作用列表 (CSV)
        </button>

        <button
          onClick={handleExportPyMOL}
          disabled={!protein && !ligand}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          PyMOL脚本 (.pml)
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-400">
        <p>PNG截图包含当前视图和所有标注</p>
        <p>PyMOL脚本可复现当前视角和相互作用标注</p>
      </div>
    </div>
  );
}
