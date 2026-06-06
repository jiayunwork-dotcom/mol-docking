import { useState, useRef, useEffect, useMemo } from 'react';
import { useMolStore } from '../store/molStore';
import { generateRMSDMatrix, getRMSDHeatmapColor } from '../analysis/rmsdCalculator';
import { CONFORMATION_COLORS } from './MoleculeScene';

export function ConformationPanel() {
  const {
    ligand,
    currentConformation,
    visibleConformations,
    setCurrentConformation,
    toggleConformationVisibility,
  } = useMolStore();

  const listRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const sortedConformations = ligand
    ? [...ligand.conformations]
        .map((conf, idx) => ({ conf, idx }))
        .sort((a, b) => a.conf.bindingEnergy - b.conf.bindingEnergy)
    : [];

  const rmsdMatrix = ligand && visibleConformations.length > 1
    ? generateRMSDMatrix(
        visibleConformations.map((idx) => ligand.conformations[idx])
      )
    : null;

  const selectionStats = useMemo(() => {
    if (visibleConformations.length === 0) return null;
    const selectedConfs = visibleConformations.map(
      (idx) => ligand?.conformations[idx]
    ).filter(Boolean);
    if (selectedConfs.length === 0) return null;
    const avgEnergy = selectedConfs.reduce(
      (sum, conf) => sum + conf!.bindingEnergy,
      0
    ) / selectedConfs.length;
    return {
      count: selectedConfs.length,
      avgEnergy,
    };
  }, [visibleConformations, ligand]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focused || !ligand) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextIdx = Math.max(0, currentConformation - 1);
        setCurrentConformation(nextIdx);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = Math.min(ligand.conformations.length - 1, currentConformation + 1);
        setCurrentConformation(nextIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focused, currentConformation, ligand, setCurrentConformation]);

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">配体构象</h3>

      {!ligand ? (
        <div className="text-gray-400 text-sm text-center py-4">
          请上传配体文件
        </div>
      ) : (
        <>
          {selectionStats && selectionStats.count > 1 && (
            <div className="bg-blue-900 bg-opacity-50 p-2 rounded mb-3 text-sm">
              <span className="text-blue-300">已选 {selectionStats.count} 个构象</span>
              <span className="text-gray-400 ml-3">平均结合能: </span>
              <span className="text-white font-mono">{selectionStats.avgEnergy.toFixed(2)}</span>
            </div>
          )}

          <div className="text-white text-sm mb-3">
            共 {ligand.conformations.length} 个构象，已显示 {visibleConformations.length} 个
          </div>

          <div
            ref={listRef}
            tabIndex={0}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`max-h-48 overflow-y-auto mb-4 outline-none ${focused ? 'ring-2 ring-blue-500 rounded' : ''}`}
          >
            <table className="w-full text-sm">
              <thead className="text-gray-400 border-b border-gray-700 sticky top-0 bg-gray-800">
                <tr>
                  <th className="text-left py-2">#</th>
                  <th className="text-right py-2">结合能</th>
                  <th className="text-right py-2">RMSD</th>
                </tr>
              </thead>
              <tbody>
                {sortedConformations.map(({ conf, idx }) => (
                  <tr
                    key={idx}
                    onClick={() => setCurrentConformation(idx)}
                    className={`border-b border-gray-700 cursor-pointer transition-colors
                      ${currentConformation === idx
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-700'
                      }`}
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={visibleConformations.includes(idx)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleConformationVisibility(idx);
                        }}
                        className="mr-2"
                      />
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: CONFORMATION_COLORS[idx % CONFORMATION_COLORS.length] }}
                      />
                      {idx + 1}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {conf.bindingEnergy.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {conf.rmsd !== null ? `${conf.rmsd.toFixed(2)}Å` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {focused && (
            <div className="text-xs text-gray-500 mb-3">
              使用 ↑↓ 键切换构象
            </div>
          )}

          {rmsdMatrix && rmsdMatrix.matrix.length > 1 && (
            <div>
              <label className="block text-white text-sm mb-2">
                RMSD矩阵 (重原子)
              </label>
              <div
                className="grid gap-1 mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${rmsdMatrix.matrix.length}, minmax(0, 1fr))`,
                  maxWidth: `${rmsdMatrix.matrix.length * 32 + 16}px`,
                }}
              >
                {rmsdMatrix.matrix.map((row, i) =>
                  row.map((val, j) => {
                    const color = val !== null ? getRMSDHeatmapColor(val, rmsdMatrix.max) : '#4B5563';
                    return (
                      <div
                        key={`${i}_${j}`}
                        className="w-8 h-8 flex items-center justify-center text-xs font-mono rounded"
                        style={{
                          backgroundColor: color,
                          color: val !== null && val < rmsdMatrix.max * 0.5 ? '#000' : '#fff',
                        }}
                        title={`构象${visibleConformations[i] + 1} - 构象${visibleConformations[j] + 1}: ${val !== null ? val.toFixed(2) + 'Å' : 'N/A'}`}
                      >
                        {val !== null ? val.toFixed(1) : '-'}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
