import { useState, useCallback } from 'react';
import { useMolStore } from '../store/molStore';
import { usePharmacophoreStore } from '../store/pharmacophoreStore';
import { extractPharmacophoreFeatures, generateExcludedVolumes, validateModelForScreening } from '../analysis/pharmacophoreExtractor';
import type { PharmacophoreFeatureType, PharmacophoreFeature, ExcludedVolume } from '../types';
import { PHARMACOPHORE_COLORS, PHARMACOPHORE_ICONS, PHARMACOPHORE_LABELS } from '../types';

export function PharmacophoreEditor() {
  const { protein, ligand, currentConformation } = useMolStore();
  const {
    model,
    createModel,
    addFeature,
    updateFeature,
    removeFeature,
    clearFeatures,
    addExcludedVolume,
    updateExcludedVolume,
    removeExcludedVolume,
    clearExcludedVolumes,
    showFeatures,
    showExcludedVolumes,
    setShowFeatures,
    setShowExcludedVolumes,
    setManualAddMode,
    setAddingFeatureType,
    manualAddMode,
    addingFeatureType,
    setOptionalMatchConfig,
  } = usePharmacophoreStore();

  const [editingRadius, setEditingRadius] = useState<string | null>(null);
  const [radiusValue, setRadiusValue] = useState<number>(1.5);

  const handleExtractFeatures = useCallback(() => {
    if (!ligand || !protein) {
      alert('请先加载蛋白质和配体文件');
      return;
    }

    const conf = ligand.conformations[currentConformation];
    if (!conf) return;

    if (!model) {
      createModel(`${ligand.name}_pharmacophore`);
    }

    const features = extractPharmacophoreFeatures(conf);
    const volumes = generateExcludedVolumes(protein, conf);

    if (model) {
      features.forEach((f) => {
        addFeature({
          type: f.type,
          x: f.x,
          y: f.y,
          z: f.z,
          radius: f.radius,
          isRequired: true,
          normal: f.normal,
        });
      });

      volumes.forEach((v) => {
        addExcludedVolume({
          x: v.x,
          y: v.y,
          z: v.z,
          radius: v.radius,
        });
      });
    }

    const validation = validateModelForScreening([...(model?.features || []), ...features]);
    if (!validation.valid) {
      alert(validation.message);
    }
  }, [ligand, protein, currentConformation, model, createModel, addFeature, addExcludedVolume]);

  const handleStartAddFeature = (type: PharmacophoreFeatureType) => {
    setManualAddMode('feature');
    setAddingFeatureType(type);
  };

  const handleStartAddExcluded = () => {
    setManualAddMode('excluded');
    setAddingFeatureType(null);
  };

  const handleCancelAdd = () => {
    setManualAddMode('none');
    setAddingFeatureType(null);
  };

  const handleToggleRequired = (feature: PharmacophoreFeature) => {
    updateFeature(feature.id, { isRequired: !feature.isRequired });
  };

  const handleRadiusChangeStart = (feature: PharmacophoreFeature) => {
    setEditingRadius(feature.id);
    setRadiusValue(feature.radius);
  };

  const handleRadiusChange = (value: number) => {
    if (!editingRadius) return;
    const clamped = Math.max(0.5, Math.min(5.0, value));
    setRadiusValue(clamped);
    updateFeature(editingRadius, { radius: clamped });
  };

  const handleRadiusChangeEnd = () => {
    setEditingRadius(null);
  };

  const handleVolumeRadiusChange = (volume: ExcludedVolume, value: number) => {
    const clamped = Math.max(0.5, Math.min(5.0, value));
    updateExcludedVolume(volume.id, { radius: clamped });
  };

  const featureTypes: PharmacophoreFeatureType[] = [
    'hydrogen_bond_donor',
    'hydrogen_bond_acceptor',
    'positive_charge',
    'negative_charge',
    'hydrophobic',
    'aromatic_ring',
  ];

  const requiredCount = model?.features.filter(f => f.isRequired).length || 0;
  const optionalCount = model?.features.filter(f => !f.isRequired).length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">药效团模型编辑器</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className={`px-2 py-1 text-xs rounded ${showFeatures ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
          >
            特征
          </button>
          <button
            onClick={() => setShowExcludedVolumes(!showExcludedVolumes)}
            className={`px-2 py-1 text-xs rounded ${showExcludedVolumes ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
          >
            排除体积
          </button>
        </div>
      </div>

      {manualAddMode !== 'none' && (
        <div className="bg-yellow-900 bg-opacity-50 border border-yellow-700 rounded-lg p-3">
          <p className="text-yellow-300 text-sm mb-2">
            {manualAddMode === 'feature'
              ? `点击3D场景添加 ${PHARMACOPHORE_LABELS[addingFeatureType!]} 特征点`
              : '点击3D场景添加排除体积球'}
          </p>
          <button
            onClick={handleCancelAdd}
            className="w-full py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm"
          >
            取消添加
          </button>
        </div>
      )}

      <button
        onClick={handleExtractFeatures}
        disabled={!protein || !ligand}
        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
      >
        🔬 自动提取药效团特征
      </button>

      <div className="bg-gray-700 rounded-lg p-3">
        <p className="text-gray-300 text-sm mb-2 font-medium">手动添加特征点</p>
        <div className="grid grid-cols-2 gap-1">
          {featureTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleStartAddFeature(type)}
              disabled={manualAddMode !== 'none'}
              className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-xs text-gray-200 transition-colors"
              style={{ borderLeft: `3px solid ${PHARMACOPHORE_COLORS[type]}` }}
            >
              <span>{PHARMACOPHORE_ICONS[type]}</span>
              <span>{PHARMACOPHORE_LABELS[type]}</span>
            </button>
          ))}
        </div>
        <button
          onClick={handleStartAddExcluded}
          disabled={manualAddMode !== 'none'}
          className="w-full mt-2 px-2 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-xs text-gray-200 transition-colors"
        >
          ⚪ 添加排除体积球
        </button>
      </div>

      {model && (
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-300 text-sm font-medium">可选匹配配置</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">至少匹配</label>
              <input
                type="number"
                min="0"
                max={optionalCount}
                value={model.minOptionalMatch}
                onChange={(e) => setOptionalMatchConfig(parseInt(e.target.value) || 0, model.maxOptionalMatch)}
                className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">最多匹配</label>
              <input
                type="number"
                min={model.minOptionalMatch}
                max={optionalCount}
                value={model.maxOptionalMatch}
                onChange={(e) => setOptionalMatchConfig(model.minOptionalMatch, parseInt(e.target.value) || 100)}
                className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm text-white"
              />
            </div>
          </div>
        </div>
      )}

      {model && model.features.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-300 text-sm font-medium">
              特征点 ({requiredCount}必须 / {optionalCount}可选)
            </p>
            <button
              onClick={clearFeatures}
              className="text-xs text-red-400 hover:text-red-300"
            >
              清空全部
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {model.features.map((feature, idx) => (
              <div
                key={feature.id}
                className="bg-gray-600 rounded p-2"
                style={{ borderLeft: `3px solid ${PHARMACOPHORE_COLORS[feature.type]}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{PHARMACOPHORE_ICONS[feature.type]}</span>
                    <div>
                      <p className="text-xs text-gray-200 font-medium">
                        #{idx + 1} {PHARMACOPHORE_LABELS[feature.type]}
                      </p>
                      <p className="text-xs text-gray-400">
                        ({feature.x.toFixed(1)}, {feature.y.toFixed(1)}, {feature.z.toFixed(1)})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleRequired(feature)}
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        feature.isRequired
                          ? 'bg-red-600 text-white'
                          : 'bg-yellow-600 text-white'
                      }`}
                      title={feature.isRequired ? '必须匹配' : '可选匹配'}
                    >
                      {feature.isRequired ? '必' : '选'}
                    </button>
                    <button
                      onClick={() => removeFeature(feature.id)}
                      className="px-1.5 py-0.5 bg-red-800 hover:bg-red-700 text-white rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 flex-shrink-0">半径:</label>
                  {editingRadius === feature.id ? (
                    <>
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.1"
                        value={radiusValue}
                        onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
                        onMouseUp={handleRadiusChangeEnd}
                        onTouchEnd={handleRadiusChangeEnd}
                        className="flex-1 h-2 bg-gray-500 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-300 w-10 text-right">
                        {radiusValue.toFixed(1)}Å
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRadiusChangeStart(feature)}
                        className="flex-1 h-2 bg-gray-500 rounded cursor-pointer hover:bg-gray-400"
                        style={{
                          background: `linear-gradient(to right, ${PHARMACOPHORE_COLORS[feature.type]} ${((feature.radius - 0.5) / 4.5) * 100}%, #6b7280 ${((feature.radius - 0.5) / 4.5) * 100}%)`,
                        }}
                      />
                      <span className="text-xs text-gray-300 w-10 text-right">
                        {feature.radius.toFixed(1)}Å
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {model && model.excludedVolumes.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-300 text-sm font-medium">
              排除体积 ({model.excludedVolumes.length}个)
            </p>
            <button
              onClick={clearExcludedVolumes}
              className="text-xs text-red-400 hover:text-red-300"
            >
              清空全部
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {model.excludedVolumes.map((volume, idx) => (
              <div
                key={volume.id}
                className="bg-gray-600 rounded p-2 border-l-3 border-gray-500"
                style={{ borderLeft: '3px solid #6b7280' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-xs text-gray-200 font-medium">
                      排除体积 #{idx + 1}
                    </p>
                    <p className="text-xs text-gray-400">
                      ({volume.x.toFixed(1)}, {volume.y.toFixed(1)}, {volume.z.toFixed(1)})
                    </p>
                  </div>
                  <button
                    onClick={() => removeExcludedVolume(volume.id)}
                    className="px-1.5 py-0.5 bg-red-800 hover:bg-red-700 text-white rounded text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 flex-shrink-0">半径:</label>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={volume.radius}
                    onChange={(e) => handleVolumeRadiusChange(volume, parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-500 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-300 w-10 text-right">
                    {volume.radius.toFixed(1)}Å
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!model && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">🧬</div>
          <p className="text-sm">点击上方按钮提取药效团特征</p>
          <p className="text-xs mt-1">或手动添加特征点</p>
        </div>
      )}

      {model && model.features.length === 0 && (
        <div className="text-center py-4 text-gray-400">
          <p className="text-sm">暂无特征点</p>
          <p className="text-xs mt-1">请提取特征或手动添加</p>
        </div>
      )}
    </div>
  );
}
