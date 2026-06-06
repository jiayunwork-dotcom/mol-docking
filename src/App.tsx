import { useState, useEffect } from 'react';
import { MoleculeScene } from './components/MoleculeScene';
import { FileUploadPanel } from './components/FileUploadPanel';
import { RenderControlPanel } from './components/RenderControlPanel';
import { InteractionPanel } from './components/InteractionPanel';
import { ConformationPanel } from './components/ConformationPanel';
import { Interaction2DView } from './components/Interaction2DView';
import { MeasurementPanel } from './components/MeasurementPanel';
import { ExportPanel } from './components/ExportPanel';
import { useMolStore } from './store/molStore';

function App() {
  const { loading, protein, ligand } = useMolStore();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [activeTab, setActiveTab] = useState<'render' | 'interactions' | 'conformations' | '2dview' | 'measure' | 'export'>('render');

  useEffect(() => {
    const updateDimensions = () => {
      const mainArea = document.getElementById('main-area');
      if (mainArea) {
        setDimensions({
          width: mainArea.clientWidth,
          height: mainArea.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const tabs = [
    { id: 'render', label: '渲染', icon: '🎨' },
    { id: 'interactions', label: '相互作用', icon: '🔗' },
    { id: 'conformations', label: '构象', icon: '🔬' },
    { id: '2dview', label: '2D图', icon: '📊' },
    { id: 'measure', label: '测量', icon: '📏' },
    { id: 'export', label: '导出', icon: '💾' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">🧬</span>
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">MolDock Viewer</h1>
              <p className="text-gray-400 text-sm">3D分子对接结果查看与分析工具</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {protein && (
              <span>蛋白质: {protein.filename} ({protein.numResidues}残基)</span>
            )}
            {ligand && (
              <span>配体: {ligand.filename} ({ligand.conformations.length}构象)</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 bg-gray-850 border-r border-gray-700 overflow-y-auto p-4 flex-shrink-0" style={{ backgroundColor: '#1f2937' }}>
          <FileUploadPanel />

          <div className="flex flex-wrap gap-1 mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-2 py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab === 'render' && <RenderControlPanel />}
          {activeTab === 'interactions' && <InteractionPanel />}
          {activeTab === 'conformations' && <ConformationPanel />}
          {activeTab === '2dview' && <Interaction2DView />}
          {activeTab === 'measure' && <MeasurementPanel />}
          {activeTab === 'export' && <ExportPanel />}

          <div className="mt-4 p-3 bg-gray-700 rounded-lg text-xs text-gray-400">
            <p className="font-medium text-gray-300 mb-2">操作说明</p>
            <ul className="space-y-1">
              <li>• 左键拖动: 旋转视图</li>
              <li>• 滚轮: 缩放</li>
              <li>• 右键拖动: 平移</li>
              <li>• 双击原子: 居中显示</li>
              <li>• 测量模式下点击原子选择</li>
            </ul>
          </div>
        </div>

        <div
          id="main-area"
          className="flex-1 relative overflow-hidden"
        >
          {loading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 p-6 rounded-lg text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white">正在处理数据...</p>
              </div>
            </div>
          )}

          {!protein && !ligand ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🧬</div>
                <h2 className="text-white text-2xl font-bold mb-2">欢迎使用 MolDock Viewer</h2>
                <p className="text-gray-400 mb-6">请从左侧面板上传蛋白质和配体文件开始分析</p>
                <div className="flex gap-4 justify-center text-sm text-gray-500">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="text-2xl mb-2">📄</div>
                    <div>支持 PDB/mmCIF</div>
                    <div className="text-xs">蛋白质结构</div>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="text-2xl mb-2">⚛️</div>
                    <div>支持 SDF/MOL2</div>
                    <div className="text-xs">配体分子</div>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="text-2xl mb-2">🔍</div>
                    <div>相互作用分析</div>
                    <div className="text-xs">氢键/疏水/π-π等</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <MoleculeScene width={dimensions.width} height={dimensions.height} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
