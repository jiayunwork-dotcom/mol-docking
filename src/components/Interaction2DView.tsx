import { useRef, useEffect } from 'react';
import { useMolStore } from '../store/molStore';
import { generate2DLayout, draw2DInteraction } from '../analysis/interaction2D';

export function Interaction2DView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ligand, currentConformation, interactions, pocketResidues } = useMolStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!ligand || ligand.conformations.length === 0) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('请上传配体文件', canvas.width / 2, canvas.height / 2);
      return;
    }

    const conformation = ligand.conformations[currentConformation];
    if (!conformation) return;

    const layout = generate2DLayout(conformation, interactions, pocketResidues);
    draw2DInteraction(ctx, layout, canvas.width, canvas.height);
  }, [ligand, currentConformation, interactions, pocketResidues]);

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">2D相互作用图</h3>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="w-full bg-gray-700 rounded"
      />
    </div>
  );
}
