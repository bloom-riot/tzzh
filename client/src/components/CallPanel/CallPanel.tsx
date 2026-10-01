import React, { useCallback, useRef, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Phone,
  PhoneOff,
  Minus,
} from 'lucide-react';
import { Image } from '@client/src/components/ui/image';
import { useCallStore, type CallMode } from '@client/src/stores/call-store';

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const SoundWave: React.FC = () => (
  <div className="flex items-end justify-center gap-1 h-6">
    {[0, 1, 2, 3, 4].map((i) => (
      <span
        key={i}
        className="w-1 bg-white/50 rounded-full"
        style={{
          animation: `call-sound-wave 1s ease-in-out ${i * 0.15}s infinite`,
        }}
      />
    ))}
  </div>
);

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 480;
const MINI_WIDTH = 150;
const MINI_HEIGHT = 44;
const DRAG_THRESHOLD = 10;

function getWindowSize() {
  if (typeof window === 'undefined') {
    return { width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 768) {
    const w = Math.min(300, Math.floor(vw * 0.85));
    const h = Math.min(Math.floor(vh * 0.7), 420);
    return { width: w, height: h };
  }
  return { width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
}

interface CallPanelProps {
  onHangUp?: (mode: CallMode, duration: number) => void;
  onAnswer?: () => void;
}

const CallPanel: React.FC<CallPanelProps> = ({ onHangUp, onAnswer }) => {
  const { mode, taName, taAvatar, duration, minimized, position, setMinimized, setPosition, hangUp, answer, incomingCards } = useCallStore();
  const [windowSize, setWindowSize] = React.useState({ width: WINDOW_WIDTH, height: WINDOW_HEIGHT });

  useEffect(() => {
    logger.info(`[call-debug] CallPanel render: mode=${mode}, minimized=${minimized}, position=${position ? `(${position.x},${position.y})` : 'null'}, incomingCards=${incomingCards.length}`);
  }, [mode, minimized, position, incomingCards.length]);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    pointerId: number;
    target: 'header' | 'mini';
  } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      setWindowSize(getWindowSize());
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (position === null && typeof window !== 'undefined' && mode !== 'none') {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = getWindowSize();
      const x = Math.round((vw - size.width) / 2);
      const y = Math.round((vh - size.height) / 2) - 20;
      logger.info(`[call-debug] CallPanel setting initial position: (${x}, ${y}), vw=${vw}, vh=${vh}`);
      setPosition({ x, y });
    }
  }, [position, mode, setPosition]);

  const handlePointerDown = useCallback((e: React.PointerEvent, target: 'header' | 'mini') => {
    const pos = useCallStore.getState().position;
    if (pos === null) return;
    e.preventDefault();
    e.stopPropagation();

    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
      pointerId: e.pointerId,
      target,
    };

    const handleMove = (ev: PointerEvent) => {
      if (!dragStateRef.current) return;
      const dx = ev.clientX - dragStateRef.current.startX;
      const dy = ev.clientY - dragStateRef.current.startY;
      if (!dragStateRef.current.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        dragStateRef.current.moved = true;
      }
      const isMini = useCallStore.getState().minimized;
      const w = isMini ? MINI_WIDTH : windowSize.width;
      const h = isMini ? MINI_HEIGHT : windowSize.height;
      const maxX = Math.max(0, window.innerWidth - w);
      const maxY = Math.max(0, window.innerHeight - h);
      const nx = Math.max(0, Math.min(maxX, dragStateRef.current.origX + dx));
      const ny = Math.max(0, Math.min(maxY, dragStateRef.current.origY + dy));
      useCallStore.getState().setPosition({ x: nx, y: ny });
    };

    const handleUp = (ev: PointerEvent) => {
      if (!dragStateRef.current) return;
      const wasMoved = dragStateRef.current.moved;
      const targetType = dragStateRef.current.target;
      dragStateRef.current = null;

      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleUp);

      if (!wasMoved && targetType === 'mini') {
        useCallStore.getState().setMinimized(false);
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleUp);
  }, [windowSize]);

  const handleHangUp = useCallback(() => {
    const state = useCallStore.getState();
    hangUp((m, d) => {
      onHangUp?.(m, d);
    });
  }, [hangUp, onHangUp]);

  const handleAnswer = useCallback(() => {
    answer(() => {
      onAnswer?.();
    });
  }, [answer, onAnswer]);

  const positionStyle = React.useMemo(() => {
    if (position) {
      return { left: position.x, top: position.y };
    }
    if (typeof window !== 'undefined') {
      const size = getWindowSize();
      const x = Math.round((window.innerWidth - size.width) / 2);
      const y = Math.round((window.innerHeight - size.height) / 2) - 20;
      return { left: x, top: y };
    }
    return { left: '50%', top: '45%', transform: 'translate(-50%, -50%)' };
  }, [position, windowSize]);

  if (mode === 'none') return null;

  const statusText =
    mode === 'calling'
      ? '连接中'
      : mode === 'incoming'
        ? '来电中...'
        : '通话中';

  if (minimized) {
    return (
      <div
        className="fixed z-50 select-none touch-none"
        style={{
          ...positionStyle,
          width: MINI_WIDTH,
          height: MINI_HEIGHT,
        }}
        onPointerDown={(e) => handlePointerDown(e, 'mini')}
      >
        <div
          className="w-full h-full rounded-full flex items-center gap-2 px-2 pointer-events-none"
          style={{ backgroundColor: '#1c1c1e', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
        >
          <Image
            src={taAvatar}
            alt={taName}
            className="w-8 h-8 rounded-full overflow-hidden object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-white/90 text-xs font-medium truncate">
                {statusText}
              </span>
            </div>
            {mode === 'connected' && (
              <span className="text-white/60 text-[10px] tabular-nums">
                {formatDuration(duration)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleHangUp();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 active:scale-95 transition-all pointer-events-auto"
            aria-label="挂断"
          >
            <PhoneOff className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 rounded-3xl overflow-hidden text-white select-none flex flex-col touch-none"
      style={{
        ...positionStyle,
        width: windowSize.width,
        height: windowSize.height,
        backgroundColor: '#1c1c1e',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="h-12 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing flex-shrink-0 border-b border-white/10"
        onPointerDown={(e) => handlePointerDown(e, 'header')}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <span
            className={`w-2 h-2 rounded-full ${mode === 'incoming' ? 'bg-yellow-400' : 'bg-green-500'} ${mode === 'connected' ? 'animate-pulse' : ''}`}
          />
          <span className="text-white/80 text-sm font-medium">
            {statusText}
            {mode === 'connected' && (
              <span className="text-white/60 text-xs ml-1 tabular-nums">
                {formatDuration(duration)}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
            aria-label="最小化"
          >
            <Minus className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="relative mb-4">
          {mode === 'calling' && (
            <>
              <span
                className="absolute inset-0 rounded-full border-2 border-white/40"
                style={{ animation: 'call-pulse-ring 1.6s ease-out infinite' }}
              />
              <span
                className="absolute inset-0 rounded-full border-2 border-white/40"
                style={{ animation: 'call-pulse-ring 1.6s ease-out 0.5s infinite' }}
              />
            </>
          )}
          {mode === 'connected' && (
            <span
              className="absolute inset-0 rounded-full border-2 border-white/20"
              style={{ animation: 'call-breathe 3s ease-in-out infinite' }}
            />
          )}
          <Image
            src={taAvatar}
            alt={taName}
            className="w-24 h-24 rounded-full overflow-hidden object-cover relative z-10"
            style={
              mode === 'incoming'
                ? { animation: 'call-shake 1.5s ease-in-out infinite' }
                : undefined
            }
          />
        </div>

        <h2 className="text-lg font-medium text-white mb-1">{taName}</h2>

        {mode === 'calling' && (
          <div className="flex items-center gap-1 mb-4">
            <span className="text-white/60 text-sm">正在连接</span>
            <span className="text-white/60 text-sm">
              <span style={{ animation: 'call-dots 1.4s infinite' }}>.</span>
              <span style={{ animation: 'call-dots 1.4s 0.2s infinite' }}>.</span>
              <span style={{ animation: 'call-dots 1.4s 0.4s infinite' }}>.</span>
            </span>
          </div>
        )}
        {mode === 'incoming' && (
          <p className="text-white/60 text-sm mb-3">来电中...</p>
        )}

        {mode === 'incoming' && incomingCards.length > 0 && (
          <div className="w-full max-w-[260px] mb-4 px-3">
            <div className="text-[10px] tracking-widest uppercase text-amber-200/70 text-center mb-2">
              TA 想说
            </div>
            <div className="space-y-2">
              {incomingCards.map((card, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl px-4 py-2.5 text-center"
                  style={{
                    backgroundColor: 'rgba(201, 168, 124, 0.12)',
                    border: '1px solid rgba(201, 168, 124, 0.25)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  <p
                    className="text-sm text-white/90 leading-snug"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {card.content}
                    {card.emojis.length > 0 && (
                      <span className="ml-1">{card.emojis.join(' ')}</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(mode === 'calling' || mode === 'connected') && (
          <div className="mb-0">
            <SoundWave />
          </div>
        )}
      </div>

      <div className="pb-6 pt-2 flex-shrink-0">
        {(mode === 'calling' || mode === 'connected') && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleHangUp}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all shadow-lg"
              aria-label="挂断"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {mode === 'incoming' && (
          <div className="flex items-center justify-center gap-10">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={handleHangUp}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all shadow-lg"
                aria-label="拒绝"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
              <span className="text-white/60 text-xs">拒绝</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={handleAnswer}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 active:scale-95 transition-all shadow-lg"
                aria-label="接听"
              >
                <Phone className="w-6 h-6 text-white" />
              </button>
              <span className="text-white/60 text-xs">接听</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes call-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes call-shake {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes call-breathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes call-dots {
          0%, 20% { opacity: 0.2; }
          50% { opacity: 1; }
          100% { opacity: 0.2; }
        }
        @keyframes call-sound-wave {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
      `}</style>
    </div>
  );
};

export default CallPanel;
