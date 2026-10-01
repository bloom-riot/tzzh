import { create } from 'zustand';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { DEFAULT_TA_AVATAR } from '@client/src/hooks/use-local-storage';
import type { ReplyCard } from '@shared/api.interface';
import {
  playSound,
  startLoop,
  stopLoop,
  stopAllLoops,
} from '@client/src/utils/sound-manager';

export type CallMode = 'none' | 'calling' | 'connected' | 'incoming';

export interface IncomingCard {
  content: string;
  emojis: string[];
}

interface CallState {
  mode: CallMode;
  taName: string;
  taAvatar: string;
  startTime: number;
  duration: number;
  minimized: boolean;
  position: { x: number; y: number } | null;
  incomingCards: IncomingCard[];
}

interface CallActions {
  startCalling: (taName: string, taAvatar: string, onConnect?: () => void, onMissed?: () => void) => void;
  startIncoming: (taName: string, taAvatar: string, cards: IncomingCard[], onTimeout?: () => void) => void;
  answer: (onConnected?: () => void) => void;
  hangUp: (onEnd?: (mode: CallMode, duration: number) => void) => void;
  setMinimized: (minimized: boolean) => void;
  setPosition: (pos: { x: number; y: number } | null) => void;
  tick: () => void;
}

const initialState: CallState = {
  mode: 'none',
  taName: 'TA',
  taAvatar: DEFAULT_TA_AVATAR,
  startTime: 0,
  duration: 0,
  minimized: false,
  position: null,
  incomingCards: [],
};

let connectTimerId: number | null = null;
let incomingTimerId: number | null = null;
let durationTimerId: number | null = null;

function clearAllTimers() {
  if (connectTimerId) {
    clearTimeout(connectTimerId);
    connectTimerId = null;
  }
  if (incomingTimerId) {
    clearTimeout(incomingTimerId);
    incomingTimerId = null;
  }
  if (durationTimerId) {
    clearInterval(durationTimerId);
    durationTimerId = null;
  }
}

function startDurationTimer() {
  if (durationTimerId) return;
  durationTimerId = window.setInterval(() => {
    useCallStore.getState().tick();
  }, 1000);
}

export const useCallStore = create<CallState & CallActions>((set, get) => ({
  ...initialState,

  startCalling: (taName, taAvatar, onConnect, onMissed) => {
    if (get().mode !== 'none') return;
    clearAllTimers();
    set({ mode: 'calling', taName, taAvatar, duration: 0, minimized: false, position: null, incomingCards: [] });
    startLoop('me_call');

    const connectDelay = 2000 + Math.random() * 2000;
    connectTimerId = window.setTimeout(() => {
      if (Math.random() < 0.15) {
        set({ mode: 'none' });
        stopAllLoops();
        playSound('call_end');
        onMissed?.();
        return;
      }
      stopLoop('me_call');
      set({ mode: 'connected', startTime: Date.now(), duration: 0 });
      playSound('call_answer');
      startDurationTimer();
      onConnect?.();
    }, connectDelay);
  },

  startIncoming: (taName, taAvatar, cards, onTimeout) => {
    const prevMode = get().mode;
    logger.info(`[call-debug] startIncoming called, prevMode=${prevMode}, cardsLen=${cards.length}`);
    if (prevMode !== 'none') {
      logger.info(`[call-debug] startIncoming early return: mode is ${prevMode}, not 'none'`);
      return;
    }
    clearAllTimers();
    set({
      mode: 'incoming',
      taName,
      taAvatar,
      duration: 0,
      minimized: false,
      position: null,
      incomingCards: cards,
    });
    logger.info('[call-debug] startIncoming set state done, mode=incoming');
    startLoop('ta_call');

    incomingTimerId = window.setTimeout(() => {
      const currentMode = get().mode;
      logger.info(`[call-debug] incoming timeout fired, currentMode=${currentMode}`);
      set({ mode: 'none', incomingCards: [] });
      stopAllLoops();
      playSound('call_end');
      onTimeout?.();
    }, 30000);
  },

  answer: (onConnected) => {
    if (get().mode !== 'incoming') return;
    if (incomingTimerId) {
      clearTimeout(incomingTimerId);
      incomingTimerId = null;
    }
    stopLoop('ta_call');
    set({ mode: 'connected', startTime: Date.now(), duration: 0, incomingCards: [] });
    playSound('call_answer');
    startDurationTimer();
    onConnected?.();
  },

  hangUp: (onEnd) => {
    const state = get();
    const { mode, duration, startTime } = state;
    clearAllTimers();
    stopAllLoops();
    if (mode !== 'none') playSound('call_end');
    const finalDuration = mode === 'connected'
      ? Math.floor((Date.now() - startTime) / 1000)
      : duration;
    set({ mode: 'none', minimized: false, position: null, duration: 0, incomingCards: [] });
    onEnd?.(mode, finalDuration);
  },

  setMinimized: (minimized) => set({ minimized }),

  setPosition: (pos) => set({ position: pos }),

  tick: () => {
    const state = get();
    if (state.mode !== 'connected') return;
    set({ duration: Math.floor((Date.now() - state.startTime) / 1000) });
  },
}));
