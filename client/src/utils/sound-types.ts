export type SoundStyleName =
  | 'classic'
  | 'minimal'
  | 'playful'
  | 'retro'
  | 'nature'
  | 'sci-fi'
  | 'silent';

export interface SoundStyleMeta {
  name: SoundStyleName;
  label: string;
  description: string;
}

export type SoundSceneName =
  | 'me_send'
  | 'ta_send'
  | 'me_pat'
  | 'ta_pat'
  | 'me_call'
  | 'ta_call'
  | 'call_answer'
  | 'call_end';

export type SoundTypeName =
  | 'classic_ding'
  | 'minimal_beep'
  | 'playful_arpeggio'
  | 'retro_pager'
  | 'nature_drop'
  | 'scifi_electronic'
  | 'bright_ring'
  | 'deep_notify'
  | 'bounce_pop'
  | 'silent'
  | 'classic_ring'
  | 'classic_dial';

export type CustomSoundType = 'local' | 'url';

export interface CustomSound {
  id: string;
  name: string;
  type: CustomSoundType;
  dataUrl: string;
  url: string;
  duration: number;
  createdAt: string;
}

export type SceneSoundValue = SoundTypeName | string;

export interface SoundTypeMeta {
  name: SoundTypeName;
  label: string;
  description: string;
  supportsLoop?: boolean;
}

export interface SoundConfig {
  enabled: boolean;
  volume: number;
  sendEnabled: boolean;
  receiveEnabled: boolean;
  patEnabled: boolean;
  callEnabled: boolean;
  style: SoundStyleName;
  sceneSounds: Record<SoundSceneName, SceneSoundValue>;
}

export const DEFAULT_SCENE_SOUNDS: Record<SoundSceneName, SoundTypeName> = {
  me_send: 'classic_ding',
  ta_send: 'classic_ding',
  me_pat: 'bounce_pop',
  ta_pat: 'nature_drop',
  me_call: 'classic_dial',
  ta_call: 'classic_ring',
  call_answer: 'bright_ring',
  call_end: 'deep_notify',
};

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  enabled: true,
  volume: 0.6,
  sendEnabled: true,
  receiveEnabled: true,
  patEnabled: true,
  callEnabled: true,
  style: 'classic',
  sceneSounds: { ...DEFAULT_SCENE_SOUNDS },
};

export const SOUND_STYLE_LIST: SoundStyleMeta[] = [
  { name: 'classic', label: '经典', description: '柔和温暖的默认风格' },
  { name: 'minimal', label: '简约', description: '简短低调，不打扰' },
  { name: 'playful', label: '活泼', description: '明亮欢快，充满活力' },
  { name: 'retro', label: '复古', description: '老式电话与寻呼机感' },
  { name: 'nature', label: '自然', description: '水滴鸟鸣，轻柔舒缓' },
  { name: 'sci-fi', label: '科技感', description: '电子科幻，未来感' },
  { name: 'silent', label: '静音', description: '关闭所有音效' },
];

export const SOUND_TYPE_LIST: SoundTypeMeta[] = [
  { name: 'classic_ding', label: '经典叮咚', description: '柔和双音符' },
  { name: 'minimal_beep', label: '简约单音', description: '短促低调' },
  { name: 'playful_arpeggio', label: '活泼琶音', description: '上升三音符' },
  { name: 'retro_pager', label: '复古寻呼', description: '方波双嘀嘀' },
  { name: 'nature_drop', label: '自然水滴', description: '快速下降水滴' },
  { name: 'scifi_electronic', label: '科技电子', description: '锯齿波扫频' },
  { name: 'bright_ring', label: '清脆铃声', description: '高频双音' },
  { name: 'deep_notify', label: '低沉提示', description: '低频柔和' },
  { name: 'bounce_pop', label: '弹跳音效', description: '弹跳感下降' },
  { name: 'silent', label: '静音', description: '不播放' },
  { name: 'classic_ring', label: '经典铃声', description: '双音来电', supportsLoop: true },
  { name: 'classic_dial', label: '经典拨号', description: '双音拨号', supportsLoop: true },
];

export const SCENE_GROUPS: Array<{
  label: string;
  scenes: Array<{ name: SoundSceneName; label: string }>;
}> = [
  {
    label: '消息音效',
    scenes: [
      { name: 'me_send', label: '我发消息' },
      { name: 'ta_send', label: 'TA发消息' },
    ],
  },
  {
    label: '拍一拍音效',
    scenes: [
      { name: 'me_pat', label: '我拍TA' },
      { name: 'ta_pat', label: 'TA拍我' },
    ],
  },
  {
    label: '电话音效',
    scenes: [
      { name: 'me_call', label: '我打给TA（去电）' },
      { name: 'ta_call', label: 'TA打给我（来电）' },
      { name: 'call_answer', label: '通话接听' },
      { name: 'call_end', label: '通话挂断' },
    ],
  },
];

export const STYLE_SCENE_PRESETS: Record<SoundStyleName, Record<SoundSceneName, SoundTypeName>> = {
  classic: {
    me_send: 'classic_ding',
    ta_send: 'classic_ding',
    me_pat: 'bounce_pop',
    ta_pat: 'nature_drop',
    me_call: 'classic_dial',
    ta_call: 'classic_ring',
    call_answer: 'bright_ring',
    call_end: 'deep_notify',
  },
  minimal: {
    me_send: 'minimal_beep',
    ta_send: 'minimal_beep',
    me_pat: 'minimal_beep',
    ta_pat: 'minimal_beep',
    me_call: 'classic_dial',
    ta_call: 'classic_ring',
    call_answer: 'minimal_beep',
    call_end: 'deep_notify',
  },
  playful: {
    me_send: 'playful_arpeggio',
    ta_send: 'bright_ring',
    me_pat: 'bounce_pop',
    ta_pat: 'bounce_pop',
    me_call: 'classic_dial',
    ta_call: 'classic_ring',
    call_answer: 'bright_ring',
    call_end: 'bounce_pop',
  },
  retro: {
    me_send: 'retro_pager',
    ta_send: 'retro_pager',
    me_pat: 'deep_notify',
    ta_pat: 'deep_notify',
    me_call: 'classic_dial',
    ta_call: 'classic_ring',
    call_answer: 'retro_pager',
    call_end: 'deep_notify',
  },
  nature: {
    me_send: 'nature_drop',
    ta_send: 'nature_drop',
    me_pat: 'nature_drop',
    ta_pat: 'nature_drop',
    me_call: 'classic_dial',
    ta_call: 'classic_ring',
    call_answer: 'bright_ring',
    call_end: 'deep_notify',
  },
  'sci-fi': {
    me_send: 'scifi_electronic',
    ta_send: 'scifi_electronic',
    me_pat: 'scifi_electronic',
    ta_pat: 'scifi_electronic',
    me_call: 'classic_dial',
    ta_call: 'classic_ring',
    call_answer: 'bright_ring',
    call_end: 'scifi_electronic',
  },
  silent: {
    me_send: 'silent',
    ta_send: 'silent',
    me_pat: 'silent',
    ta_pat: 'silent',
    me_call: 'silent',
    ta_call: 'silent',
    call_answer: 'silent',
    call_end: 'silent',
  },
};
