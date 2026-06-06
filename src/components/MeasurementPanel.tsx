import { useMolStore } from '../store/molStore';
import { formatMeasurement } from '../analysis/measurementTools';
import type { Atom } from '../types';

function getAtomsCenter(atoms: Atom[]): { x: number; y: number; z: number } {
  if (atoms.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = atoms.reduce(
    (acc, atom) => ({
      x: acc.x + atom.x,
      y: acc.y + atom.y,
      z: acc.z + atom.z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / atoms.length,
    y: sum.y / atoms.length,
    z: sum.z / atoms.length,
  };
}

export function MeasurementPanel() {
  const {
    measurementMode,
    setMeasurementMode,
    measurements,
    removeMeasurement,
    clearMeasurements,
    selectedAtoms,
    clearSelectedAtoms,
    flyTo,
  } = useMolStore();

  const modeInfo = {
    none: { label: '浏览', desc: '点击查看', required: 0 },
    distance: { label: '距离', desc: '选择2个原子', required: 2 },
    angle: { label: '角度', desc: '选择3个原子', required: 3 },
    dihedral: { label: '二面角', desc: '选择4个原子', required: 4 },
  };

  const currentMode = modeInfo[measurementMode];

  const handleJumpToMeasurement = (meas: typeof measurements[0]) => {
    const center = getAtomsCenter(meas.atoms);
    flyTo(center, 10);
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">测量工具</h3>

      <div className="mb-3">
        <label className="block text-white text-sm mb-2">测量模式</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(modeInfo) as Array<keyof typeof modeInfo>).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setMeasurementMode(mode);
                clearSelectedAtoms();
              }}
              className={`px-2 py-2 rounded text-sm font-medium transition-colors
                ${measurementMode === mode
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              {modeInfo[mode].label}
            </button>
          ))}
        </div>
      </div>

      {measurementMode !== 'none' && (
        <div className="bg-gray-700 p-2 rounded mb-3">
          <div className="text-white text-sm">
            {currentMode.desc}
            <span className="ml-2">
              (已选 {selectedAtoms.length}/{currentMode.required})
            </span>
          </div>
          {selectedAtoms.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {selectedAtoms.map((atom, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-yellow-600 text-white text-xs rounded"
                >
                  {atom.atomName} ({atom.element})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {measurements.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-2">
            <span className="text-white text-sm">
              已保存测量: {measurements.length} 个
            </span>
            <button
              onClick={clearMeasurements}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
            >
              清除全部
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {measurements.map((meas, idx) => (
              <div
                key={meas.id}
                className="flex items-center justify-between bg-gray-700 p-2 rounded text-sm"
              >
                <span className="text-white">
                  <span className="text-blue-400 font-mono mr-2">#{idx + 1}</span>
                  {formatMeasurement(meas)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleJumpToMeasurement(meas)}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                    title="跳转到该测量"
                  >
                    跳转
                  </button>
                  <button
                    onClick={() => removeMeasurement(meas.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                    title="删除"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
