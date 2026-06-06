import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { usePharmacophoreStore } from '../store/pharmacophoreStore';
import { parseSDF } from '../parsers/ligandParser';
import type { CandidateMolecule, LigandConformation, ScoringResult, ScoreGroup } from '../types';
import { validateModelForScreening } from '../analysis/pharmacophoreExtractor';
import { estimateRemainingTime, formatTime, getScoreGroup, SCORE_GROUP_LABELS, SCORE_GROUP_COLORS } from '../analysis/pharmacophoreScoring';
import type { WorkerMessage, ScoringProgressData, ScoringCompleteData, ScoringLogData } from '../types';

export function PharmacophoreScreening() {
  const {
    model,
    candidateMolecules,
    setCandidateMolecules,
    clearCandidateMolecules,
    scoringResults,
    setScoringResults,
    clearScoringResults,
    setSelectedResult,
    toggleSelectedResult,
    clearSelectedResults,
    selectedResults,
    isScoring,
    setIsScoring,
    scoringProgress,
    scoringTotal,
    scoringMessage,
    setScoringProgress,
    setScoringMessage,
    resultFilter,
    setResultFilter,
    resetResultFilter,
    showScoreGroups,
    setShowScoreGroups,
    expandedScoreGroups,
    toggleScoreGroupExpansion,
    addScoringLog,
    clearScoringLogs,
    scoringLogs,
    showScoringLogs,
    setShowScoringLogs,
    exportScoringLogs,
  } = usePharmacophoreStore();

  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (logContainerRef.current && showScoringLogs) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [scoringLogs, showScoringLogs]);

  const filteredResults = useMemo(() => {
    return scoringResults.filter((result) => {
      const scoreMatch = result.finalScore >= resultFilter.minScore && result.finalScore <= resultFilter.maxScore;
      const matchedCount = result.matchedRequiredCount + result.matchedOptionalCount;
      const matchedMatch = matchedCount >= resultFilter.minMatchedFeatures;
      const excludedMatch = result.excludedVolumePenalty >= -resultFilter.maxExcludedVolumePenalty;
      return scoreMatch && matchedMatch && excludedMatch;
    });
  }, [scoringResults, resultFilter]);

  const groupedResults = useMemo(() => {
    const groups: Record<ScoreGroup, ScoringResult[]> = {
      excellent: [],
      good: [],
      fair: [],
    };

    filteredResults.forEach((result) => {
      const group = getScoreGroup(result.finalScore);
      groups[group].push(result);
    });

    return groups;
  }, [filteredResults]);

  const scoreRange = useMemo(() => {
    if (scoringResults.length === 0) return { min: 0, max: 100 };
    const scores = scoringResults.map((r) => r.finalScore);
    return {
      min: Math.floor(Math.min(...scores) - 10),
      max: Math.ceil(Math.max(...scores) + 10),
    };
  }, [scoringResults]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    try {
      const content = await file.text();
      const { ligand, wasTruncated } = await parseSDF(content, file.name, 500);

      const candidates: CandidateMolecule[] = ligand.conformations.map((conf: LigandConformation, idx: number) => {
        let smiles: string | undefined;
        const blockLines = content.split(/\$\$\$\$/)[idx]?.split('\n');
        if (blockLines) {
          for (let i = 0; i < blockLines.length; i++) {
            if (blockLines[i].includes('> <SMILES>') || blockLines[i].includes('> <smiles>')) {
              smiles = blockLines[i + 1]?.trim();
              break;
            }
          }
        }

        return {
          id: `candidate_${Date.now()}_${idx}`,
          name: conf.name || `${file.name}_${idx + 1}`,
          smiles,
          conformations: [conf],
          sourceData: blockLines?.join('\n'),
        };
      });

      setCandidateMolecules(candidates);
      clearScoringResults();
      clearScoringLogs();

      if (wasTruncated) {
        alert(`文件包含超过500个分子，已截取前500个进行处理`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '文件解析失败');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setCandidateMolecules, clearScoringResults, clearScoringLogs]);

  const handleStartScreening = useCallback(() => {
    if (!model) {
      alert('请先创建药效团模型');
      return;
    }

    const validation = validateModelForScreening(model.features);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    if (candidateMolecules.length === 0) {
      alert('请先上传候选分子');
      return;
    }

    clearScoringResults();
    clearScoringLogs();
    clearSelectedResults();
    setIsScoring(true);
    setScoringProgress(0, candidateMolecules.length, '初始化计算...');

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/scoringWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data as WorkerMessage;

        if (type === 'progress') {
          const data = payload as ScoringProgressData;
          setScoringProgress(data.processed, data.total, `正在处理: ${data.currentName}`);
        }

        if (type === 'log') {
          const data = payload as ScoringLogData;
          addScoringLog(data.entry);
        }

        if (type === 'complete') {
          const data = payload as ScoringCompleteData;
          setScoringResults(data.results);
          setIsScoring(false);
          setScoringMessage(`计算完成，共 ${data.results.length} 个分子，耗时 ${formatTime(data.totalMs)}`);
        }

        if (type === 'error') {
          setIsScoring(false);
          setScoringMessage(`计算错误: ${payload as string}`);
        }
      };

      workerRef.current.onerror = (error) => {
        setIsScoring(false);
        setScoringMessage(`Worker错误: ${error.message}`);
      };
    }

    workerRef.current.postMessage({
      type: 'start',
      payload: {
        model,
        candidates: candidateMolecules,
      },
    } as WorkerMessage);
  }, [model, candidateMolecules, clearScoringResults, clearScoringLogs, clearSelectedResults, setIsScoring, setScoringProgress, setScoringResults, setScoringMessage, addScoringLog]);

  const handleCancelScreening = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'cancel' } as WorkerMessage);
    }
    setIsScoring(false);
    setScoringMessage('计算已取消');
  }, [setIsScoring, setScoringMessage]);

  const handleClearAll = useCallback(() => {
    clearCandidateMolecules();
    clearScoringResults();
    clearSelectedResults();
    setSelectedResult(null);
    setUploadError(null);
    setScoringMessage('');
    clearScoringLogs();
  }, [clearCandidateMolecules, clearScoringResults, clearSelectedResults, setSelectedResult, clearScoringLogs]);

  const handleExportLogs = () => {
    const logContent = exportScoringLogs();
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scoring_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remainingTime = isScoring && scoringProgress > 0
    ? estimateRemainingTime(
        scoringProgress,
        scoringTotal,
        Date.now() - (performance.timeOrigin + performance.now())
      )
    : null;

  const renderResultItem = (result: ScoringResult, idx: number) => {
    const isSelected = selectedResults.includes(result.moleculeId);

    return (
      <div
        key={result.moleculeId}
        className={`flex items-center justify-between p-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectedResult(result.moleculeId)}
            className="w-4 h-4 rounded border-gray-400 text-blue-600 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
          <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold flex-shrink-0 ${
            idx === 0 ? 'bg-yellow-500 text-white' :
            idx === 1 ? 'bg-gray-400 text-white' :
            idx === 2 ? 'bg-orange-600 text-white' :
            'bg-gray-700 text-gray-400'
          }`}>
            {idx + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-gray-200 font-medium truncate max-w-32">
              {result.moleculeName}
            </p>
            <p className="text-xs text-gray-400">
              匹配 {result.matchedRequiredCount + result.matchedOptionalCount}/
              {result.totalRequiredCount + result.totalOptionalCount}
            </p>
          </div>
        </div>
        <span
          className={`text-sm font-bold flex-shrink-0 cursor-pointer ${
            result.finalScore > 0 ? 'text-green-400' :
            result.finalScore > -20 ? 'text-yellow-400' : 'text-red-400'
          }`}
          onClick={() => setSelectedResult(result)}
        >
          {result.finalScore > 0 ? '+' : ''}{result.finalScore}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">虚拟筛选</h3>
        <button
          onClick={handleClearAll}
          className="text-xs text-red-400 hover:text-red-300"
        >
          清空全部
        </button>
      </div>

      <div className="bg-gray-700 rounded-lg p-3">
        <p className="text-gray-300 text-sm font-medium mb-2">上传候选分子</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".sdf,.sd"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isScoring}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
        >
          📁 选择SDF文件 (最多500个分子)
        </button>
        {candidateMolecules.length > 0 && (
          <p className="text-xs text-green-400 mt-2">
            ✓ 已加载 {candidateMolecules.length} 个候选分子
          </p>
        )}
        {uploadError && (
          <p className="text-xs text-red-400 mt-2">✗ {uploadError}</p>
        )}
      </div>

      {candidateMolecules.length > 0 && (
        <button
          onClick={isScoring ? handleCancelScreening : handleStartScreening}
          disabled={!model || model.features.length < 2}
          className={`w-full py-2.5 rounded-lg font-medium transition-all ${
            isScoring
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white'
          }`}
        >
          {isScoring ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              取消计算
            </span>
          ) : (
            '⚡ 开始虚拟筛选'
          )}
        </button>
      )}

      {isScoring && (
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-300">{scoringMessage}</p>
            <p className="text-xs text-gray-400">
              {scoringProgress}/{scoringTotal}
              {remainingTime && ` · 预计剩余 ${remainingTime}`}
            </p>
          </div>
          <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-teal-500 transition-all duration-300"
              style={{ width: `${(scoringProgress / scoringTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {scoringMessage && !isScoring && (
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-sm text-gray-300">{scoringMessage}</p>
        </div>
      )}

      {scoringResults.length > 0 && (
        <>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-300 text-sm font-medium">
                筛选条件
              </p>
              <button
                onClick={resetResultFilter}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                重置
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">最终分范围</label>
                  <span className="text-xs text-gray-300">
                    {resultFilter.minScore.toFixed(0)} ~ {resultFilter.maxScore.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={scoreRange.min}
                    max={scoreRange.max}
                    value={resultFilter.minScore}
                    onChange={(e) => setResultFilter({ minScore: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="range"
                    min={scoreRange.min}
                    max={scoreRange.max}
                    value={resultFilter.maxScore}
                    onChange={(e) => setResultFilter({ maxScore: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">匹配特征数 ≥</label>
                  <input
                    type="number"
                    min="0"
                    value={resultFilter.minMatchedFeatures}
                    onChange={(e) => setResultFilter({ minMatchedFeatures: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">排除体积惩罚 ≤</label>
                  <input
                    type="number"
                    min="0"
                    step="15"
                    value={Math.abs(resultFilter.maxExcludedVolumePenalty)}
                    onChange={(e) => setResultFilter({ maxExcludedVolumePenalty: Math.abs(parseInt(e.target.value) || 0) })}
                    className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-300 text-sm font-medium">
                筛选结果 (筛选后 {filteredResults.length}/{scoringResults.length} 个)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowScoreGroups(!showScoreGroups)}
                  className={`text-xs px-2 py-1 rounded ${
                    showScoreGroups ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {showScoreGroups ? '按分数分组' : '列表视图'}
                </button>
                {selectedResults.length > 0 && (
                  <button
                    onClick={clearSelectedResults}
                    className="text-xs text-yellow-400 hover:text-yellow-300"
                  >
                    取消选择 ({selectedResults.length}/5)
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {showScoreGroups ? (
                (['excellent', 'good', 'fair'] as ScoreGroup[]).map((group) => (
                  <div key={group} className="bg-gray-600 rounded overflow-hidden">
                    <button
                      onClick={() => toggleScoreGroupExpansion(group)}
                      className="w-full flex items-center justify-between p-2 hover:bg-gray-500 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: SCORE_GROUP_COLORS[group] }}
                        />
                        <span className="text-sm text-white font-medium">
                          {SCORE_GROUP_LABELS[group]}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({groupedResults[group].length} 个)
                        </span>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {expandedScoreGroups.includes(group) ? '▲' : '▼'}
                      </span>
                    </button>
                    {expandedScoreGroups.includes(group) && (
                      <div className="p-2 pt-0 space-y-1">
                        {groupedResults[group].length > 0 ? (
                          groupedResults[group].map((result) => {
                            const idx = scoringResults.findIndex((r) => r.moleculeId === result.moleculeId);
                            return renderResultItem(result, idx);
                          })
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-2">暂无分子</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                filteredResults.length > 0 ? (
                  filteredResults.map((result, idx) => renderResultItem(result, idx))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">
                    没有符合筛选条件的分子
                  </p>
                )
              )}
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-3">
            <button
              onClick={() => setShowScoringLogs(!showScoringLogs)}
              className="w-full flex items-center justify-between text-left"
            >
              <p className="text-gray-300 text-sm font-medium">
                📝 计算日志 ({scoringLogs.length} 条)
              </p>
              <span className="text-gray-400 text-sm">{showScoringLogs ? '▲' : '▼'}</span>
            </button>

            {showScoringLogs && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleExportLogs}
                    disabled={scoringLogs.length === 0}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
                  >
                    导出TXT
                  </button>
                  <button
                    onClick={clearScoringLogs}
                    disabled={scoringLogs.length === 0}
                    className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded text-xs"
                  >
                    清空日志
                  </button>
                </div>
                <div
                  ref={logContainerRef}
                  className="bg-gray-900 rounded p-2 max-h-48 overflow-y-auto font-mono"
                >
                  {scoringLogs.length > 0 ? (
                    scoringLogs.map((entry) => {
                      const time = new Date(entry.timestamp).toLocaleTimeString();
                      return (
                        <div
                          key={entry.id}
                          className="text-xs text-gray-300 py-0.5 border-b border-gray-800 last:border-b-0"
                        >
                          <span className="text-gray-500">[{time}]</span>{' '}
                          <span className="text-blue-300">{entry.moleculeName}</span>
                          {' → '}
                          提取了<span className="text-yellow-300">{entry.featureCount}</span>个特征点
                          {' → '}
                          匹配了<span className="text-green-300">{entry.matchedRequired}/{entry.totalRequired}</span>个必须特征
                          {' → '}
                          排除体积侵入<span className="text-red-300">{entry.intrudingAtomCount}</span>个原子
                          {entry.distanceConstraintViolations > 0 && (
                            <>
                              {' → '}
                              距离约束违反<span className="text-orange-300">{entry.distanceConstraintViolations}</span>条
                            </>
                          )}
                          {' → '}
                          最终得分<span className={`font-bold ${
                            entry.finalScore > 0 ? 'text-green-400' :
                            entry.finalScore > -20 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {entry.finalScore > 0 ? '+' : ''}{entry.finalScore}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-4">
                      暂无日志，开始筛选后将显示处理记录
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {candidateMolecules.length === 0 && scoringResults.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">🔬</div>
          <p className="text-sm">上传候选分子开始虚拟筛选</p>
          <p className="text-xs mt-1">支持SDF格式，最多500个分子</p>
        </div>
      )}
    </div>
  );
}
