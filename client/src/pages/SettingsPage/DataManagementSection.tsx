import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare, Settings, Image, Database, Trash2, Skull,
  ChevronRight, AlertTriangle, Download, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  calcStorageUsage,
  formatBytes,
  exportFullBackup,
  exportMessagesBackup,
  clearChatMessages,
  resetAllData,
  restoreFullBackup,
  importMessagesBackup,
  type StorageUsage,
  type ImportMode,
} from '@client/src/utils/data-management';

const DataManagementSection: React.FC = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [performing, setPerforming] = useState(false);

  const [sheetType, setSheetType] = useState<'full' | 'messages' | null>(null);
  const [pendingImportType, setPendingImportType] = useState<'full' | 'messages' | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshUsage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await calcStorageUsage();
      setUsage(data);
    } catch (err) {
      logger.error('计算存储用量失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const handleExportFull = async () => {
    setSheetType(null);
    try {
      await exportFullBackup();
      toast.success('备份成功');
    } catch (err) {
      logger.error('全量备份失败', err);
      toast.error('备份失败，请重试');
    }
  };

  const handleExportMessages = async () => {
    setSheetType(null);
    try {
      await exportMessagesBackup();
      toast.success('备份成功');
    } catch (err) {
      logger.error('聊天记录备份失败', err);
      toast.error('备份失败，请重试');
    }
  };

  const handleRestoreClick = (type: 'full' | 'messages') => {
    setPendingImportType(type);
    setSheetType(null);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 300);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      setPendingImportType(null);
      return;
    }

    if (pendingImportType === 'full') {
      setPendingFile(file);
      setShowRestoreConfirm(true);
    } else if (pendingImportType === 'messages') {
      setPendingFile(file);
      setShowImportConfirm(true);
    }
    setPendingImportType(null);
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setPerforming(true);
    try {
      await restoreFullBackup(pendingFile);
      setShowRestoreConfirm(false);
      toast.success('恢复成功');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      logger.error('恢复失败', err);
      toast.error(err instanceof Error ? err.message : '恢复失败，请重试');
    } finally {
      setPerforming(false);
      setPendingFile(null);
    }
  };

  const handleImportMessages = async (mode: ImportMode) => {
    if (!pendingFile) return;
    setPerforming(true);
    try {
      const count = await importMessagesBackup(pendingFile, mode);
      setShowImportConfirm(false);
      toast.success(mode === 'append' ? `导入成功：新增 ${count} 条消息` : `导入成功：共 ${count} 条消息`);
      void refreshUsage();
    } catch (err) {
      logger.error('导入失败', err);
      toast.error(err instanceof Error ? err.message : '导入失败，请重试');
    } finally {
      setPerforming(false);
      setPendingFile(null);
    }
  };

  const handleClearChat = async () => {
    setPerforming(true);
    try {
      await clearChatMessages();
      setShowClearConfirm(false);
      setResetStep(1);
      toast.success('会话已清除');
      void refreshUsage();
    } catch (err) {
      logger.error('清除会话失败', err);
      toast.error('清除失败，请重试');
    } finally {
      setPerforming(false);
    }
  };

  const handleResetData = async () => {
    setPerforming(true);
    try {
      await resetAllData();
      setShowResetConfirm(false);
      setResetStep(1);
      toast.success('数据已重置');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      logger.error('重置数据失败', err);
      toast.error('重置失败，请重试');
    } finally {
      setPerforming(false);
    }
  };

  const percent = usage ? Math.min((usage.total / usage.quota) * 100, 100) : 0;

  return (
    <section>
      <h2
        className="text-sm font-medium mb-3 px-1"
        style={{ color: 'var(--chat-setting-title)' }}
      >
        数据管理
      </h2>

      {/* 存储用量 */}
      <div
        className="rounded-2xl p-4 space-y-4 mb-6"
        style={{
          backgroundColor: 'var(--chat-setting-group-bg)',
          border: '1px solid var(--chat-divider-soft)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--chat-text-primary)' }}>
            存储用量
          </span>
          <span className="text-xs" style={{ color: 'var(--chat-text-tertiary)' }}>
            {loading ? '计算中...' : usage ? `${formatBytes(usage.total)} / ${formatBytes(usage.quota)} (${percent.toFixed(1)}%)` : '--'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StorageCard
            icon={<MessageSquare size={16} />}
            label="聊天记录"
            value={loading ? '--' : usage ? formatBytes(usage.messages) : '--'}
          />
          <StorageCard
            icon={<Settings size={16} />}
            label="设置数据"
            value={loading ? '--' : usage ? formatBytes(usage.settings) : '--'}
          />
          <StorageCard
            icon={<Image size={16} />}
            label="图片媒体"
            value={loading ? '--' : usage ? formatBytes(usage.media) : '--'}
          />
        </div>

        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--chat-divider-soft)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percent}%`,
              backgroundColor: 'var(--chat-accent)',
            }}
          />
        </div>
      </div>

      {/* 备份与恢复 */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{
          backgroundColor: 'var(--chat-setting-group-bg)',
          border: '1px solid var(--chat-divider-soft)',
        }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--chat-divider-soft)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--chat-text-primary)' }}>
            备份与恢复
          </span>
        </div>

        <BackupRow
          icon={<Database size={18} />}
          title="全量备份"
          subtitle="所有设置与数据"
          onClick={() => setSheetType('full')}
        />
        <BackupRow
          icon={<MessageSquare size={18} />}
          title="聊天记录"
          subtitle="消息内容单独备份"
          onClick={() => setSheetType('messages')}
          isLast
        />
      </div>

      {/* 危险操作 */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--chat-setting-group-bg)',
          border: '1px solid var(--chat-divider-soft)',
        }}
      >
        <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--chat-divider-soft)' }}>
          <AlertTriangle size={16} style={{ color: '#e67e22' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--chat-text-primary)' }}>
            危险操作
          </span>
        </div>

        <DangerRow
          icon={<Trash2 size={18} />}
          title="清除会话"
          subtitle="删除本会话消息"
          color="#e67e22"
          onClick={() => setShowClearConfirm(true)}
        />
        <DangerRow
          icon={<Skull size={18} />}
          title="重置数据"
          subtitle="清空所有，不可撤销"
          color="#e74c3c"
          onClick={() => {
            setResetStep(1);
            setShowResetConfirm(true);
          }}
          isLast
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* 底部 ActionSheet 弹窗 */}
      {sheetType && (
        <BottomSheet onClose={() => setSheetType(null)}>
          <div className="space-y-4">
            {sheetType === 'full' ? (
              <>
                <div className="text-center space-y-1">
                  <div
                    className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                    style={{
                      backgroundColor: 'rgba(201, 168, 124, 0.15)',
                      color: 'var(--chat-accent-dark)',
                    }}
                  >
                    <Database size={22} />
                  </div>
                  <div className="text-base font-medium mt-2" style={{ color: 'var(--chat-text-primary)' }}>
                    全量备份
                  </div>
                  <div className="text-xs" style={{ color: 'var(--chat-text-tertiary)' }}>
                    包含所有设置、外观、字卡等数据
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <SheetButton
                    primary
                    icon={<Download size={18} />}
                    title="导出备份"
                    subtitle="将数据保存为文件"
                    onClick={handleExportFull}
                  />
                  <SheetButton
                    icon={<Upload size={18} />}
                    title="从文件恢复"
                    subtitle="选择之前导出的备份文件"
                    onClick={() => handleRestoreClick('full')}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <div
                    className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                    style={{
                      backgroundColor: 'rgba(46, 160, 67, 0.12)',
                      color: '#2ea043',
                    }}
                  >
                    <MessageSquare size={22} />
                  </div>
                  <div className="text-base font-medium mt-2" style={{ color: 'var(--chat-text-primary)' }}>
                    聊天记录
                  </div>
                  <div className="text-xs" style={{ color: 'var(--chat-text-tertiary)' }}>
                    仅包含消息内容
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <SheetButton
                    primary
                    primaryColor="#2ea043"
                    icon={<Download size={18} />}
                    title="导出聊天"
                    subtitle="将消息记录保存为文件"
                    onClick={handleExportMessages}
                  />
                  <SheetButton
                    icon={<Upload size={18} />}
                    title="导入聊天"
                    subtitle="从文件恢复历史消息"
                    onClick={() => handleRestoreClick('messages')}
                  />
                </div>
              </>
            )}
            <button
              onClick={() => setSheetType(null)}
              className="w-full py-3 rounded-xl text-sm font-medium transition-colors active:opacity-80"
              style={{
                backgroundColor: 'var(--chat-setting-group-bg)',
                color: 'var(--chat-text-primary)',
                border: '1px solid var(--chat-divider-soft)',
              }}
            >
              取消
            </button>
          </div>
        </BottomSheet>
      )}

      {/* 全量恢复确认弹窗 */}
      {showRestoreConfirm && (
        <ConfirmDialog
          title="恢复备份"
          message="确定要从备份恢复所有数据吗？这将覆盖当前的字卡、设置、聊天记录等，不可撤销。"
          confirmText="确认恢复"
          confirmColor="var(--chat-accent)"
          loading={performing}
          onConfirm={handleRestore}
          onCancel={() => {
            setShowRestoreConfirm(false);
            setPendingFile(null);
          }}
        />
      )}

      {/* 聊天记录导入确认弹窗 */}
      {showImportConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            setShowImportConfirm(false);
            setPendingFile(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{
              backgroundColor: 'var(--chat-setting-group-bg)',
              color: 'var(--chat-text-primary)',
              border: '1px solid var(--chat-divider-soft)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-medium text-center">导入聊天记录</h3>
            <p
              className="text-sm text-center leading-relaxed"
              style={{ color: 'var(--chat-text-secondary)' }}
            >
              确定要导入聊天记录吗？请选择导入方式。
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => void handleImportMessages('append')}
                disabled={performing}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors active:opacity-70"
                style={{
                  backgroundColor: 'var(--chat-bg-secondary)',
                  color: 'var(--chat-text-primary)',
                  border: '1px solid var(--chat-divider-soft)',
                }}
              >
                追加导入（保留现有消息）
              </button>
              <button
                onClick={() => void handleImportMessages('replace')}
                disabled={performing}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors active:opacity-70"
                style={{
                  backgroundColor: 'var(--chat-bg-secondary)',
                  color: '#e67e22',
                  border: '1px solid var(--chat-divider-soft)',
                }}
              >
                覆盖导入（替换现有消息）
              </button>
              <button
                onClick={() => {
                  setShowImportConfirm(false);
                  setPendingFile(null);
                }}
                disabled={performing}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors active:opacity-70 mt-2"
                style={{
                  backgroundColor: 'var(--chat-accent)',
                  color: 'var(--chat-bubble-me-text)',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 清除会话确认弹窗 */}
      {showClearConfirm && (
        <ConfirmDialog
          title="清除会话"
          message="确定要清除所有聊天记录吗？此操作不可撤销。"
          confirmText="确认清除"
          confirmColor="#e67e22"
          loading={performing}
          onConfirm={handleClearChat}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {/* 重置数据确认弹窗 */}
      {showResetConfirm && (
        <ConfirmDialog
          title="重置数据"
          message={
            resetStep === 1
              ? '确定要重置所有数据吗？这将清空所有字卡、设置、聊天记录、表情包等，不可撤销！'
              : '再次确认：此操作会清空所有本地数据，且无法恢复。确定继续吗？'
          }
          confirmText={resetStep === 1 ? '下一步' : '确认重置'}
          confirmColor="#e74c3c"
          loading={performing}
          onConfirm={() => {
            if (resetStep === 1) {
              setResetStep(2);
            } else {
              void handleResetData();
            }
          }}
          onCancel={() => {
            setShowResetConfirm(false);
            setResetStep(1);
          }}
        />
      )}
    </section>
  );
};

interface StorageCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const StorageCard: React.FC<StorageCardProps> = ({ icon, label, value }) => (
  <div
    className="rounded-xl p-3 flex flex-col gap-1.5"
    style={{
      backgroundColor: 'var(--chat-bg-secondary)',
    }}
  >
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(201, 168, 124, 0.15)',
        color: 'var(--chat-accent-dark)',
      }}
    >
      {icon}
    </div>
    <div className="text-xs" style={{ color: 'var(--chat-text-tertiary)' }}>
      {label}
    </div>
    <div className="text-sm font-medium" style={{ color: 'var(--chat-text-primary)' }}>
      {value}
    </div>
  </div>
);

interface BackupRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  isLast?: boolean;
}

const BackupRow: React.FC<BackupRowProps> = ({ icon, title, subtitle, onClick, isLast }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/40 ${!isLast ? 'border-b' : ''}`}
    style={{ borderColor: 'var(--chat-divider-soft)' }}
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        backgroundColor: 'rgba(201, 168, 124, 0.12)',
        color: 'var(--chat-accent-dark)',
      }}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium" style={{ color: 'var(--chat-text-primary)' }}>
        {title}
      </div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--chat-text-tertiary)' }}>
        {subtitle}
      </div>
    </div>
    <ChevronRight size={16} style={{ color: 'var(--chat-text-tertiary)' }} />
  </button>
);

interface DangerRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
  isLast?: boolean;
}

const DangerRow: React.FC<DangerRowProps> = ({ icon, title, subtitle, color, onClick, isLast }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/40 ${!isLast ? 'border-b' : ''}`}
    style={{ borderColor: 'var(--chat-divider-soft)' }}
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        backgroundColor: `${color}15`,
        color,
      }}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium" style={{ color }}>
        {title}
      </div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--chat-text-tertiary)' }}>
        {subtitle}
      </div>
    </div>
    <ChevronRight size={16} style={{ color: 'var(--chat-text-tertiary)' }} />
  </button>
);

interface SheetButtonProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  primary?: boolean;
  primaryColor?: string;
}

const SheetButton: React.FC<SheetButtonProps> = ({ icon, title, subtitle, onClick, primary, primaryColor }) => {
  const accent = primaryColor || 'var(--chat-accent)';
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-colors active:opacity-80"
      style={{
        backgroundColor: primary ? accent : 'var(--chat-setting-group-bg)',
        color: primary ? '#fff' : 'var(--chat-text-primary)',
        border: primary ? 'none' : '1px solid var(--chat-divider-soft)',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: primary ? 'rgba(255,255,255,0.2)' : 'rgba(201, 168, 124, 0.12)',
          color: primary ? '#fff' : 'var(--chat-accent-dark)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {title}
        </div>
        <div
          className="text-xs mt-0.5"
          style={{
            color: primary ? 'rgba(255,255,255,0.75)' : 'var(--chat-text-tertiary)',
          }}
        >
          {subtitle}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: primary ? 'rgba(255,255,255,0.7)' : 'var(--chat-text-tertiary)' }} />
    </button>
  );
};

interface BottomSheetProps {
  children: React.ReactNode;
  onClose: () => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ children, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center animate-sheet-overlay"
    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    onClick={onClose}
  >
    <div
      className="w-full max-w-md animate-sheet-content"
      style={{
        backgroundColor: 'var(--chat-bg-secondary)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 16px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-10 h-1 rounded-full mx-auto mb-4"
        style={{ backgroundColor: 'var(--chat-divider-soft)' }}
      />
      {children}
    </div>
  </div>
);

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText: string;
  confirmColor: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmText,
  confirmColor,
  loading,
  onConfirm,
  onCancel,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center px-6"
    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    onClick={onCancel}
  >
    <div
      className="w-full max-w-sm rounded-2xl p-5 space-y-4"
      style={{
        backgroundColor: 'var(--chat-setting-group-bg)',
        color: 'var(--chat-text-primary)',
        border: '1px solid var(--chat-divider-soft)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-base font-medium text-center">{title}</h3>
      <p
        className="text-sm text-center leading-relaxed"
        style={{ color: 'var(--chat-text-secondary)' }}
      >
        {message}
      </p>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors active:opacity-70"
          style={{
            backgroundColor: 'var(--chat-bg-secondary)',
            color: 'var(--chat-text-primary)',
          }}
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors active:opacity-70"
          style={{
            backgroundColor: confirmColor,
            color: '#fff',
          }}
        >
          {loading ? '处理中...' : confirmText}
        </button>
      </div>
    </div>
  </div>
);

export { DataManagementSection };
