import { useMolStore } from '../store/molStore';

export function ViewPresets() {
  const {
    protein,
    ligand,
    goToGlobalView,
    goToPocketView,
    goToLigandView,
    viewMode,
  } = useMolStore();

  const hasProtein = !!protein;
  const hasLigand = !!ligand;
  const hasPocket = protein && ligand;

  const presets = [
    {
      id: 'global',
      label: '全局视图',
      icon: '🌍',
      onClick: goToGlobalView,
      disabled: !hasProtein,
      title: '相机拉远到能看到整个蛋白质',
    },
    {
      id: 'pocket',
      label: '口袋视图',
      icon: '🎯',
      onClick: goToPocketView,
      disabled: !hasPocket,
      title: '相机对准结合口袋中心，裁切掉距口袋中心15埃以外的原子',
    },
    {
      id: 'ligand',
      label: '配体视图',
      icon: '⚛️',
      onClick: goToLigandView,
      disabled: !hasLigand,
      title: '相机紧贴配体，只显示配体和5埃内残基',
    },
  ] as const;

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">视图预设</h3>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={preset.onClick}
            disabled={preset.disabled}
            title={preset.title}
            className={`px-2 py-3 rounded text-sm font-medium transition-all flex flex-col items-center gap-1
              ${viewMode === preset.id
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : preset.disabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            <span className="text-xl">{preset.icon}</span>
            <span className="text-xs">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
