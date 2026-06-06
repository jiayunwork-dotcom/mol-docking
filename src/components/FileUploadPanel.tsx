import { useRef, useState } from 'react';
import { useMolStore } from '../store/molStore';
import { parsePDB } from '../parsers/pdbParser';
import { parseSDF, parseMOL2 } from '../parsers/ligandParser';

export function FileUploadPanel() {
  const { setProtein, setLigand, setLoading } = useMolStore();
  const proteinInputRef = useRef<HTMLInputElement>(null);
  const ligandInputRef = useRef<HTMLInputElement>(null);
  const [proteinProgress, setProteinProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProteinUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小超过50MB限制');
      return;
    }

    setError(null);
    setLoading(true);
    setProteinProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (!content) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdb' || ext === 'cif' || ext === 'mmcif') {
          const protein = await parsePDB(content, file.name, (progress) => {
            setProteinProgress(progress);
            return Promise.resolve();
          });
          setProtein(protein);
        } else {
          setError('不支持的蛋白质文件格式，请上传PDB或mmCIF文件');
        }
        setLoading(false);
        setProteinProgress(null);
      };
      reader.readAsText(file);
    } catch (err) {
      setError(`解析蛋白质文件失败: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
      setProteinProgress(null);
    }
  };

  const handleLigandUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小超过50MB限制');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (!content) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'sdf') {
          const ligand = await parseSDF(content, file.name, 20);
          setLigand(ligand);
        } else if (ext === 'mol2') {
          const ligand = await parseMOL2(content, file.name, 20);
          setLigand(ligand);
        } else {
          setError('不支持的配体文件格式，请上传SDF或MOL2文件');
        }
        setLoading(false);
      };
      reader.readAsText(file);
    } catch (err) {
      setError(`解析配体文件失败: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-4">
      <h3 className="text-white text-lg font-bold mb-3">文件上传</h3>
      
      {error && (
        <div className="bg-red-600 text-white p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {proteinProgress !== null && (
        <div className="mb-3">
          <div className="text-white text-sm mb-1">加载中: {proteinProgress.toFixed(0)}%</div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${proteinProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-white text-sm mb-1">蛋白质结构 (PDB/mmCIF)</label>
          <input
            ref={proteinInputRef}
            type="file"
            accept=".pdb,.cif,.mmcif"
            onChange={handleProteinUpload}
            className="block w-full text-sm text-gray-300
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-700
              cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-white text-sm mb-1">配体分子 (SDF/MOL2)</label>
          <input
            ref={ligandInputRef}
            type="file"
            accept=".sdf,.mol2"
            onChange={handleLigandUpload}
            className="block w-full text-sm text-gray-300
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-green-600 file:text-white
              hover:file:bg-green-700
              cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
