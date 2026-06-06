import { useRef } from 'react';
import { usePharmacophoreStore } from '../store/pharmacophoreStore';
import type { PharmacophoreModel, ScoringResult } from '../types';

export function PharmacophoreIO() {
  const { model, scoringResults, setModel } = usePharmacophoreStore();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportModel = () => {
    if (!model) {
      alert('没有可导出的药效团模型');
      return;
    }

    const exportData = {
      name: model.name,
      features: model.features.map(f => ({
        type: f.type,
        x: f.x,
        y: f.y,
        z: f.z,
        radius: f.radius,
        isRequired: f.isRequired,
        normal: f.normal,
      })),
      excludedVolumes: model.excludedVolumes.map(v => ({
        x: v.x,
        y: v.y,
        z: v.z,
        radius: v.radius,
      })),
      minOptionalMatch: model.minOptionalMatch,
      maxOptionalMatch: model.maxOptionalMatch,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name || 'pharmacophore'}_model.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      if (!data.features || !Array.isArray(data.features)) {
        throw new Error('无效的药效团模型文件');
      }

      const importedModel: PharmacophoreModel = {
        id: `imported_${Date.now()}`,
        name: data.name || file.name.replace(/\.json$/i, ''),
        features: data.features.map((f: any, idx: number) => ({
          id: `feat_${Date.now()}_${idx}`,
          type: f.type,
          x: f.x,
          y: f.y,
          z: f.z,
          radius: f.radius,
          isRequired: f.isRequired ?? true,
          normal: f.normal,
        })),
        excludedVolumes: (data.excludedVolumes || []).map((v: any, idx: number) => ({
          id: `vol_${Date.now()}_${idx}`,
          x: v.x,
          y: v.y,
          z: v.z,
          radius: v.radius,
        })),
        distanceConstraints: (data.distanceConstraints || []).map((c: any, idx: number) => ({
          id: `constraint_${Date.now()}_${idx}`,
          featureIdA: c.featureIdA,
          featureIdB: c.featureIdB,
          minDistance: c.minDistance,
          maxDistance: c.maxDistance,
        })),
        createdAt: Date.now(),
        minOptionalMatch: data.minOptionalMatch || 0,
        maxOptionalMatch: data.maxOptionalMatch || 100,
      };

      setModel(importedModel);
      alert('药效团模型导入成功');
    } catch (error) {
      alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleExportResults = () => {
    if (scoringResults.length === 0) {
      alert('没有可导出的筛选结果');
      return;
    }

    const headers = ['排名', '分子名', '最终分', '匹配数', '未匹配必须数', '排除体积惩罚', '匹配率'];
    const rows = scoringResults.map((result: ScoringResult, idx: number) => [
      idx + 1,
      result.moleculeName,
      result.finalScore,
      `${result.matchedRequiredCount + result.matchedOptionalCount}/${result.totalRequiredCount + result.totalOptionalCount}`,
      result.unmatchedRequiredCount,
      result.excludedVolumePenalty,
      `${((result.matchedRequiredCount + result.matchedOptionalCount) / (result.totalRequiredCount + result.totalOptionalCount) * 100).toFixed(1)}%`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `virtual_screening_results_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-white font-medium">导入导出</h3>

      <div className="bg-gray-700 rounded-lg p-3 space-y-2">
        <p className="text-gray-300 text-sm font-medium">药效团模型</p>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          onChange={handleImportModel}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
          >
            📥 导入JSON
          </button>
          <button
            onClick={handleExportModel}
            disabled={!model || model.features.length === 0}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
          >
            📤 导出JSON
          </button>
        </div>
      </div>

      <div className="bg-gray-700 rounded-lg p-3">
        <p className="text-gray-300 text-sm font-medium mb-2">筛选结果</p>
        <button
          onClick={handleExportResults}
          disabled={scoringResults.length === 0}
          className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
        >
          📊 导出CSV结果
          {scoringResults.length > 0 && ` (${scoringResults.length}条)`}
        </button>
      </div>

      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-3">
        <p className="text-xs text-gray-400">
          <strong className="text-gray-300">说明:</strong><br />
          • 导出的JSON包含所有特征点坐标、类型、半径和必须/可选标记<br />
          • 导出的CSV包含排名、分子名、得分、匹配数等关键信息<br />
          • 可导入之前保存的JSON模型继续分析
        </p>
      </div>
    </div>
  );
}
