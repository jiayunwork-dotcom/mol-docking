import { useState, useRef, useCallback, useEffect } from 'react';
import { usePharmacophoreStore } from '../store/pharmacophoreStore';
import { parseSDF } from '../parsers/ligandParser';
import type { CandidateMolecule, LigandConformation } from '../types';
import { validateModelForScreening } from '../analysis/pharmacophoreExtractor';
import { estimateRemainingTime, formatTime } from '../analysis/pharmacophoreScoring';
import type { WorkerMessage, ScoringProgressData, ScoringCompleteData } from '../types';

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
    isScoring,
    setIsScoring,
    scoringProgress,
    scoringTotal,
    scoringMessage,
    setScoringProgress,
    setScoringMessage,
  } = usePharmacophoreStore();

  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

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

      if (wasTruncated) {
        alert(`文件包含超过500个分子，已截取前500个进行处理`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '文件解析失败');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setCandidateMolecules, clearScoringResults]);

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
  }, [model, candidateMolecules, clearScoringResults, setIsScoring, setScoringProgress, setScoringResults, setScoringMessage]);

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
    setSelectedResult(null);
    setUploadError(null);
    setScoringMessage('');
  }, [clearCandidateMolecules, clearScoringResults, setSelectedResult, setScoringMessage]);

  const remainingTime = isScoring && scoringProgress > 0
    ? estimateRemainingTime(
        scoringProgress,
        scoringTotal,
        Date.now() - (performance.timeOrigin + performance.now())
      )
    : null;

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
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-300 text-sm font-medium mb-2">
            筛选结果 ({scoringResults.length} 个分子)
          </p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {scoringResults.map((result, idx) => (
              <button
                key={result.moleculeId}
                onClick={() => setSelectedResult(result)}
                className="w-full flex items-center justify-between p-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-500 text-white' :
                    idx === 1 ? 'bg-gray-400 text-white' :
                    idx === 2 ? 'bg-orange-600 text-white' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-xs text-gray-200 font-medium truncate max-w-32">
                      {result.moleculeName}
                    </p>
                    <p className="text-xs text-gray-400">
                      匹配 {result.matchedRequiredCount + result.matchedOptionalCount}/
                      {result.totalRequiredCount + result.totalOptionalCount}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${
                  result.finalScore > 0 ? 'text-green-400' :
                  result.finalScore > -20 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {result.finalScore > 0 ? '+' : ''}{result.finalScore}
                </span>
              </button>
            ))}
          </div>
        </div>
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
