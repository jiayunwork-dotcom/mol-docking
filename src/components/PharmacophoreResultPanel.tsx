import { useMemo } from 'react';
import { usePharmacophoreStore } from '../store/pharmacophoreStore';
import type { PharmacophoreFeature } from '../types';
import { PHARMACOPHORE_LABELS, PHARMACOPHORE_ICONS, PHARMACOPHORE_COLORS } from '../types';

export function PharmacophoreResultPanel() {
  const {
    selectedResult,
    model,
    setSelectedResult,
    showCandidateMolecule,
    setShowCandidateMolecule,
  } = usePharmacophoreStore();

  const modelFeatureMap = useMemo(() => {
    if (!model) return new Map<string, PharmacophoreFeature>();
    return new Map(model.features.map(f => [f.id, f]));
  }, [model]);

  const candidateFeatureMap = useMemo(() => {
    if (!selectedResult) return new Map<string, PharmacophoreFeature>();
    return new Map(selectedResult.candidateFeatures.map(f => [f.id, f]));
  }, [selectedResult]);

  if (!selectedResult) {
    return (
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <p className="text-gray-400 text-sm text-center">
          点击筛选结果查看详细信息
        </p>
      </div>
    );
  }

  const matchedModelIds = new Set(selectedResult.matchedFeatures.map(m => m.modelFeatureId));

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-medium text-lg">{selectedResult.moleculeName}</h3>
            <span className={`px-2 py-0.5 rounded text-sm font-bold ${
              selectedResult.finalScore > 0 ? 'bg-green-900 text-green-300' :
              selectedResult.finalScore > -20 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'
            }`}>
              {selectedResult.finalScore > 0 ? '+' : ''}{selectedResult.finalScore}
            </span>
            <button
              onClick={() => setShowCandidateMolecule(!showCandidateMolecule)}
              className={`px-2 py-0.5 rounded text-xs ${
                showCandidateMolecule ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}
            >
              {showCandidateMolecule ? '隐藏候选分子' : '显示候选分子'}
            </button>
            <button
              onClick={() => setSelectedResult(null)}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕ 关闭
            </button>
          </div>
          {selectedResult.smiles && (
            <p className="text-gray-400 text-sm mt-1 font-mono">
              SMILES: {selectedResult.smiles}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">基础分</p>
          <p className={`text-xl font-bold ${
            selectedResult.baseScore > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {selectedResult.baseScore > 0 ? '+' : ''}{selectedResult.baseScore}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            必须匹配: {selectedResult.matchedRequiredCount}/{selectedResult.totalRequiredCount}
            <br />
            可选匹配: {selectedResult.matchedOptionalCount}/{selectedResult.totalOptionalCount}
            <br />
            未匹配必须: {selectedResult.unmatchedRequiredCount}
          </p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">排除体积惩罚</p>
          <p className={`text-xl font-bold ${
            selectedResult.excludedVolumePenalty < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {selectedResult.excludedVolumePenalty > 0 ? '+' : ''}{selectedResult.excludedVolumePenalty}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            侵入原子: {selectedResult.intrudingAtomCount} 个
          </p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">距离约束惩罚</p>
          <p className={`text-xl font-bold ${
            selectedResult.distanceConstraintPenalty < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {selectedResult.distanceConstraintPenalty > 0 ? '+' : ''}{selectedResult.distanceConstraintPenalty}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            违反约束: {selectedResult.distanceConstraintViolations} 条
          </p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">最终得分</p>
          <p className={`text-2xl font-bold ${
            selectedResult.finalScore > 0 ? 'text-green-400' :
            selectedResult.finalScore > -20 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {selectedResult.finalScore > 0 ? '+' : ''}{selectedResult.finalScore}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            基础分 {selectedResult.baseScore} 
            {selectedResult.excludedVolumePenalty >= 0 ? '+' : ''} {selectedResult.excludedVolumePenalty}
            {selectedResult.distanceConstraintPenalty >= 0 ? '+' : ''} {selectedResult.distanceConstraintPenalty}
          </p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">匹配统计</p>
          <p className="text-xl font-bold text-white">
            {selectedResult.matchedRequiredCount + selectedResult.matchedOptionalCount}
            <span className="text-sm text-gray-400"> / {selectedResult.totalRequiredCount + selectedResult.totalOptionalCount}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            匹配率: {((selectedResult.matchedRequiredCount + selectedResult.matchedOptionalCount) / 
              (selectedResult.totalRequiredCount + selectedResult.totalOptionalCount) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-300 text-sm font-medium mb-2">匹配特征对应关系</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {selectedResult.matchedFeatures.map((match, idx) => {
              const modelFeat = modelFeatureMap.get(match.modelFeatureId);
              const candFeat = candidateFeatureMap.get(match.candidateFeatureId);
              if (!modelFeat || !candFeat) return null;

              return (
                <div key={idx} className="flex items-center gap-2 text-xs bg-gray-600 rounded p-1.5">
                  <span style={{ color: PHARMACOPHORE_COLORS[modelFeat.type] }}>
                    {PHARMACOPHORE_ICONS[modelFeat.type]}
                  </span>
                  <span className="text-gray-300 flex-1">
                    {PHARMACOPHORE_LABELS[modelFeat.type]}
                  </span>
                  <span className="text-green-400">
                    ↔ {match.distance.toFixed(2)}Å
                  </span>
                </div>
              );
            })}
            {selectedResult.matchedFeatures.length === 0 && (
              <p className="text-gray-400 text-xs text-center py-2">
                无匹配特征
              </p>
            )}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-300 text-sm font-medium mb-2">未匹配特征</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {model?.features.filter(f => !matchedModelIds.has(f.id)).map((feature, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs bg-gray-600 rounded p-1.5"
                style={{ borderLeft: `2px solid ${PHARMACOPHORE_COLORS[feature.type]}` }}
              >
                <span>{PHARMACOPHORE_ICONS[feature.type]}</span>
                <span className="text-gray-300">
                  {PHARMACOPHORE_LABELS[feature.type]}
                </span>
                <span className={`ml-auto text-xs px-1 rounded ${
                  feature.isRequired ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
                }`}>
                  {feature.isRequired ? '必须' : '可选'}
                </span>
              </div>
            ))}
            {model?.features.filter(f => !matchedModelIds.has(f.id)).length === 0 && (
              <p className="text-gray-400 text-xs text-center py-2">
                全部特征已匹配 ✓
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
