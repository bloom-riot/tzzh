import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Image as ImageIcon,
  Camera,
  Trash2,
  RefreshCw,
  MessageSquareQuote,
  CheckCircle2,
  EyeOff,
  Pencil,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  useProfile,
  DEFAULT_TA_AVATAR,
  DEFAULT_MY_AVATAR,
  useChatConfig,
  useRhythmConfig,
  useCustomBackgrounds,
  useSoundConfig,
} from '@client/src/hooks/use-local-storage';
import { playSound, initAudioContext, getSoundLibrary, previewSound, uploadCustomSound, addUrlCustomSound, deleteCustomSound, getCustomSounds, loadCustomSounds, isCustomSoundValue, buildCustomSoundValue, getCustomSoundId } from '@client/src/utils/sound-manager';
import type { SoundSceneName, SoundTypeName, CustomSound, SceneSoundValue } from '@client/src/utils/sound-types';
import { SCENE_GROUPS } from '@client/src/utils/sound-types';
import { DEFAULT_RHYTHM_CONFIG, DEFAULT_CHAT_CONFIG } from '@client/src/utils/local-storage';
import { Image as AvatarImage } from '@client/src/components/ui/image';
import { Image } from '@client/src/components/ui/image';
import { RhythmSlider, RhythmSwitchRow, ProbabilitySlider, ResetProbabilitiesButton } from './RhythmComponents';
import { DataManagementSection } from './DataManagementSection';

const AVATAR_MAX_SIZE = 128;
const AVATAR_QUALITY = 0.8;
const BG_MAX_WIDTH = 800;
const BG_QUALITY = 0.75;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = AVATAR_MAX_SIZE;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', AVATAR_QUALITY);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { profile, updateProfile, taAvatarUrl, myAvatarUrl, chatBgThemes, chatBgTheme, reloadProfile } = useProfile();
  const { items: customBgs, add: addCustomBg, remove: removeCustomBg } = useCustomBackgrounds();
  const { config: chatConfig, updateConfig: updateChatConfig } = useChatConfig();
  const { config: rhythmConfig, updateConfig: updateRhythmConfig } = useRhythmConfig();
  const { config: soundConfig, updateConfig: updateSoundConfig } = useSoundConfig();
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [uploadingSound, setUploadingSound] = useState(false);
  const [soundUploadError, setSoundUploadError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlSoundInput, setUrlSoundInput] = useState('');
  const [addingUrlSound, setAddingUrlSound] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const list = await loadCustomSounds();
      setCustomSounds(list);
    })();
   }, []);

   const handleAddUrlSound = useCallback(async () => {
     const url = urlSoundInput.trim();
     if (!url) return;
     setAddingUrlSound(true);
     setSoundUploadError('');
     try {
       const record = await addUrlCustomSound(url);
       setCustomSounds((prev) => [...prev, record]);
       setUrlSoundInput('');
       setShowUrlInput(false);
     } catch (err) {
       setSoundUploadError(err instanceof Error ? err.message : '添加失败');
     } finally {
       setAddingUrlSound(false);
     }
   }, [urlSoundInput]);

   const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const handleBgPushToggle = useCallback(async (enabled: boolean) => {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
      } catch {
        // ignore
      }
    }
    updateRhythmConfig({ backgroundPushEnabled: enabled });
  }, [updateRhythmConfig]);

  const formatReplySec = (s: number): string =>
    s >= 60 ? `${(s / 60).toFixed(1)}分钟` : `${s}秒`;
  const formatProactiveInterval = (m: number): string =>
    m >= 60 ? `${(m / 60).toFixed(1)}小时` : `${m}分钟`;
  const formatSurveySeconds = (s: number): string => {
    if (s < 60) return `${s}秒`;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
  };

  const [taName, setTaName] = useState('');
  const [myName, setMyName] = useState('');
  const [taAvatarInput, setTaAvatarInput] = useState('');
  const [myAvatarInput, setMyAvatarInput] = useState('');
  const [saved, setSaved] = useState(false);
  const taFileRef = useRef<HTMLInputElement>(null);
  const myFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

    useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setTaName(profile.taName);
      setMyName(profile.myName);
      setTaAvatarInput(profile.taAvatar);
      setMyAvatarInput(profile.myAvatar);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile({
        taName: taName.trim(),
        myName: myName.trim(),
        taAvatar: taAvatarInput,
        myAvatar: myAvatarInput,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      logger.error('保存设置失败', err);
    }
  };

  const handlePickAvatar = useCallback((who: 'ta' | 'me') => {
    const ref = who === 'ta' ? taFileRef : myFileRef;
    ref.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (who: 'ta' | 'me', e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        logger.warn('选择的文件不是图片', file.type);
        return;
      }
      try {
        const dataUrl = await compressImage(file);
        if (who === 'ta') {
          setTaAvatarInput(dataUrl);
        } else {
          setMyAvatarInput(dataUrl);
        }
      } catch (err) {
        logger.error('头像处理失败', err);
      } finally {
        e.target.value = '';
      }
    },
    []
  );

  function compressBgImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(BG_MAX_WIDTH / img.width, 1);
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 canvas'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', BG_QUALITY);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function readBgFile(file: File): Promise<string> {
    if (file.type === 'image/gif') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });
    }
    return compressBgImage(file);
  }

  const handlePickBg = () => {
    bgFileRef.current?.click();
  };

  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    try {
      const dataUrl = await readBgFile(file);
      const item = addCustomBg(dataUrl);
      await updateProfile({ chatBg: 'custom', chatBgImage: item.dataUrl });
    } catch (err) {
      logger.error('背景图处理失败', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleClearBg = () => {
    void updateProfile({ chatBg: 'classic', chatBgImage: '' });
  };

  const handleResetAvatars = () => {
    setTaAvatarInput('');
    setMyAvatarInput('');
    void updateProfile({
      taAvatar: '',
      myAvatar: '',
    });
    void reloadProfile();
  };

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--chat-setting-page-bg)',
        color: 'var(--chat-text-primary)',
      }}
    >
      <header className="flex items-center justify-between px-4 md:px-6 py-4 flex-shrink-0"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: 'var(--chat-text-primary)' }}
          aria-label="返回"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-medium">设置</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-6"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <section>
          <h2
            className="text-sm font-medium mb-3 px-1"
            style={{ color: 'var(--chat-setting-title)' }}
          >
            资料设置
          </h2>
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{
              backgroundColor: 'var(--chat-setting-group-bg)',
              border: '1px solid var(--chat-divider-soft)',
            }}
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handlePickAvatar('ta')}
                  className="relative w-16 h-16 rounded-lg overflow-hidden transition-transform active:scale-95 group"
                  aria-label="上传TA头像"
                >
                  <AvatarImage
                    src={taAvatarInput || DEFAULT_TA_AVATAR}
                    alt="TA头像"
                    className="w-full h-full object-cover"
                    fallbackSrc={DEFAULT_TA_AVATAR}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Camera size={18} style={{ color: 'var(--chat-bubble-me-text)' }} />
                  </div>
                </button>
                <input
                  ref={taFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange('ta', e)}
                />
                <span className="text-xs" style={{ color: 'var(--chat-text-secondary)' }}>
                  TA的头像
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handlePickAvatar('me')}
                  className="relative w-16 h-16 rounded-lg overflow-hidden transition-transform active:scale-95 group"
                  aria-label="上传我的头像"
                >
                  <AvatarImage
                    src={myAvatarInput || DEFAULT_MY_AVATAR}
                    alt="我的头像"
                    className="w-full h-full object-cover"
                    fallbackSrc={DEFAULT_MY_AVATAR}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Camera size={18} style={{ color: 'var(--chat-bubble-me-text)' }} />
                  </div>
                </button>
                <input
                  ref={myFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange('me', e)}
                />
                <span className="text-xs" style={{ color: 'var(--chat-text-secondary)' }}>
                  我的头像
                </span>
              </div>
              <button
                onClick={handleResetAvatars}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    color: 'var(--chat-text-secondary)',
                    backgroundColor: 'var(--chat-surface-secondary)',
                  }}
                >
                  <RefreshCw size={12} />
                  重置默认
              </button>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--chat-text-tertiary)' }}>
              点击头像可从本地选择图片上传，自动压缩后保存到本地浏览器
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'var(--chat-text-secondary)' }}>
                  TA的名字
                </label>
                <input
                  value={taName}
                  onChange={(e) => setTaName(e.target.value)}
                  placeholder="TA"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    color: 'var(--chat-text-primary)',
                    backgroundColor: 'var(--chat-setting-group-bg)',
                    border: '1px solid var(--chat-divider)',
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'var(--chat-text-secondary)' }}>
                  我的名字
                </label>
                <input
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  placeholder="我"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                  color: 'var(--chat-text-primary)',
                  backgroundColor: 'var(--chat-setting-group-bg)',
                  border: '1px solid var(--chat-divider)',
                  }}
                />
              </div>
            </div>


          </div>
        </section>

        <section>
          <h2
            className="text-sm font-medium mb-3 px-1"
            style={{ color: 'var(--chat-setting-title)' }}
          >
            外观设置
          </h2>
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{
              backgroundColor: 'var(--chat-setting-group-bg)',
              border: '1px solid var(--chat-divider-soft)',
            }}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3
                  className="text-sm font-medium"
                  style={{ color: 'var(--chat-setting-title)' }}
                >
                  聊天背景
                </h3>
              </div>
                <p
                  className="text-xs"
                  style={{ color: 'var(--chat-setting-desc)' }}
                >
                支持图片及 GIF 动图。点击 + 添加，点击项目应用。
              </p>
              <div className="flex items-center gap-3 flex-nowrap overflow-x-auto pt-2 pb-1 -mx-1 px-1">
                <label className="relative group cursor-pointer flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105"
                    style={{
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px dashed var(--chat-divider)',
                      color: 'var(--chat-icon-color)',
                    }}
                  >
                    <Plus size={18} />
                  </div>
                  <input
                    ref={bgFileRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleBgFileChange}
                  />
                </label>
                {chatBgThemes.map((theme) => {
                  const isActive = profile.chatBg === theme.id;
                  const bgStyle = theme.bg.startsWith('linear-gradient')
                    || theme.bg.startsWith('radial-gradient')
                    ? { background: theme.bg }
                    : { backgroundColor: theme.bg };
                  return (
                    <button
                      key={theme.id}
                      onClick={() => updateProfile({ chatBg: theme.id, chatBgImage: '' })}
                      className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 transition-all hover:scale-105"
                      style={{
                        ...bgStyle,
                        boxShadow: `0 0 0 2px ${isActive ? 'var(--chat-accent)' : 'var(--chat-divider)'}`,
                      }}
                      aria-label={`选择${theme.name}背景`}
                      title={theme.name}
                    >
                      {isActive && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ backgroundColor: 'var(--chat-overlay)' }}
                        >
                          <Check size={16} style={{ color: 'var(--chat-bubble-me-text)' }} strokeWidth={2.5} />
                        </div>
                      )}
                    </button>
                  );
                })}
                {customBgs.map((bg) => {
                  const isActive = profile.chatBg === 'custom' && profile.chatBgImage === bg.dataUrl;
                  return (
                    <div
                      key={bg.id}
                      className="relative group flex-shrink-0"
                    >
                      <button
                        onClick={() => updateProfile({ chatBg: 'custom', chatBgImage: bg.dataUrl })}
                        className="w-12 h-12 rounded-full overflow-hidden transition-all hover:scale-105"
                        style={{
                          boxShadow: `0 0 0 2px ${isActive ? 'var(--chat-accent)' : 'var(--chat-divider)'}`,
                        }}
                        aria-label="选择自定义背景"
                      >
                        <AvatarImage
                          src={bg.dataUrl}
                          alt="自定义背景"
                          className="w-full h-full object-cover"
                        />
                        {isActive && (
                          <div
                            className="absolute inset-0 flex items-center justify-center rounded-full"
                            style={{ backgroundColor: 'var(--chat-overlay)' }}
                          >
                            <Check size={16} style={{ color: 'var(--chat-bubble-me-text)' }} strokeWidth={2.5} />
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          removeCustomBg(bg.id);
                          if (isActive) {
                            void updateProfile({ chatBg: 'classic', chatBgImage: '' });
                          }
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          style={{
                            backgroundColor: 'var(--chat-danger)',
                            color: 'var(--chat-bubble-me-text)',
                          }}
                        aria-label="删除背景"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleClearBg}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    color: 'var(--chat-text-secondary)',
                    backgroundColor: 'var(--chat-surface-secondary)',
                  }}
                >
                  <RefreshCw size={12} />
                  恢复默认背景
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2
            className="text-sm font-medium mb-3 flex items-center gap-2"
            style={{ color: 'var(--chat-setting-title)' }}
          >
            <MessageSquareQuote size={16} style={{ color: 'var(--chat-accent-dark)' }} />
            聊天设置
          </h2>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--chat-surface-secondary)',
              border: '1px solid var(--chat-divider)',
            }}
          >
            <style>{`
              .rhythm-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:var(--chat-accent);box-shadow:0 2px 6px rgba(0,0,0,.15);cursor:pointer;border:2px solid var(--chat-setting-group-bg)}
              .rhythm-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--chat-accent);box-shadow:0 2px 6px rgba(0,0,0,.15);cursor:pointer;border:2px solid var(--chat-setting-group-bg)}
              .rhythm-range{-webkit-appearance:none;appearance:none;background:transparent;position:relative;z-index:2}
            `}</style>
            <div className="px-4 py-3 text-sm font-medium" style={{ borderBottom: '1px solid var(--chat-divider)', color: 'var(--chat-accent)' }}>
                节奏设置
            </div>

            <div className="py-2">
                 <div className="px-4 pt-2 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                   聊天回复速度
                 </div>
                 <RhythmSlider
                    label="最短等待"
                  value={rhythmConfig.replyMinSeconds}
                  min={1}
                  max={600}
                  displayValue={formatReplySec(rhythmConfig.replyMinSeconds)}
                  onChange={(v) => updateRhythmConfig({ replyMinSeconds: v })}
                />
                <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                <RhythmSlider
                  label="最长等待"
                  value={rhythmConfig.replyMaxSeconds}
                  min={30}
                  max={1800}
                  displayValue={formatReplySec(rhythmConfig.replyMaxSeconds)}
                  onChange={(v) => updateRhythmConfig({ replyMaxSeconds: v })}
                />

                <div className="px-4 pt-4 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                  问卷回复时间
                </div>
                 <RhythmSlider
                   label="最短等待"
                   value={rhythmConfig.surveyMinSeconds}
                   min={1}
                   max={1800}
                   step={1}
                   displayValue={formatSurveySeconds(rhythmConfig.surveyMinSeconds)}
                   onChange={(v) => updateRhythmConfig({ surveyMinSeconds: v })}
                 />
                <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                <RhythmSlider
                  label="最长等待"
                  value={rhythmConfig.surveyMaxSeconds}
                  min={1}
                  max={1800}
                  step={1}
                  displayValue={formatSurveySeconds(rhythmConfig.surveyMaxSeconds)}
                  onChange={(v) => updateRhythmConfig({ surveyMaxSeconds: v })}
                />

                <div className="px-4 pt-4 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                  主动发送
                </div>
                <RhythmSwitchRow
                  label="主动发消息给我"
                  checked={rhythmConfig.proactiveEnabled}
                  onChange={(v) => updateRhythmConfig({ proactiveEnabled: v })}
                />
                {rhythmConfig.proactiveEnabled && (
                  <>
                    <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                    <RhythmSlider
                      label="间隔"
                      value={rhythmConfig.proactiveIntervalMinutes}
                      min={10}
                      max={1440}
                      displayValue={formatProactiveInterval(rhythmConfig.proactiveIntervalMinutes)}
                      onChange={(v) => updateRhythmConfig({ proactiveIntervalMinutes: v })}
                    />
                  </>
                 )}

                  <div className="px-4 pt-4 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                     消息节奏
                  </div>
                 <RhythmSwitchRow
                  label="回复拼接字卡"
                  checked={rhythmConfig.concatEnabled}
                  onChange={(v) => updateRhythmConfig({ concatEnabled: v })}
                />
                {rhythmConfig.concatEnabled && (
                  <>
                    <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                    <RhythmSlider
                      label="最多拼接"
                      value={rhythmConfig.concatMaxSentences}
                      min={1}
                      max={5}
                      step={1}
                      displayValue={`${rhythmConfig.concatMaxSentences}句`}
                      onChange={(v) => updateRhythmConfig({ concatMaxSentences: v })}
                    />
                  </>
                )}

                 <div className="px-4 pt-4 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                    后台运行
                  </div>
                 <div>
                   <RhythmSwitchRow
                     label="后台消息推送"
                     checked={rhythmConfig.backgroundPushEnabled}
                     onChange={handleBgPushToggle}
                   />
                   {rhythmConfig.backgroundPushEnabled && notifPermission === 'denied' && (
                      <div className="px-4 pb-3 pt-1 text-xs" style={{ color: 'var(--chat-danger)' }}>
                       ❌ 通知权限已被浏览器屏蔽，请自行搜索如何开启
                     </div>
                   )}
                 </div>
                 <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                 <RhythmSwitchRow
                   label="后台保活"
                   checked={rhythmConfig.backgroundKeepAlive}
                   onChange={(v) => updateRhythmConfig({ backgroundKeepAlive: v })}
                 />

                 <div className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                   已读不回
                 </div>
                 <ChatSettingItem
                   icon={<EyeOff size={16} />}
                   title="已读不回"
                   desc="TA有一定概率只已读不回复"
                   checked={chatConfig.readWithoutReply}
                   onChange={(v) => updateChatConfig({ readWithoutReply: v })}
                 />
                 {chatConfig.readWithoutReply && (
                   <>
                     <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '48px' }} />
                     <ProbabilitySlider
                       label="已读不回概率"
                       desc="TA 已读后选择不回复的概率"
                       value={chatConfig.readWithoutReplyRate}
                       max={50}
                       onChange={(v) => updateChatConfig({ readWithoutReplyRate: v })}
                     />
                   </>
                 )}

                 <div className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                   概率可视化管理
                 </div>

                 <div className="px-4 pt-2 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                   回复节奏
                 </div>
                  <ProbabilitySlider
                    label="拍一拍概率"
                    desc="TA 在聊天中主动拍一拍你的概率"
                    value={rhythmConfig.patPatFrequency}
                    max={80}
                    onChange={(v) => updateRhythmConfig({ patPatFrequency: v })}
                  />

                 <div className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                   内容类型
                 </div>
                 <ProbabilitySlider
                   label="Emoji 回复概率"
                   desc="文字回复后附加 1-3 个 Emoji 的概率"
                   value={rhythmConfig.emojiReplyProbability}
                   onChange={(v) => updateRhythmConfig({ emojiReplyProbability: v })}
                 />
                 <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                 <ProbabilitySlider
                   label="表情包回复概率"
                   desc="TA 用表情包图片回复的概率（优先于文字）"
                   value={rhythmConfig.stickerReplyProbability}
                   onChange={(v) => updateRhythmConfig({ stickerReplyProbability: v })}
                  />

                  <div className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--chat-setting-desc)' }}>
                    互动行为
                 </div>
                 <ProbabilitySlider
                   label="引用回复概率"
                   desc="TA 回复时引用你上一条消息的概率"
                   value={rhythmConfig.quoteReplyProbability}
                   onChange={(v) => updateRhythmConfig({ quoteReplyProbability: v })}
                 />
                 <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                  <ProbabilitySlider
                    label="撤回概率"
                    desc="TA 发送消息后撤回的概率（2-5秒后撤回）"
                    value={rhythmConfig.recallProbability}
                    max={50}
                    onChange={(v) => updateRhythmConfig({ recallProbability: v })}
                  />
                   <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                  <ProbabilitySlider
                    label="TA 主动来电概率"
                    desc="每次 TA 回复后主动打给你的概率"
                    value={rhythmConfig.incomingCallProbability}
                    max={30}
                    onChange={(v) => updateRhythmConfig({ incomingCallProbability: v })}
                   />
                    <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
                    <ResetProbabilitiesButton
                    onClick={() => {
                      updateRhythmConfig({
                         concatProbability: DEFAULT_RHYTHM_CONFIG.concatProbability,
                        emojiReplyProbability: DEFAULT_RHYTHM_CONFIG.emojiReplyProbability,
                         stickerReplyProbability: DEFAULT_RHYTHM_CONFIG.stickerReplyProbability,
                         quoteReplyProbability: DEFAULT_RHYTHM_CONFIG.quoteReplyProbability,
                         recallProbability: DEFAULT_RHYTHM_CONFIG.recallProbability,
                           incomingCallProbability: DEFAULT_RHYTHM_CONFIG.incomingCallProbability,
                         });
                      updateChatConfig({
                        readWithoutReplyRate: DEFAULT_CHAT_CONFIG.readWithoutReplyRate,
                      });
                    }}
                  />
               </div>
          </div>
           <p
             className="text-xs mt-2 px-1 leading-relaxed"
              style={{ color: 'var(--chat-setting-desc)' }}
            >
              聊天设置实时保存，关闭后立即生效
           </p>
         </section>

         <section>
           <h2
             className="text-sm font-medium mb-3 px-1"
             style={{ color: 'var(--chat-setting-title)' }}
           >
             音效设置
           </h2>
            <div
              className="rounded-2xl py-2 mb-4"
              style={{
                backgroundColor: 'var(--chat-setting-group-bg)',
                border: '1px solid var(--chat-divider-soft)',
              }}
             >
               <div className="px-4 py-3">
                 <div className="flex items-center justify-between mb-3">
                  <span className="text-sm" style={{ color: 'var(--chat-setting-title)' }}>
                    自定义铃声
                  </span>
                   <button
                     onClick={() => {
                       initAudioContext();
                       fileInputRef.current?.click();
                     }}
                     disabled={uploadingSound}
                     className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors active:opacity-70 disabled:opacity-50"
                     style={{
                       backgroundColor: 'var(--chat-accent)',
                       color: 'white',
                     }}
                   >
                     <span>+</span>
                     <span>上传铃声</span>
                   </button>
                   <button
                     onClick={() => {
                       initAudioContext();
                       setShowUrlInput((v) => !v);
                       setSoundUploadError('');
                     }}
                     className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors active:opacity-70"
                     style={{
                       backgroundColor: 'var(--chat-setting-group-bg)',
                       color: 'var(--chat-accent)',
                       border: '1px solid var(--chat-divider-soft)',
                     }}
                   >
                     <span>🌐</span>
                     <span>网络铃声</span>
                   </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingSound(true);
                    setSoundUploadError('');
                    try {
                      const record = await uploadCustomSound(file);
                      setCustomSounds((prev) => [...prev, record]);
                    } catch (err) {
                      setSoundUploadError(err instanceof Error ? err.message : '上传失败');
                    } finally {
                      setUploadingSound(false);
                    }
                  }}
                 />
                 {showUrlInput && (
                   <div className="flex items-center gap-2 mb-3">
                     <input
                       type="text"
                       value={urlSoundInput}
                       onChange={(e) => setUrlSoundInput(e.target.value)}
                       placeholder="粘贴音频链接（mp3/wav/ogg等）"
                       className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                       style={{
                         backgroundColor: 'var(--chat-setting-group-bg)',
                         color: 'var(--chat-text-primary)',
                         border: '1px solid var(--chat-divider-soft)',
                       }}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           e.preventDefault();
                           void handleAddUrlSound();
                         }
                       }}
                     />
                     <button
                       onClick={() => { void handleAddUrlSound(); }}
                       disabled={addingUrlSound || !urlSoundInput.trim()}
                       className="px-3 py-2 rounded-lg text-xs transition-colors active:opacity-70 disabled:opacity-50"
                       style={{
                         backgroundColor: 'var(--chat-accent)',
                         color: 'white',
                       }}
                     >
                       {addingUrlSound ? '添加中…' : '添加'}
                     </button>
                   </div>
                 )}
                 {soundUploadError && (
                  <p className="text-xs mb-2" style={{ color: 'var(--chat-error-color, #ef4444)' }}>
                    {soundUploadError}
                  </p>
                )}
                {customSounds.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--chat-setting-desc)' }}>
                    还没有自定义铃声，点击右上角上传
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customSounds.map((sound) => (
                      <div
                        key={sound.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                        style={{
                          backgroundColor: 'var(--chat-bg-secondary)',
                          border: '1px solid var(--chat-divider-soft)',
                        }}
                      >
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-1.5">
                             <p
                               className="text-sm truncate"
                               style={{ color: 'var(--chat-text-primary)' }}
                             >
                               {sound.name}
                             </p>
                             {sound.type === 'url' && (
                               <span
                                 className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded"
                                 style={{
                                   backgroundColor: 'var(--chat-accent-light, rgba(201, 168, 124, 0.15))',
                                   color: 'var(--chat-accent)',
                                 }}
                               >
                                 🌐 网络
                               </span>
                             )}
                           </div>
                           <p className="text-xs" style={{ color: 'var(--chat-setting-desc)' }}>
                             {sound.duration > 0 ? `${Math.round(sound.duration)} 秒` : ''}
                           </p>
                         </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              initAudioContext();
                              previewSound(buildCustomSoundValue(sound.id));
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs transition-colors active:opacity-70"
                            style={{
                              backgroundColor: 'var(--chat-setting-group-bg)',
                              color: 'var(--chat-accent)',
                              border: '1px solid var(--chat-divider-soft)',
                            }}
                          >
                            试听
                          </button>
                          <button
                            onClick={async () => {
                              const nextSceneSounds = await deleteCustomSound(sound.id, soundConfig.sceneSounds);
                              setCustomSounds((prev) => prev.filter((s) => s.id !== sound.id));
                              const changed = Object.keys(nextSceneSounds).some(
                                (k) => nextSceneSounds[k as SoundSceneName] !== soundConfig.sceneSounds[k as SoundSceneName]
                              );
                              if (changed) {
                                updateSoundConfig({ sceneSounds: nextSceneSounds });
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs transition-colors active:opacity-70"
                            style={{
                              backgroundColor: 'var(--chat-setting-group-bg)',
                              color: 'var(--chat-error-color, #ef4444)',
                              border: '1px solid var(--chat-divider-soft)',
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                 <p className="text-xs mt-2" style={{ color: 'var(--chat-setting-desc)' }}>
                   支持 mp3、wav、ogg、m4a、aac 等格式；本地文件不超过 10MB，网络铃声需为可访问的音频直链
                 </p>
              </div>
              <div style={{ borderTop: '1px solid var(--chat-divider-soft)', marginLeft: '16px' }} />
              <div className="px-4 py-3">
                <span className="text-sm block mb-3" style={{ color: 'var(--chat-setting-title)' }}>
                  逐场景自定义
                </span>
                <div className="space-y-4">
                  {SCENE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p
                        className="text-xs mb-2 font-medium"
                        style={{ color: 'var(--chat-setting-desc)' }}
                      >
                        {group.label}
                      </p>
                      <div className="space-y-2">
                        {group.scenes.map((scene) => {
                          const currentValue: SceneSoundValue =
                            soundConfig.sceneSounds[scene.name] || 'classic_ding';
                          const isLoopScene = scene.name === 'me_call' || scene.name === 'ta_call';
                          const currentLabel = isCustomSoundValue(currentValue)
                            ? customSounds.find((s) => s.id === getCustomSoundId(currentValue))?.name || '自定义铃声'
                            : getSoundLibrary().find((s) => s.name === currentValue)?.label || String(currentValue);
                          return (
                            <div
                              key={scene.name}
                              className="flex items-center justify-between gap-3"
                            >
                              <span
                                className="text-sm flex-shrink-0"
                                style={{ color: 'var(--chat-text-primary)' }}
                              >
                                {scene.label}
                              </span>
                              <div className="flex items-center gap-2 flex-1 justify-end">
                                <div className="relative flex-1 max-w-40">
                                  <select
                                    value={currentValue}
                                    onChange={(e) => {
                                      initAudioContext();
                                      const nextValue = e.target.value as SceneSoundValue;
                                      const nextSceneSounds = {
                                        ...soundConfig.sceneSounds,
                                        [scene.name]: nextValue,
                                      };
                                      updateSoundConfig({
                                        ...soundConfig,
                                        sceneSounds: nextSceneSounds,
                                      });
                                    }}
                                    className="w-full appearance-none rounded-lg px-3 py-1.5 text-sm pr-8 cursor-pointer"
                                    style={{
                                      backgroundColor: 'var(--chat-bg-secondary)',
                                      color: 'var(--chat-text-primary)',
                                      border: '1px solid var(--chat-divider-soft)',
                                    }}
                                  >
                                    {getSoundLibrary()
                                      .filter((s) => {
                                        if (isLoopScene) {
                                          return s.supportsLoop || s.name === 'silent';
                                        }
                                        return !s.supportsLoop;
                                      })
                                      .map((s) => (
                                        <option key={s.name} value={s.name}>
                                          {s.label}
                                        </option>
                                      ))}
                                    {customSounds.length > 0 && (
                                      <optgroup label="自定义铃声">
                                        {customSounds.map((s) => (
                                          <option key={s.id} value={buildCustomSoundValue(s.id)}>
                                            {s.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                  <span
                                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{ color: 'var(--chat-setting-desc)' }}
                                  >
                                    ▾
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    initAudioContext();
                                    previewSound(currentValue);
                                  }}
                                  className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs transition-colors active:opacity-70"
                                  style={{
                                    backgroundColor: 'var(--chat-bg-secondary)',
                                    color: 'var(--chat-accent)',
                                    border: '1px solid var(--chat-divider-soft)',
                                  }}
                                >
                                  试听
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p
              className="text-xs mt-2 px-1 leading-relaxed"
              style={{ color: 'var(--chat-setting-desc)' }}
            >
              首次使用需在页面有过交互后才能播放音效
            </p>
         </section>

        <DataManagementSection />

        <section className="pt-2">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-opacity active:opacity-80"
             style={{
               backgroundColor: 'var(--chat-accent)',
               color: 'var(--chat-bubble-me-text)',
             }}
          >
            <Save size={16} />
            {saved ? '已保存' : '保存设置'}
          </button>
           <p
             className="text-xs text-center mt-3 leading-relaxed"
             style={{ color: 'var(--chat-text-tertiary)' }}
           >
             所有设置保存在你的本地浏览器中，不会上传到云端
          </p>
        </section>
      </div>
    </div>
  );
};

interface ChatSettingItemProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ChatSettingItem: React.FC<ChatSettingItemProps> = ({ icon, title, desc, checked, onChange }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/40"
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
         <div className="text-sm font-medium" style={{ color: 'var(--chat-setting-title)' }}>
          {title}
        </div>
        <div
           className="text-xs mt-0.5 truncate"
           style={{ color: 'var(--chat-setting-desc)' }}
         >
          {desc}
        </div>
      </div>
      <div
        className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors"
        style={{
           backgroundColor: checked ? 'var(--chat-accent)' : 'var(--chat-divider)',
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{
            left: checked ? '22px' : '2px',
          }}
        />
      </div>
    </button>
  );
};

export default SettingsPage;
