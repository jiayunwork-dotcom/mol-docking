import { useMolStore } from '../store/molStore';
import type { InteractionType } from '../types';
import { INTERACTION_COLORS } from '../types';

const INTERACTION_NAMES: Record<InteractionType, string> = {
  hydrogen_bond: '氢键',
  hydrophobic: '疏水作用',
  pi_pi: 'π-π堆积',
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

  const interactionTypes: InteractionType[] = ['hydrogen_bond', 'hydrophobic', 'pi_pi', 'salt_bridge', 'halogen_bond'];

  const filteredInteractions = interactions.filter(
    (int) => visibleInteractionTypes.has(int.type)
  );

  const groupedByType = interactionTypes.reduce((acc, type) => {
    acc[type] = filteredInteractions.filter((int) => int.type === type);
    return acc;
  }, {} as Record<InteractionType, typeof interactions>);

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">相互作用分析</h3>

      {pocketHasMissing && (
        <div className="bg-yellow-600 text-white p-2 rounded mb-3 text-sm">
          ⚠️ 结合口袋存在缺失残基，结果可能不准确
        </div>
      )}

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
              {INTERACTION_NAMES[type]} ({groupedByType[type].length})
            </button>
          ))}
        </div>
      </div>

      <div className="text-white text-sm mb-2">
        共检测到 {filteredInteractions.length} 个相互作用
        {pocketResidues.length > 0 && `, 口袋残基 ${pocketResidues.length} 个`}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filteredInteractions.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-4">
            暂无检测到的相互作用
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left py-2">类型</th>
                <th className="text-left py-2">供体残基</th>
                <th className="text-left py-2">受体原子</th>
                <th className="text-right py-2">距离(Å)</th>
              </tr>
            </thead>
            <tbody>
              {filteredInteractions.map((int, idx) => (
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
                    {int.acceptorAtom?.atomName || '-'}
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
