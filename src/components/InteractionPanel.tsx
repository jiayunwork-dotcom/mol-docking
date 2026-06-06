import { useState, useMemo } from 'react';
import { useMolStore } from '../store/molStore';
import type { InteractionType } from '../types';
import { INTERACTION_COLORS } from '../types';

const INTERACTION_NAMES: Record<InteractionType, string> = {
  hydrogen_bond: '氢键',
  hydrophobic: '疏水',
  pi_pi: 'π-π',
  salt_bridge: '盐桥',
  halogen_bond: '卤键',
};

export function InteractionPanel() {
  const {
    interactions,
    pocketResidues,
    pocketHasMissing,
    visibleInteractionTypes,
    toggleInteractionType,
  } = useMolStore();

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const interactionTypes: InteractionType[] = ['hydrogen_bond', 'hydrophobic', 'pi_pi', 'salt_bridge', 'halogen_bond'];

  const stats = useMemo(() => {
    return interactionTypes.reduce((acc, type) => {
      acc[type] = interactions.filter((int) => int.type === type).length;
      return acc;
    }, {} as Record<InteractionType, number>);
  }, [interactions]);

  const filteredAndSortedInteractions = useMemo(() => {
    let result = interactions.filter(
      (int) => visibleInteractionTypes.has(int.type)
    );

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((int) => {
        const donorMatch = int.donorResidue && (
          int.donorResidue.name.toLowerCase().includes(query) ||
          String(int.donorResidue.id).includes(query)
        );
        const acceptorMatch = int.acceptorResidue && (
          int.acceptorResidue.name.toLowerCase().includes(query) ||
          String(int.acceptorResidue.id).includes(query)
        );
        return donorMatch || acceptorMatch;
      });
    }

    result.sort((a, b) => {
      return sortOrder === 'asc' ? a.distance - b.distance : b.distance - a.distance;
    });

    return result;
  }, [interactions, visibleInteractionTypes, searchQuery, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">相互作用分析</h3>

      {pocketHasMissing && (
        <div className="bg-yellow-600 text-white p-2 rounded mb-3 text-sm">
          ⚠️ 结合口袋存在缺失残基，结果可能不准确
        </div>
      )}

      <div className="bg-gray-700 p-2 rounded mb-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {interactionTypes.map((type) => (
            <span key={type} className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: INTERACTION_COLORS[type] }}
              />
              <span className="text-white">{INTERACTION_NAMES[type]}:</span>
              <span className="text-gray-300 font-mono">{stats[type]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-white text-sm mb-2">相互作用类型</label>
        <div className="flex flex-wrap gap-2">
          {interactionTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleInteractionType(type)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors
                ${visibleInteractionTypes.has(type)
                  ? 'text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              style={{
                backgroundColor: visibleInteractionTypes.has(type)
                  ? INTERACTION_COLORS[type]
                  : undefined,
              }}
            >
              {INTERACTION_NAMES[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <input
          type="text"
          placeholder="搜索残基名或编号..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="text-white text-sm mb-2">
        共检测到 {filteredAndSortedInteractions.length} 个相互作用
        {pocketResidues.length > 0 && `, 口袋残基 ${pocketResidues.length} 个`}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filteredAndSortedInteractions.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-4">
            {searchQuery ? '没有匹配的相互作用' : '暂无检测到的相互作用'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-400 border-b border-gray-700 sticky top-0 bg-gray-800">
              <tr>
                <th className="text-left py-2">类型</th>
                <th className="text-left py-2">供体残基</th>
                <th className="text-left py-2">受体残基</th>
                <th
                  className="text-right py-2 cursor-pointer hover:text-white select-none"
                  onClick={toggleSortOrder}
                >
                  距离(Å) {sortOrder === 'asc' ? '↑' : '↓'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedInteractions.map((int, idx) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: INTERACTION_COLORS[int.type] }}
                    />
                    {INTERACTION_NAMES[int.type]}
                  </td>
                  <td className="py-2 text-white">
                    {int.donorResidue
                      ? `${int.donorResidue.name}${int.donorResidue.id}`
                      : '-'}
                  </td>
                  <td className="py-2 text-white">
                    {int.acceptorResidue
                      ? `${int.acceptorResidue.name}${int.acceptorResidue.id}`
                      : int.acceptorAtom?.atomName || '-'}
                  </td>
                  <td className="py-2 text-right text-white">
                    {int.distance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
