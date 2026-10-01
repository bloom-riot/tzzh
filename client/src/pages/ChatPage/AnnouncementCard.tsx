import { useEffect, useMemo } from 'react';
import { useDailyAnnouncements } from '@client/src/hooks/use-local-storage';
import { Image } from '@client/src/components/ui/image';

const CACHE_KEY = 'daily_announcement_cache';
const FALLBACK_TEXT = '今天也要开心';

interface AnnouncementCardProps {
  open: boolean;
  onClose: () => void;
  taName: string;
  taAvatar: string;
}

interface DailyAnnouncementCache {
  date: string;
  greeting: string;
  title: string;
  status: string;
  weather: string;
  statusSmall: string;
  quote: string;
}

function extractEmojiAndText(text: string): { emoji: string; text: string } {
  const match = text.match(/^[\p{Extended_Pictographic}\s]+/u);
  if (match) {
    const emoji = match[0].trim();
    const rest = text.slice(match[0].length).trim();
    return { emoji: emoji || '✨', text: rest || text };
  }
  return { emoji: '✨', text };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'GOOD MORNING';
  if (hour >= 12 && hour < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

function formatDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year} · ${month}月${day}日`;
}

function getRandomItem(items: string[]): string {
  if (items.length === 0) return FALLBACK_TEXT;
  return items[Math.floor(Math.random() * items.length)];
}

function readCache(): DailyAnnouncementCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyAnnouncementCache;
  } catch {
    return null;
  }
}

function writeCache(data: DailyAnnouncementCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export default function AnnouncementCard({
  open,
  onClose,
  taName,
  taAvatar,
}: AnnouncementCardProps) {
  const { items } = useDailyAnnouncements();

  const announcement = useMemo<DailyAnnouncementCache>(() => {
    const today = new Date().toDateString();
    const cached = readCache();
    if (cached && cached.date === today) {
      return cached;
    }
    const contents = items.map((item) => item.content);
    const data: DailyAnnouncementCache = {
      date: today,
      greeting: getGreeting(),
      title: getRandomItem(contents),
      status: getRandomItem(contents),
      weather: getRandomItem(contents),
      statusSmall: getRandomItem(contents),
      quote: getRandomItem(contents),
    };
    writeCache(data);
    return data;
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const { emoji: statusEmoji, text: statusText } = extractEmojiAndText(
    announcement.status
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-200"
      style={{ backgroundColor: 'var(--chat-overlay)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="今日公告"
    >
      <div
        className="w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl announce-card-bg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient area */}
        <div className="announce-header px-5 pt-5 pb-6">
          <div className="flex items-start gap-3">
            <Image
              src={taAvatar}
              alt={taName}
              width={48}
              height={48}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/40 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium tracking-widest opacity-80">
                {announcement.greeting}
              </div>
              <div className="text-xl font-semibold mt-1 truncate">
                {announcement.title || FALLBACK_TEXT}
              </div>
              <div className="text-xs opacity-70 mt-1">{formatDate()}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Today status */}
          <div>
            <div
              className="text-sm font-medium mb-2"
              style={{ color: 'var(--chat-text-primary)' }}
            >
              {taName} 今日状态
            </div>
            <div
              className="rounded-xl p-3 flex items-center gap-3 announce-card-bg-secondary"
            >
              <div className="text-2xl flex-shrink-0">{statusEmoji}</div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--chat-text-primary)' }}
                >
                  {statusText || FALLBACK_TEXT}
                </div>
                <div
                  className="text-xs mt-0.5 truncate"
                  style={{ color: 'var(--chat-text-secondary)' }}
                >
                  {announcement.status}
                </div>
              </div>
            </div>
          </div>

          {/* Two small cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3 announce-card-bg-secondary">
              <div
                className="text-xs mb-1"
                style={{ color: 'var(--chat-text-secondary)' }}
              >
                {taName}的天气
              </div>
              <div
                className="text-sm font-medium"
                style={{ color: 'var(--chat-text-primary)' }}
              >
                {announcement.weather || FALLBACK_TEXT}
              </div>
            </div>
            <div className="rounded-xl p-3 announce-card-bg-secondary">
              <div
                className="text-xs mb-1"
                style={{ color: 'var(--chat-text-secondary)' }}
              >
                {taName}的状态
              </div>
              <div
                className="text-sm font-medium"
                style={{ color: 'var(--chat-text-primary)' }}
              >
                {announcement.statusSmall || FALLBACK_TEXT}
              </div>
            </div>
          </div>

          {/* Quote */}
          <div
            className="rounded-xl p-4 text-center announce-card-bg-secondary"
          >
            <div className="announce-quote text-sm italic leading-relaxed">
              <span className="mr-1">"</span>
              {announcement.quote || FALLBACK_TEXT}
              <span className="ml-1">"</span>
            </div>
          </div>

          {/* Bottom button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-opacity active:opacity-80"
            style={{
              backgroundColor: 'var(--chat-accent)',
              color: 'var(--chat-bubble-me-text)',
            }}
          >
            ✓ 知道了，开始今天
          </button>
        </div>
      </div>
    </div>
  );
}
