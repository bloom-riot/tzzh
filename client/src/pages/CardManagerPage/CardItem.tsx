import { memo } from 'react';
import { Pencil, Ban, Trash2, Check, Loader2, X, Save } from 'lucide-react';
import type { ReplyCard } from '@shared/api.interface';

interface CardItemProps {
  card: ReplyCard;
  isSelected: boolean;
  isBlocked: boolean;
  isEditing: boolean;
  editContent: string;
  editCategory: string;
  editSaving: boolean;
  deletingId: string | null;
  confirmDeleteId: string | null;
  categories: Array<{ id: string; name: string }>;
  catName: string;
  onToggleSelect: (id: string) => void;
  onStartEdit: (card: ReplyCard) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditContentChange: (v: string) => void;
  onEditCategoryChange: (v: string) => void;
  onToggleBlock: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
}

const CardItemImpl: React.FC<CardItemProps> = ({
  card,
  isSelected,
  isBlocked: blocked,
  isEditing,
  editContent,
  editCategory,
  editSaving,
  deletingId,
  confirmDeleteId,
  categories,
  catName,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onEditCategoryChange,
  onToggleBlock,
  onDelete,
  onConfirmDelete,
}) => {
  if (isEditing) {
    return (
      <div
        className="rounded-2xl p-4 shadow-md transition-all"
        style={{
          backgroundColor: 'var(--chat-surface-secondary)',
          border: isSelected
            ? '1px solid color-mix(in_oklab, var(--chat-accent) 50%, transparent)'
            : '1px solid var(--chat-surface-secondary)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            rows={3}
            className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed"
            style={{
              color: 'var(--chat-text-primary)',
              backgroundColor: 'var(--chat-surface-secondary)',
              border: '1px solid color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
              borderRadius: '0.75rem',
              padding: '0.75rem',
            }}
          />
          <select
            value={editCategory}
            onChange={(e) => onEditCategoryChange(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none"
            style={{
              color: 'var(--chat-text-primary)',
              backgroundColor: 'var(--chat-surface-secondary)',
              border: '1px solid var(--chat-divider-soft)',
            }}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelEdit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
              style={{
                color: 'var(--chat-text-secondary)',
                backgroundColor: 'var(--chat-surface-secondary)',
              }}
            >
              <X size={14} />
              取消
            </button>
            <button
              onClick={onSaveEdit}
              disabled={editSaving || !editContent.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: 'var(--chat-accent)',
                color: 'var(--chat-bubble-me-text)',
              }}
            >
              {editSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-4 shadow-md transition-all"
      style={{
        backgroundColor: 'var(--chat-surface-secondary)',
        border: isSelected
          ? '1px solid color-mix(in_oklab, var(--chat-accent) 50%, transparent)'
          : '1px solid var(--chat-surface-secondary)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => onToggleSelect(card.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(card.id);
          }}
          className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-colors"
          style={{
            backgroundColor: isSelected ? 'var(--chat-accent)' : 'transparent',
            border: '1px solid var(--chat-divider)',
          }}
          aria-label={isSelected ? '取消选中' : '选中字卡'}
        >
          {isSelected && <Check size={10} style={{ color: 'var(--chat-bubble-me-text)' }} />}
        </button>
        <p
          className="text-sm leading-relaxed break-words flex-1 min-w-0"
          style={{ color: 'var(--chat-text-primary)' }}
        >
          {card.content}
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            color: 'hsla(270, 40%, 75%, 0.85)',
            backgroundColor: 'hsla(270, 40%, 75%, 0.12)',
          }}
        >
          {catName}
        </span>
        {blocked && (
          <span
            className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
            style={{
              color: 'hsla(30, 80%, 70%, 0.95)',
              backgroundColor: 'hsla(30, 80%, 60%, 0.15)',
            }}
          >
            <Ban size={9} />
            已屏蔽
          </span>
        )}
        <div
          className="flex items-center gap-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onStartEdit(card)}
            className="p-1.5 rounded-lg transition-colors hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_10%,transparent)]"
            style={{ color: 'var(--chat-text-secondary)' }}
            aria-label="编辑"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onToggleBlock(card.id)}
            className="p-1.5 rounded-lg transition-colors hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_10%,transparent)]"
            style={{
              color: blocked
                ? 'hsla(30, 80%, 70%, 0.95)'
                : 'var(--chat-text-secondary)',
            }}
            aria-label={blocked ? '取消屏蔽' : '屏蔽'}
          >
            <Ban size={14} />
          </button>
          <button
            onClick={() => onDelete(card.id)}
            disabled={deletingId === card.id}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color:
                confirmDeleteId === card.id
                  ? 'var(--chat-danger)'
                  : 'var(--chat-text-secondary)',
              backgroundColor:
                confirmDeleteId === card.id
                  ? 'hsla(0, 80%, 70%, 0.15)'
                  : 'transparent',
            }}
            aria-label="删除"
          >
            {deletingId === card.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
          {confirmDeleteId === card.id && (
            <button
              onClick={() => onConfirmDelete(card.id)}
              className="text-xs px-2 py-1 rounded-md"
              style={{
                color: 'var(--chat-text-secondary)',
                backgroundColor: 'var(--chat-surface-secondary)',
              }}
            >
              确认？
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const CardItem = memo(CardItemImpl);
