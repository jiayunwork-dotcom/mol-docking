import { useMolStore } from '../store/molStore';

export function RenderControlPanel() {
  const {
    protein,
    proteinRepresentation,
    setProteinRepresentation,
    surfaceColoring,
    setSurfaceColoring,
    surfaceOpacity,
    setSurfaceOpacity,
    surfaceResolution,
    setSurfaceResolution,
    visibleChains,
    toggleChain,
  } = useMolStore();

  const chains = protein ? Array.from(protein.chains.keys()) : [];
  const chainResidueCounts = protein ? Array.from(protein.chains.values()).map(c => c.residues.length) : [];

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">渲染设置</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-white text-sm mb-2">蛋白质表示模式</label>
          <div className="grid grid-cols-3 gap-2">
            {(['cartoon', 'surface', 'wireframe'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setProteinRepresentation(mode)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors
                  ${proteinRepresentation === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                {mode === 'cartoon' ? '卡通' : mode === 'surface' ? '表面' : '线框'}
              </button>
            ))}
          </div>
        </div>

        {proteinRepresentation === 'surface' && (
          <>
            <div>
              <label className="block text-white text-sm mb-2">表面着色方式</label>
              <div className="grid grid-cols-3 gap-2">
                {(['electrostatic', 'hydrophobic', 'hbond'] as const).map((coloring) => (
                  <button
                    key={coloring}
                    onClick={() => setSurfaceColoring(coloring)}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors
                      ${surfaceColoring === coloring
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                  >
                    {coloring === 'electrostatic' ? '静电势' : coloring === 'hydrophobic' ? '疏水性' : '氢键'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white text-sm mb-2">
                透明度: {surfaceOpacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={surfaceOpacity}
                onChange={(e) => setSurfaceOpacity(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-white text-sm mb-2">
                分辨率: {surfaceResolution.toFixed(1)}Å
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={surfaceResolution}
                onChange={(e) => setSurfaceResolution(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>精细 0.5</span>
                <span>粗糙 2.0</span>
              </div>
            </div>
          </>
        )}

        {chains.length > 0 && (
          <div>
            <label className="block text-white text-sm mb-2">链显示选择</label>
            <div className="flex flex-wrap gap-2">
              {chains.map((chainId, idx) => (
                <button
                  key={chainId}
                  onClick={() => toggleChain(chainId)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors
                    ${visibleChains.has(chainId)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  {chainId} ({chainResidueCounts[idx]})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
