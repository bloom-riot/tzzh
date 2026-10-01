import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  DEFAULT_SCENE_SOUNDS,
  DEFAULT_SOUND_CONFIG,
  SOUND_STYLE_LIST,
  SOUND_TYPE_LIST,
  STYLE_SCENE_PRESETS,
  type CustomSound,
  type SceneSoundValue,
  type SoundConfig,
  type SoundSceneName,
  type SoundStyleMeta,
  type SoundStyleName,
  type SoundTypeMeta,
  type SoundTypeName,
} from './sound-types';
import { getSoundConfig } from './local-storage';
import {
  addCustomSound,
  deleteCustomSound as idbDeleteCustomSound,
  getAllCustomSounds,
} from './indexed-db';

type ToneShape = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface ToneSpec {
  freq: number;
  duration: number;
  delay?: number;
  shape?: ToneShape;
  peakGain?: number;
  attack?: number;
  release?: number;
  freqEnd?: number;
  sweepEasing?: 'linear' | 'exponential';
}

interface NoiseSpec {
  duration: number;
  delay?: number;
  peakGain?: number;
  attack?: number;
  release?: number;
  filterFreq?: number;
  isNoise: true;
}

interface LoopPatternSpec {
  tones: Array<{ freq: number; duration: number; delay: number; shape?: ToneShape }>;
  totalDuration: number;
  interval: number;
  peakGain: number;
}

interface OneShotSoundDef {
  kind: 'oneshot';
  specs: (ToneSpec | NoiseSpec)[];
}

interface LoopSoundDef {
  kind: 'loop';
  pattern: LoopPatternSpec;
}

type SoundDef = OneShotSoundDef | LoopSoundDef;

const SOUND_LIBRARY: Record<SoundTypeName, SoundDef> = {
  classic_ding: {
    kind: 'oneshot',
    specs: [
      { freq: 880, duration: 0.12, shape: 'sine', peakGain: 0.25, attack: 0.02, release: 0.02 },
      { freq: 1175, duration: 0.18, delay: 0.1, shape: 'sine', peakGain: 0.22, attack: 0.02, release: 0.03 },
    ],
  },

  minimal_beep: {
    kind: 'oneshot',
    specs: [
      { freq: 740, duration: 0.1, shape: 'sine', peakGain: 0.16, attack: 0.01, release: 0.02 },
    ],
  },

  playful_arpeggio: {
    kind: 'oneshot',
    specs: [
      { freq: 523, duration: 0.06, shape: 'sine', peakGain: 0.22, attack: 0.005, release: 0.01 },
      { freq: 659, duration: 0.06, delay: 0.05, shape: 'sine', peakGain: 0.22, attack: 0.005, release: 0.01 },
      { freq: 784, duration: 0.08, delay: 0.1, shape: 'sine', peakGain: 0.24, attack: 0.005, release: 0.02 },
    ],
  },

  retro_pager: {
    kind: 'oneshot',
    specs: [
      { freq: 900, duration: 0.08, shape: 'square', peakGain: 0.14, attack: 0.005, release: 0.01 },
      { freq: 900, duration: 0.08, delay: 0.12, shape: 'square', peakGain: 0.14, attack: 0.005, release: 0.01 },
    ],
  },

  nature_drop: {
    kind: 'oneshot',
    specs: [
      {
        freq: 1200,
        freqEnd: 400,
        duration: 0.15,
        shape: 'sine',
        peakGain: 0.22,
        sweepEasing: 'exponential',
        attack: 0.005,
        release: 0.04,
      },
    ],
  },

  scifi_electronic: {
    kind: 'oneshot',
    specs: [
      {
        freq: 300,
        freqEnd: 1600,
        duration: 0.15,
        shape: 'sawtooth',
        peakGain: 0.14,
        sweepEasing: 'exponential',
        attack: 0.005,
        release: 0.02,
      },
    ],
  },

  bright_ring: {
    kind: 'oneshot',
    specs: [
      { freq: 1318, duration: 0.1, shape: 'sine', peakGain: 0.22, attack: 0.01, release: 0.02 },
      { freq: 1568, duration: 0.15, delay: 0.08, shape: 'sine', peakGain: 0.2, attack: 0.01, release: 0.03 },
    ],
  },

  deep_notify: {
    kind: 'oneshot',
    specs: [
      {
        freq: 220,
        freqEnd: 110,
        duration: 0.25,
        shape: 'sine',
        peakGain: 0.2,
        sweepEasing: 'exponential',
        attack: 0.01,
        release: 0.05,
      },
    ],
  },

  bounce_pop: {
    kind: 'oneshot',
    specs: [
      {
        freq: 600,
        freqEnd: 200,
        duration: 0.09,
        shape: 'sine',
        peakGain: 0.22,
        sweepEasing: 'exponential',
        attack: 0.005,
        release: 0.015,
      },
      {
        freq: 800,
        freqEnd: 300,
        duration: 0.08,
        delay: 0.07,
        shape: 'sine',
        peakGain: 0.18,
        sweepEasing: 'exponential',
        attack: 0.005,
        release: 0.015,
      },
    ],
  },

  silent: {
    kind: 'oneshot',
    specs: [],
  },

  classic_ring: {
    kind: 'loop',
    pattern: {
      tones: [
        { freq: 523, duration: 0.15, delay: 0, shape: 'sine' },
        { freq: 659, duration: 0.15, delay: 0, shape: 'sine' },
        { freq: 523, duration: 0.15, delay: 0.18, shape: 'sine' },
        { freq: 659, duration: 0.15, delay: 0.18, shape: 'sine' },
      ],
      totalDuration: 0.6,
      interval: 2.2,
      peakGain: 0.22,
    },
  },

  classic_dial: {
    kind: 'loop',
    pattern: {
      tones: [
        { freq: 350, duration: 0.4, delay: 0, shape: 'sine' },
        { freq: 440, duration: 0.4, delay: 0, shape: 'sine' },
      ],
      totalDuration: 1.0,
      interval: 1.0,
      peakGain: 0.18,
    },
  },
};

let audioCtx: AudioContext | null = null;
let config: SoundConfig = DEFAULT_SOUND_CONFIG;
let lastPlayAt: Record<string, number> = {};
const THROTTLE_MS: Partial<Record<SoundSceneName, number>> = {
  ta_send: 1000,
};

let activeLoops: Record<string, { stop: () => void } | null> = {
  me_call: null,
  ta_call: null,
};

const CUSTOM_SOUND_PREFIX = 'custom:';
let customSoundsCache: CustomSound[] = [];
let customSoundsLoaded = false;
let customAudioEl: HTMLAudioElement | null = null;
let customLoopAudio: Record<string, HTMLAudioElement | null> = {
  me_call: null,
  ta_call: null,
};

export function isCustomSoundValue(value: SceneSoundValue): boolean {
  return typeof value === 'string' && value.startsWith(CUSTOM_SOUND_PREFIX);
}

export function getCustomSoundId(value: SceneSoundValue): string {
  if (typeof value !== 'string' || !value.startsWith(CUSTOM_SOUND_PREFIX)) return '';
  return value.slice(CUSTOM_SOUND_PREFIX.length);
}

export function buildCustomSoundValue(id: string): string {
  return `${CUSTOM_SOUND_PREFIX}${id}`;
}

function getCustomSoundById(id: string): CustomSound | undefined {
  return customSoundsCache.find((s) => s.id === id);
}

export async function loadCustomSounds(): Promise<CustomSound[]> {
  try {
    const list = await getAllCustomSounds();
    customSoundsCache = list;
    customSoundsLoaded = true;
    return list;
  } catch (e) {
    logger.error('加载自定义铃声失败', String(e));
    customSoundsCache = [];
    customSoundsLoaded = true;
    return [];
  }
}

export function getCustomSounds(): CustomSound[] {
  return customSoundsCache;
}

export async function uploadCustomSound(file: File): Promise<CustomSound> {
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('文件大小不能超过 10MB');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
  if (!dataUrl) throw new Error('读取音频文件失败');

  const duration = await new Promise<number>((resolve) => {
    const audio = new Audio(dataUrl);
    audio.addEventListener('loadedmetadata', () => {
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    });
    audio.addEventListener('error', () => resolve(0));
  });

  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const name = file.name.replace(/\.[^.]+$/, '');
  const record: CustomSound = {
    id,
    name,
    type: 'local',
    dataUrl,
    url: '',
    duration,
    createdAt: new Date().toISOString(),
  };
  await addCustomSound(record);
  customSoundsCache.push(record);
  return record;
}

export async function addUrlCustomSound(url: string): Promise<CustomSound> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('请输入有效的 http 或 https 链接');
  }
  let name = '网络铃声';
  try {
    const u = new URL(url);
    const pathName = u.pathname.split('/').filter(Boolean).pop();
    if (pathName) {
      name = decodeURIComponent(pathName.replace(/\.[^.]+$/, '')) || '网络铃声';
    }
  } catch {
    // 解析失败用默认名
  }
  const duration = await new Promise<number>((resolve) => {
    try {
      const audio = new Audio(url);
      const timer = window.setTimeout(() => {
        try { audio.pause(); } catch { /* ignore */ }
        resolve(0);
      }, 8000);
      audio.addEventListener('loadedmetadata', () => {
        clearTimeout(timer);
        resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      });
      audio.addEventListener('error', () => {
        clearTimeout(timer);
        resolve(0);
      });
    } catch {
      resolve(0);
    }
  });

  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: CustomSound = {
    id,
    name,
    type: 'url',
    dataUrl: '',
    url,
    duration,
    createdAt: new Date().toISOString(),
  };
  await addCustomSound(record);
  customSoundsCache.push(record);
  return record;
}

export async function deleteCustomSound(id: string, sceneSounds: Record<SoundSceneName, SceneSoundValue>): Promise<Record<SoundSceneName, SceneSoundValue>> {
  try {
    await idbDeleteCustomSound(id);
  } catch (e) {
    logger.error('删除自定义铃声失败', String(e));
  }
  customSoundsCache = customSoundsCache.filter((s) => s.id !== id);
  stopAllCustomSounds();
  const customValue = buildCustomSoundValue(id);
  const nextSceneSounds = { ...sceneSounds };
  (Object.keys(nextSceneSounds) as SoundSceneName[]).forEach((scene) => {
    if (nextSceneSounds[scene] === customValue) {
      nextSceneSounds[scene] = DEFAULT_SCENE_SOUNDS[scene];
    }
  });
  return nextSceneSounds;
}

function stopAllCustomSounds(): void {
  if (customAudioEl) {
    try { customAudioEl.pause(); } catch { /* ignore */ }
    customAudioEl = null;
  }
  Object.keys(customLoopAudio).forEach((k) => {
    const el = customLoopAudio[k];
    if (el) {
      try { el.pause(); } catch { /* ignore */ }
      customLoopAudio[k] = null;
    }
  });
}

function getCustomSoundSrc(custom: CustomSound): string {
  if (custom.type === 'url' && custom.url) return custom.url;
  return custom.dataUrl;
}

function playCustomOneShot(custom: CustomSound): void {
  if (!config.enabled) return;
  try {
    if (customAudioEl) {
      try { customAudioEl.pause(); } catch { /* ignore */ }
    }
    const src = getCustomSoundSrc(custom);
    const audio = new Audio(src);
    audio.volume = config.volume;
    audio.play().catch((e) => {
      logger.warn('自定义音效播放失败', String(e));
    });
    customAudioEl = audio;
  } catch (e) {
    logger.error('播放自定义音效失败', String(e));
  }
}

function playCustomLoop(scene: SoundSceneName, custom: CustomSound): void {
  if (!config.enabled) return;
  try {
    const existing = customLoopAudio[scene];
    if (existing) {
      try { existing.pause(); } catch { /* ignore */ }
      customLoopAudio[scene] = null;
    }
    const src = getCustomSoundSrc(custom);
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = config.volume;
    audio.play().catch((e) => {
      logger.warn('自定义循环音效播放失败', String(e));
    });
    customLoopAudio[scene] = audio;
  } catch (e) {
    logger.error('播放自定义循环音效失败', String(e));
  }
}

function stopCustomLoop(scene: SoundSceneName): void {
  const audio = customLoopAudio[scene];
  if (audio) {
    try { audio.pause(); } catch { /* ignore */ }
    customLoopAudio[scene] = null;
  }
}

function ensureCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    loadConfig();
    return audioCtx;
  } catch (err) {
    logger.error('创建 AudioContext 失败', err);
    return null;
  }
}

export function initAudioContext(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      // ignore
    });
  }
}

export function loadConfig(): void {
  try {
    const saved = getSoundConfig();
    config = saved;
  } catch {
    config = DEFAULT_SOUND_CONFIG;
  }
}

export function updateSoundConfig(next: SoundConfig): void {
  config = next;
}

export function getSoundStyles(): SoundStyleMeta[] {
  return SOUND_STYLE_LIST;
}

export function getSoundLibrary(): SoundTypeMeta[] {
  return SOUND_TYPE_LIST;
}

export function getSceneSound(scene: SoundSceneName): SceneSoundValue {
  return config.sceneSounds[scene] ?? DEFAULT_SCENE_SOUNDS[scene];
}

export function setSceneSound(scene: SoundSceneName, type: SceneSoundValue): void {
  config = {
    ...config,
    sceneSounds: { ...config.sceneSounds, [scene]: type },
  };
}

export function applyStylePreset(style: SoundStyleName): Record<SoundSceneName, SoundTypeName> {
  return STYLE_SCENE_PRESETS[style] ?? STYLE_SCENE_PRESETS.classic;
}

function isLoopScene(scene: SoundSceneName): boolean {
  return scene === 'me_call' || scene === 'ta_call';
}

function isSilentValue(type: SceneSoundValue): boolean {
  return type === 'silent';
}

function canPlay(scene: SoundSceneName): boolean {
  if (!config.enabled) return false;
  const type = getSceneSound(scene);
  if (isSilentValue(type)) return false;
  const throttle = THROTTLE_MS[scene];
  if (throttle) {
    const now = performance.now();
    const last = lastPlayAt[scene] ?? 0;
    if (now - last < throttle) return false;
    lastPlayAt[scene] = now;
  }
  return true;
}

function isNoiseSpec(spec: ToneSpec | NoiseSpec): spec is NoiseSpec {
  return (spec as NoiseSpec).isNoise === true;
}

function playToneSpec(ctx: AudioContext, spec: ToneSpec, baseTime: number, volumeMul: number): void {
  const startTime = baseTime + (spec.delay ?? 0);
  const duration = spec.duration;
  const shape = spec.shape ?? 'sine';
  const peakGain = (spec.peakGain ?? 0.2) * config.volume * volumeMul;
  const attack = spec.attack ?? 0.01;
  const release = spec.release ?? 0.02;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(spec.freq, startTime);

  if (spec.freqEnd !== undefined && spec.freqEnd !== spec.freq) {
    if (spec.sweepEasing === 'exponential') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(spec.freqEnd, 1), startTime + duration);
    } else {
      osc.frequency.linearRampToValueAtTime(spec.freqEnd, startTime + duration);
    }
  }

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  const sustainEnd = startTime + Math.max(attack, duration - release);
  gain.gain.setValueAtTime(peakGain, sustainEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playNoiseSpec(ctx: AudioContext, spec: NoiseSpec, baseTime: number, volumeMul: number): void {
  const startTime = baseTime + (spec.delay ?? 0);
  const duration = spec.duration;
  const peakGain = (spec.peakGain ?? 0.1) * config.volume * volumeMul;
  const attack = spec.attack ?? 0.01;
  const release = spec.release ?? 0.05;
  const filterFreq = spec.filterFreq ?? 2000;

  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  const sustainEnd = startTime + Math.max(attack, duration - release);
  gain.gain.setValueAtTime(peakGain, sustainEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(startTime);
  source.stop(startTime + duration + 0.02);
}

function playOneShotDef(ctx: AudioContext, def: OneShotSoundDef, volumeMul = 1): void {
  if (def.specs.length === 0) return;
  const t = ctx.currentTime;
  def.specs.forEach((spec) => {
    if (isNoiseSpec(spec)) {
      playNoiseSpec(ctx, spec, t, volumeMul);
    } else {
      playToneSpec(ctx, spec, t, volumeMul);
    }
  });
}

function getSoundDef(type: SoundTypeName): SoundDef | null {
  return SOUND_LIBRARY[type] ?? null;
}

export function playSound(scene: SoundSceneName): void {
  if (!canPlay(scene)) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  try {
    const type = getSceneSound(scene);
    if (isCustomSoundValue(type)) {
      const customId = getCustomSoundId(type);
      const custom = getCustomSoundById(customId);
      if (!custom) return;
      if (isLoopScene(scene)) {
        startLoop(scene);
        return;
      }
      playCustomOneShot(custom);
      return;
    }
    const def = getSoundDef(type as SoundTypeName);
    if (!def) return;
    if (isLoopScene(scene)) {
      startLoop(scene);
      return;
    }
    if (def.kind === 'oneshot') {
      playOneShotDef(ctx, def);
    } else {
      playOneShotDef(
        ctx,
        {
          kind: 'oneshot',
          specs: def.pattern.tones.map((t) => ({
            freq: t.freq,
            duration: t.duration,
            delay: t.delay,
            shape: t.shape,
            peakGain: def.pattern.peakGain,
            attack: 0.02,
            release: 0.02,
          })),
        },
      );
    }
  } catch (err) {
    logger.error('播放音效失败', err);
  }
}

export function previewSound(type: SceneSoundValue): void {
  if (isSilentValue(type)) return;
  if (isCustomSoundValue(type)) {
    const customId = getCustomSoundId(type);
    const custom = getCustomSoundById(customId);
    if (!custom) return;
    playCustomOneShot(custom);
    return;
  }
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  const def = getSoundDef(type as SoundTypeName);
  if (!def) return;
  try {
    if (def.kind === 'oneshot') {
      playOneShotDef(ctx, def);
    } else {
      playOneShotDef(
        ctx,
        {
          kind: 'oneshot',
          specs: def.pattern.tones.map((t) => ({
            freq: t.freq,
            duration: t.duration,
            delay: t.delay,
            shape: t.shape,
            peakGain: def.pattern.peakGain,
            attack: 0.02,
            release: 0.02,
          })),
        },
      );
    }
  } catch (err) {
    logger.error('试听音效失败', err);
  }
}

function renderLoopPattern(
  ctx: AudioContext,
  startTime: number,
  pattern: LoopPatternSpec,
): number {
  const { tones, totalDuration, peakGain } = pattern;
  const baseGain = peakGain * config.volume;
  tones.forEach((tone) => {
    const t = startTime + tone.delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.shape ?? 'sine';
    osc.frequency.setValueAtTime(tone.freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(baseGain, t + 0.02);
    gain.gain.setValueAtTime(baseGain, t + Math.max(0.02, tone.duration - 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + tone.duration + 0.02);
  });
  return startTime + totalDuration;
}

export function startLoop(scene: SoundSceneName): void {
  if (!config.enabled) return;

  const type = getSceneSound(scene);
  if (isSilentValue(type)) return;

  if (isCustomSoundValue(type)) {
    const customId = getCustomSoundId(type);
    const custom = getCustomSoundById(customId);
    if (!custom) return;
    stopLoop(scene);
    playCustomLoop(scene, custom);
    activeLoops[scene] = {
      stop: () => {
        stopCustomLoop(scene);
      },
    };
    return;
  }

  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  stopLoop(scene);

  const def = getSoundDef(type as SoundTypeName);
  if (!def) return;
  const pattern = def.kind === 'loop' ? def.pattern : {
    tones: def.specs.filter((s): s is ToneSpec => !isNoiseSpec(s)).map((s) => ({
      freq: s.freq,
      duration: s.duration,
      delay: s.delay ?? 0,
      shape: s.shape,
    })),
    totalDuration: Math.max(0.3, ...def.specs.map((s) => (s.delay ?? 0) + s.duration)) + 0.2,
    interval: 1.5,
    peakGain: 0.18,
  };
  if (pattern.tones.length === 0 || pattern.peakGain <= 0) return;

  let stopped = false;
  let nextTime = ctx.currentTime + 0.05;

  const schedule = () => {
    if (stopped || !audioCtx) return;
    nextTime = renderLoopPattern(audioCtx, nextTime, pattern);
    nextTime += pattern.interval;
    const delay = Math.max(100, nextTime - audioCtx.currentTime - 0.05) * 1000;
    timerId = window.setTimeout(schedule, delay);
  };

  let timerId = window.setTimeout(schedule, 50);

  activeLoops[scene] = {
    stop: () => {
      stopped = true;
      if (timerId) {
        clearTimeout(timerId);
        timerId = 0;
      }
    },
  };
}

export function stopLoop(scene: SoundSceneName): void {
  if (activeLoops[scene]) {
    activeLoops[scene]?.stop();
    activeLoops[scene] = null;
  }
}

export function stopAllLoops(): void {
  Object.keys(activeLoops).forEach((k) => {
    activeLoops[k]?.stop();
    activeLoops[k] = null;
  });
  stopAllCustomSounds();
}
