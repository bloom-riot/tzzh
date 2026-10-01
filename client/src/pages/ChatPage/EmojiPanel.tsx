import { useRef, useState } from 'react';
import { Smile, ImageIcon, X, Hand, Plus, Trash2, Sparkles, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Image } from '@client/src/components/ui/image';

interface EmojiPanelProps {
  emojis: string[];
  stickers: string[];
  patPats: string[];
  onInsertEmoji: (emoji: string) => void;
  onSendSticker: (stickerUrl: string) => void;
  onSendPat: (content: string) => void;
  onClose: () => void;
  onAddSticker?: (dataUrl: string) => void;
  onRemoveSticker?: (stickerUrl: string) => void;
  onAddUserPat?: (contents: string[]) => void;
  onDeleteUserPat?: (id: string) => void;
  userPatItems?: Array<{ id: string; content: string }>;
  onOpenDecorSetting?: () => void;
}

type TabType = 'emoji' | 'sticker' | 'pat';

const MAX_STICKER_SIZE = 256;
const MAX_STICKER_BYTES = 2 * 1024 * 1024;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_STICKER_BYTES) {
      reject(new Error(`图片过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择 2MB 以内的图片`));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result !== 'string' || !result.startsWith('data:image')) {
        reject(new Error('图片格式不支持'));
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(1, MAX_STICKER_SIZE / Math.max(img.width, img.height));
        const w = Math.floor(img.width * ratio);
        const h = Math.floor(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('图片处理失败'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png', 0.9));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

export function EmojiPanel({
  emojis,
  stickers,
  patPats,
  onInsertEmoji,
  onSendSticker,
  onAddSticker,
  onRemoveSticker,
  onSendPat,
  onClose,
  onAddUserPat,
  onDeleteUserPat,
  userPatItems,
  onOpenDecorSetting,
}: EmojiPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('emoji');
  const [showPatManage, setShowPatManage] = useState(false);
  const [newPatText, setNewPatText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayPatList =
    userPatItems && userPatItems.length > 0
      ? userPatItems
      : patPats.map((content, idx) => ({ id: `pat_default_${idx}`, content }));

  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onAddSticker) return;
    const fileList = Array.from(files);
    let successCount = 0;
    let failCount = 0;

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) {
        failCount += 1;
        continue;
      }
      try {
        const dataUrl = await compressImage(file);
        onAddSticker(dataUrl);
        successCount += 1;
      } catch (err) {
        failCount += 1;
        const msg = err instanceof Error ? err.message : '上传失败';
        toast.error(`${file.name}：${msg}`);
      }
    }

    if (successCount > 0) {
      toast.success(`已添加 ${successCount} 张表情包`);
    } else if (failCount > 0 && successCount === 0) {
      toast.error('添加失败，请检查图片格式和大小');
    }
    e.target.value = '';
  };

  return (
    <div
      className="w-full border-t"
      style={{
        backgroundColor: '#f7f7f7',
        borderTopColor: '#e0e0e0',
        height: '400px',
        maxHeight: '50dvh',
      }}
    >
      <div
        className="flex items-center border-b px-2"
        style={{ borderBottomColor: '#e0e0e0', height: '36px' }}
      >
        <button
          onClick={() => setActiveTab('emoji')}
          className="flex items-center gap-1 px-3 h-full text-xs transition-colors"
          style={{
            color: activeTab === 'emoji' ? '#c9a87c' : '#666',
            borderBottom: activeTab === 'emoji' ? '2px solid #c9a87c' : '2px solid transparent',
          }}
        >
          <Smile size={14} />
          Emoji
        </button>
        <button
          onClick={() => setActiveTab('sticker')}
          className="flex items-center gap-1 px-3 h-full text-xs transition-colors"
          style={{
            color: activeTab === 'sticker' ? '#c9a87c' : '#666',
            borderBottom: activeTab === 'sticker' ? '2px solid #c9a87c' : '2px solid transparent',
          }}
        >
          <ImageIcon size={14} />
          表情包
        </button>
        <button
          onClick={() => setActiveTab('pat')}
          className="flex items-center gap-1 px-3 h-full text-xs transition-colors"
          style={{
            color: activeTab === 'pat' ? '#c9a87c' : '#666',
            borderBottom: activeTab === 'pat' ? '2px solid #c9a87c' : '2px solid transparent',
          }}
        >
          <Hand size={14} />
          拍一拍
        </button>
        {activeTab === 'sticker' && onAddSticker && (
          <button
            onClick={handlePickFiles}
            className="ml-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors active:opacity-70"
            style={{ backgroundColor: '#c9a87c', color: '#fff' }}
            aria-label="添加表情包"
            title="添加表情包"
          >
            <Plus size={14} />
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors active:bg-gray-200"
          style={{ color: '#999' }}
          aria-label="关闭表情面板"
        >
          <X size={14} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="h-[calc(100%-36px)] overflow-y-auto p-3">
        {activeTab === 'emoji' && (
          <div className="grid grid-cols-6 md:grid-cols-8 gap-1">
            {emojis.length === 0 ? (
              <div className="col-span-6 md:col-span-8 py-8 text-center text-xs" style={{ color: '#999' }}>
                暂无 Emoji，可到回复库管理中添加
              </div>
            ) : (
              emojis.map((emoji, idx) => (
                <button
                  key={`${emoji}-${idx}`}
                  onClick={() => onInsertEmoji(emoji)}
                  className="aspect-square flex items-center justify-center text-2xl rounded-lg transition-colors active:bg-gray-200 hover:bg-gray-200"
                  style={{ lineHeight: 1 }}
                >
                  {emoji}
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'sticker' && (
          <div>
            {onAddSticker && (
              <div className="mb-2">
                <span className="text-xs font-medium" style={{ color: '#8b7355' }}>
                  添加表情
                </span>
              </div>
            )}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {onAddSticker && (
                <button
                  onClick={handlePickFiles}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center border-2 border-dashed transition-colors hover:opacity-80 active:opacity-70"
                  style={{
                    borderColor: 'hsla(30, 45%, 65%, 0.5)',
                    backgroundColor: 'hsla(30, 45%, 65%, 0.08)',
                    color: '#c9a87c',
                  }}
                  aria-label="添加表情包"
                >
                  <Plus size={20} />
                  <span className="text-xs mt-0.5" style={{ color: '#9a7b5a' }}>添加</span>
                </button>
              )}
              {stickers.length === 0 && !onAddSticker ? (
                  <div className="col-span-3 md:col-span-4 py-8 text-center text-xs" style={{ color: '#999' }}>
                  暂无表情包，可到回复库管理中添加上传
                </div>
              ) : (
                stickers.map((sticker, idx) => (
                  <div
                    key={`${sticker}-${idx}`}
                    className="relative aspect-square rounded-lg overflow-hidden group transition-transform active:scale-95"
                    style={{ backgroundColor: '#fff' }}
                  >
                    <button
                      onClick={() => onSendSticker(sticker)}
                      className="w-full h-full flex items-center justify-center"
                      aria-label="发送表情包"
                    >
                      <Image
                        src={sticker}
                        alt="表情包"
                        className="w-full h-full object-contain p-1"
                      />
                    </button>
                    {onRemoveSticker && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSticker(sticker);
                          toast.success('已删除');
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        style={{ backgroundColor: 'hsl(0, 70%, 65%)', color: '#fff' }}
                        aria-label="删除表情包"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            {onAddSticker && stickers.length === 0 && (
              <p className="text-xs mt-3 text-center" style={{ color: '#b09a82' }}>
                点击上方「添加」上传本地图片作为表情包
              </p>
            )}
          </div>
        )}

        {activeTab === 'pat' && (
          <div className="flex flex-col h-full">
            <div
              className="flex items-center justify-between px-1 pb-2 mb-1 border-b"
              style={{ borderColor: '#e5e5e5' }}
            >
              <span className="text-xs font-medium" style={{ color: '#666' }}>
                我的快捷动作
              </span>
              <div className="flex items-center gap-1.5">
                {onOpenDecorSetting && (
                  <button
                    onClick={onOpenDecorSetting}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors active:opacity-70"
                    style={{
                      backgroundColor: 'hsl(40, 40%, 75%)',
                      color: '#fff',
                    }}
                    title="装饰符号设置"
                  >
                    <Sparkles size={12} />
                    装饰
                  </button>
                )}
                <button
                  onClick={() => setShowPatManage((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors active:opacity-70"
                  style={{
                    backgroundColor: showPatManage ? 'hsl(30, 55%, 55%)' : 'hsl(30, 45%, 65%)',
                    color: '#fff',
                  }}
                >
                  <Plus size={12} />
                  自定义动作
                </button>
              </div>
            </div>
            {showPatManage && (
              <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: '#f0ece3' }}>
                <textarea
                  value={newPatText}
                  onChange={(e) => setNewPatText(e.target.value)}
                  placeholder="输入动作，每行一个，批量添加"
                  rows={3}
                  className="w-full px-2 py-1.5 text-xs rounded-md outline-none resize-none"
                  style={{
                    backgroundColor: '#fff',
                    color: '#333',
                    border: '1px solid #e0d5c0',
                  }}
                />
                <div className="flex items-center justify-end gap-2 mt-1.5">
                  <button
                    onClick={() => setShowPatManage(false)}
                    className="px-3 py-1 text-xs rounded-md"
                    style={{ color: '#8b7355' }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      if (!newPatText.trim() || !onAddUserPat) return;
                      const lines = newPatText.split('\n').filter((l) => l.trim());
                      if (lines.length > 0) {
                        onAddUserPat(lines);
                        setNewPatText('');
                        setShowPatManage(false);
                      }
                    }}
                    disabled={!newPatText.trim() || !onAddUserPat}
                    className="px-3 py-1 text-xs rounded-md font-medium transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: 'hsl(30, 45%, 65%)', color: '#fff' }}
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto -mx-1">
              {displayPatList.length === 0 ? (
                <div className="py-8 text-center text-xs" style={{ color: '#999' }}>
                  暂无快捷动作，点击上方"自定义动作"添加
                </div>
              ) : (
                displayPatList.map((pat) => (
                  <div key={pat.id} className="group flex items-center gap-2">
                    <button
                      onClick={() => onSendPat(pat.content)}
                      className="flex-1 text-left px-3 py-2.5 rounded-lg text-sm transition-colors active:bg-gray-200 hover:bg-gray-100"
                      style={{ color: '#333' }}
                    >
                      {pat.content}
                    </button>
                    {onDeleteUserPat && userPatItems && (
                      <button
                        onClick={() => onDeleteUserPat(pat.id)}
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
                        style={{ color: '#c88' }}
                        aria-label="删除动作"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
