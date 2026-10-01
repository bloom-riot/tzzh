import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

export const PAT_DECOR_OPTIONS = [
  { value: '', label: '无装饰' },
  { value: '♡', label: '♡ 爱心' },
  { value: '❤', label: '❤ 红心' },
  { value: '✨', label: '✨ 星星' },
  { value: '🌸', label: '🌸 樱花' },
  { value: '🌟', label: '🌟 闪亮' },
  { value: '🌙', label: '🌙 月亮' },
  { value: '⭐', label: '⭐ 星' },
  { value: '💫', label: '💫 星光' },
  { value: '🌷', label: '🌷 郁金香' },
  { value: '🍃', label: '🍃 叶子' },
];

interface PatDecorDialogProps {
  open: boolean;
  initialMine: string;
  initialTheirs: string;
  taName: string;
  onClose: () => void;
  onSave: (mine: string, theirs: string) => void;
}

export function PatDecorDialog({ open, initialMine, initialTheirs, taName, onClose, onSave }: PatDecorDialogProps) {
  const [mine, setMine] = useState(initialMine);
  const [theirs, setTheirs] = useState(initialTheirs);

  useEffect(() => {
    if (open) {
      setMine(initialMine);
      setTheirs(initialTheirs);
    }
  }, [open, initialMine, initialTheirs]);

  if (!open) return null;

  const wrapDecor = (text: string, decor: string) => {
    if (!decor) return text;
    return `${decor} ${text} ${decor}`;
  };

  const myPreview = wrapDecor('我拍了拍你', mine);
  const theirPreview = wrapDecor(`${taName} 拍了拍你`, theirs);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl"
        style={{ backgroundColor: '#faf6ee' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: '#ece2d0', background: 'linear-gradient(180deg, #fdfaf2, #faf6ee)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: '#c9a87c' }} />
            <span className="text-sm font-medium" style={{ color: '#5c3a1e' }}>拍一拍装饰符号</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors active:bg-white/60"
            style={{ color: '#999' }}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#8b7355' }}>我发出的</label>
            <select
              value={mine}
              onChange={(e) => setMine(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer"
              style={{
                backgroundColor: '#fff',
                color: '#333',
                border: '1px solid #e0d5c0',
              }}
            >
              {PAT_DECOR_OPTIONS.map((opt) => (
                <option key={`mine-${opt.value}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#8b7355' }}>对方发出的</label>
            <select
              value={theirs}
              onChange={(e) => setTheirs(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer"
              style={{
                backgroundColor: '#fff',
                color: '#333',
                border: '1px solid #e0d5c0',
              }}
            >
              {PAT_DECOR_OPTIONS.map((opt) => (
                <option key={`theirs-${opt.value}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#8b7355' }}>预览</label>
            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                backgroundColor: '#f5f0e8',
                border: '1px dashed #d4b896',
              }}
            >
              <div className="text-center">
                <span
                  className="text-xs px-3 py-1 rounded-full inline-block"
                  style={{ color: '#b09a82', backgroundColor: 'rgba(255,255,255,0.7)' }}
                >
                  我：{myPreview}
                </span>
              </div>
              <div className="text-center">
                <span
                  className="text-xs px-3 py-1 rounded-full inline-block"
                  style={{ color: '#b09a82', backgroundColor: 'rgba(255,255,255,0.7)' }}
                >
                  对方：{theirPreview}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: '#ece2d0' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg transition-colors active:opacity-70"
            style={{ color: '#8b7355' }}
          >
            取消
          </button>
          <button
            onClick={() => {
              onSave(mine, theirs);
              onClose();
            }}
            className="px-4 py-1.5 text-sm rounded-lg font-medium transition-colors active:opacity-80"
            style={{ backgroundColor: '#c9a87c', color: '#fff' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
