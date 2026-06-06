import { useState, useCallback, useMemo } from 'react';
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
    updateFeatureType,
    removeFeature,
    clearFeatures,
    addExcludedVolume,
    updateExcludedVolume,
    removeExcludedVolume,
    clearExcludedVolumes,
    addDistanceConstraint,
    removeDistanceConstraint,
    clearDistanceConstraints,
    showFeatures,
    showExcludedVolumes,
    setShowFeatures,
    setShowExcludedVolumes,
    setManualAddMode,
    setAddingFeatureType,
    manualAddMode,
    addingFeatureType,
    setOptionalMatchConfig,
    toggleFeatureSelection,
    clearFeatureSelection,
    selectedFeatureIds,
    saveModelVersion,
    restoreModelVersion,
    deleteModelVersion,
    compareVersions,
    setCompareVersion,
    modelVersions,
    currentVersion,
    compareVersion,
  } = usePharmacophoreStore();

  const [editingRadius, setEditingRadius] = useState<string | null>(null);
  const [radiusValue, setRadiusValue] = useState<number>(1.5);
  const [constraintMinDist, setConstraintMinDist] = useState<number>(2.0);
  const [constraintMaxDist, setConstraintMaxDist] = useState<number>(5.0);
  const [showVersionPanel, setShowVersionPanel] = useState<boolean>(false);
  const [versionDescription, setVersionDescription] = useState<string>('');
  const [editingType, setEditingType] = useState<string | null>(null);

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

  const versionDiff = useMemo(() => {
    if (compareVersion !== null && currentVersion !== null && compareVersion !== currentVersion) {
      return compareVersions(currentVersion, compareVersion);
    }
    return null;
  }, [compareVersion, currentVersion, compareVersions]);

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

  const handleAddConstraint = () => {
    if (selectedFeatureIds.length !== 2) {
      alert('请先选择两个特征点');
      return;
    }

    if (constraintMinDist >= constraintMaxDist) {
      alert('最小距离必须小于最大距离');
      return;
    }

    addDistanceConstraint(
      selectedFeatureIds[0],
      selectedFeatureIds[1],
      constraintMinDist,
      constraintMaxDist
    );
    clearFeatureSelection();
  };

  const handleSaveVersion = () => {
    saveModelVersion(versionDescription || undefined);
    setVersionDescription('');
  };

  const handleRestoreVersion = (version: number) => {
    restoreModelVersion(version);
    setCompareVersion(null);
  };

  const handleTypeChange = (featureId: string, newType: PharmacophoreFeatureType) => {
    updateFeatureType(featureId, newType);
    setEditingType(null);
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };



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
            <div className="flex gap-2">
              {selectedFeatureIds.length > 0 && (
                <button
                  onClick={clearFeatureSelection}
                  className="text-xs text-yellow-400 hover:text-yellow-300"
                >
                  取消选择
                </button>
              )}
              <button
                onClick={clearFeatures}
                className="text-xs text-red-400 hover:text-red-300"
              >
                清空全部
              </button>
            </div>
          </div>

          {selectedFeatureIds.length === 2 && (
            <div className="bg-gray-600 rounded-lg p-2 mb-2">
              <p className="text-xs text-gray-300 mb-2">已选择2个特征点，可添加距离约束</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">最小距离(Å)</label>
                  <input
                    type="number"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={constraintMinDist}
                    onChange={(e) => setConstraintMinDist(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-500 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">最大距离(Å)</label>
                  <input
                    type="number"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={constraintMaxDist}
                    onChange={(e) => setConstraintMaxDist(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-500 rounded text-sm text-white"
                  />
                </div>
              </div>
              <button
                onClick={handleAddConstraint}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium"
              >
                + 添加距离约束 ({constraintMinDist}-{constraintMaxDist}Å)
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {model.features.map((feature, idx) => {
              const isSelected = selectedFeatureIds.includes(feature.id);
              const isModified = versionDiff?.modified.some(m => m.new.id === feature.id);
              const isAdded = versionDiff?.added.some(a => a.id === feature.id);
              const isRemoved = versionDiff?.removed.some(r => r.id === feature.id);

              let borderColor = PHARMACOPHORE_COLORS[feature.type];
              if (isAdded) borderColor = '#22c55e';
              if (isRemoved) borderColor = '#ef4444';
              if (isModified) borderColor = '#eab308';

              return (
                <div
                  key={feature.id}
                  className={`bg-gray-600 rounded p-2 ${isSelected ? 'ring-2 ring-white' : ''}`}
                  style={{ borderLeft: `3px solid ${borderColor}` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFeatureSelection(feature.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
                          isSelected
                            ? 'bg-white text-gray-800 border-white'
                            : 'border-gray-400 hover:border-white'
                        }`}
                      >
                        {isSelected && '✓'}
                      </button>
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

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400 flex-shrink-0 w-12">类型:</label>
                      {editingType === feature.id ? (
                        <select
                          value={feature.type}
                          onChange={(e) => handleTypeChange(feature.id, e.target.value as PharmacophoreFeatureType)}
                          onBlur={() => setEditingType(null)}
                          className="flex-1 px-2 py-0.5 bg-gray-700 border border-gray-500 rounded text-xs text-white"
                          autoFocus
                        >
                          {featureTypes.map((type) => (
                            <option key={type} value={type}>
                              {PHARMACOPHORE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingType(feature.id)}
                          className="flex-1 text-left px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200"
                        >
                          {PHARMACOPHORE_LABELS[feature.type]}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400 flex-shrink-0 w-12">半径:</label>
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

                    {feature.originalRadius && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400 flex-shrink-0 w-12">原半径:</label>
                        <span className="text-xs text-yellow-400 flex-1">
                          {feature.originalRadius.toFixed(1)}Å
                          <button
                            onClick={() => updateFeature(feature.id, { radius: feature.originalRadius!, originalRadius: undefined })}
                            className="ml-2 px-1.5 py-0.5 bg-yellow-700 hover:bg-yellow-600 text-white rounded text-xs"
                          >
                            恢复
                          </button>
                        </span>
                      </div>
                    )}
                  </div>

                  {(isAdded || isRemoved || isModified) && (
                    <div className="mt-1 text-xs">
                      {isAdded && <span className="text-green-400">✓ 新增</span>}
                      {isRemoved && <span className="text-red-400">✗ 删除</span>}
                      {isModified && <span className="text-yellow-400">⚡ 修改</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {model && model.distanceConstraints.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-300 text-sm font-medium">
              距离约束 ({model.distanceConstraints.length} 条)
            </p>
            <button
              onClick={clearDistanceConstraints}
              className="text-xs text-red-400 hover:text-red-300"
            >
              清空全部
            </button>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {model.distanceConstraints.map((constraint) => {
              const featA = model.features.find((f) => f.id === constraint.featureIdA);
              const featB = model.features.find((f) => f.id === constraint.featureIdB);
              if (!featA || !featB) return null;

              return (
                <div
                  key={constraint.id}
                  className="bg-gray-600 rounded p-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span>{PHARMACOPHORE_ICONS[featA.type]}</span>
                    <span className="text-white text-xs">↔</span>
                    <span>{PHARMACOPHORE_ICONS[featB.type]}</span>
                    <span className="text-gray-300 text-xs">
                      {constraint.minDistance}-{constraint.maxDistance}Å
                    </span>
                  </div>
                  <button
                    onClick={() => removeDistanceConstraint(constraint.id)}
                    className="px-1.5 py-0.5 bg-red-800 hover:bg-red-700 text-white rounded text-xs"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
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

      {model && (
        <div className="bg-gray-700 rounded-lg p-3">
          <button
            onClick={() => setShowVersionPanel(!showVersionPanel)}
            className="w-full flex items-center justify-between text-left"
          >
            <p className="text-gray-300 text-sm font-medium">
              📋 版本管理 ({modelVersions.length} 个版本)
            </p>
            <span className="text-gray-400 text-sm">{showVersionPanel ? '▲' : '▼'}</span>
          </button>

          {showVersionPanel && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="版本描述（可选）"
                  value={versionDescription}
                  onChange={(e) => setVersionDescription(e.target.value)}
                  className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400"
                />
                <button
                  onClick={handleSaveVersion}
                  className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium"
                >
                  保存为新版本
                </button>
              </div>

              {modelVersions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">历史版本：</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {[...modelVersions].reverse().map((version) => (
                      <div
                        key={version.version}
                        className={`bg-gray-600 rounded p-2 ${
                          currentVersion === version.version ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white font-medium">
                            {version.name}
                            {currentVersion === version.version && (
                              <span className="ml-2 text-blue-400">(当前)</span>
                            )}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDateTime(version.createdAt)}
                          </span>
                        </div>
                        {version.description && (
                          <p className="text-xs text-gray-300 mb-1">{version.description}</p>
                        )}
                        <div className="text-xs text-gray-400 mb-2">
                          {version.featureCount} 特征点 · {version.excludedVolumeCount} 排除体积
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRestoreVersion(version.version)}
                            disabled={currentVersion === version.version}
                            className="flex-1 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded text-xs"
                          >
                            恢复
                          </button>
                          <button
                            onClick={() => setCompareVersion(compareVersion === version.version ? null : version.version)}
                            className={`flex-1 py-1 rounded text-xs ${
                              compareVersion === version.version
                                ? 'bg-yellow-600 text-white'
                                : 'bg-gray-500 hover:bg-gray-400 text-white'
                            }`}
                          >
                            {compareVersion === version.version ? '取消对比' : '对比'}
                          </button>
                          <button
                            onClick={() => deleteModelVersion(version.version)}
                            className="py-1 px-2 bg-red-800 hover:bg-red-700 text-white rounded text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {versionDiff && (
                <div className="bg-gray-600 rounded-lg p-3">
                  <p className="text-xs text-white font-medium mb-2">
                    版本 {currentVersion} 与 {compareVersion} 差异：
                  </p>
                  <div className="space-y-1 text-xs">
                    {versionDiff.added.length > 0 && (
                      <p className="text-green-400">✓ 新增 {versionDiff.added.length} 个特征点</p>
                    )}
                    {versionDiff.removed.length > 0 && (
                      <p className="text-red-400">✗ 删除 {versionDiff.removed.length} 个特征点</p>
                    )}
                    {versionDiff.modified.length > 0 && (
                      <p className="text-yellow-400">⚡ 修改 {versionDiff.modified.length} 个特征点</p>
                    )}
                    {versionDiff.added.length === 0 && versionDiff.removed.length === 0 && versionDiff.modified.length === 0 && (
                      <p className="text-gray-400">无差异</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
