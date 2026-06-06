import { useMolStore } from '../store/molStore';
import { formatMeasurement } from '../analysis/measurementTools';

export function MeasurementPanel() {
  const {
    measurementMode,
    setMeasurementMode,
    measurements,
    removeMeasurement,
    clearMeasurements,
    selectedAtoms,
    clearSelectedAtoms,
  } = useMolStore();

  const modeInfo = {
    none: { label: '浏览', desc: '点击查看', required: 0 },
    distance: { label: '距离', desc: '选择2个原子', required: 2 },
    angle: { label: '角度', desc: '选择3个原子', required: 3 },
    dihedral: { label: '二面角', desc: '选择4个原子', required: 4 },
  };

  const currentMode = modeInfo[measurementMode];

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
          <div className="text-white text-sm mb-2">
            已保存测量: {measurements.length} 个
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {measurements.map((meas) => (
              <div
                key={meas.id}
                className="flex items-center justify-between bg-gray-700 p-2 rounded text-sm"
              >
                <span className="text-white">{formatMeasurement(meas)}</span>
                <button
                  onClick={() => removeMeasurement(meas.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={clearMeasurements}
            className="w-full mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            清除所有测量
          </button>
        </>
      )}
    </div>
  );
}
