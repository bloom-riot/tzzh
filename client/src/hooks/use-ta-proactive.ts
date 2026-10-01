import { useEffect, useRef } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ReplyCard } from '@shared/api.interface';
import type { RhythmConfigSettings } from '@client/src/utils/local-storage';
import {
  hasSentMessageId,
  markSentMessageId,
  getLastProactiveSentAt,
  setLastProactiveSentAt,
  generateMessageId,
  getPatPats,
} from '@client/src/utils/local-storage';
import type { ChatMessage } from '@shared/api.interface';

interface UseTaProactiveOptions {
  rhythm: RhythmConfigSettings;
  typingIndicator: boolean;
  readReceipt: boolean;
  taName: string;
  taAvatarUrl: string;
  getRandomCards: (count: number, categoryId?: string) => ReplyCard[];
  sendOneTaMessage: (card: ReplyCard, messageId?: string) => Promise<{ createdAt: string }>;
  sendPatMessage: (content: string) => Promise<ChatMessage | null>;
  markMessagesRead: (beforeTime: string) => boolean | Promise<boolean>;
  incTyping: () => void;
  decTyping: () => void;
  triggerIncomingCall: () => void;
}


export function useTaProactive({
   rhythm,
   typingIndicator,
   readReceipt,
   taName,
   taAvatarUrl,
   getRandomCards,
   sendOneTaMessage,
   sendPatMessage,
   markMessagesRead,
   incTyping,
   decTyping,
   triggerIncomingCall,
 }: UseTaProactiveOptions) {
  const messageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeMessageRef = useRef(false);
  const replyingRef = useRef(false);

  const rhythmRef = useRef(rhythm);
  const typingIndicatorRef = useRef(typingIndicator);
  const readReceiptRef = useRef(readReceipt);
  const taNameRef = useRef(taName);
  const taAvatarUrlRef = useRef(taAvatarUrl);
  const getRandomCardsRef = useRef(getRandomCards);
  const sendOneTaMessageRef = useRef(sendOneTaMessage);
  const sendPatMessageRef = useRef(sendPatMessage);
   const markMessagesReadRef = useRef(markMessagesRead);
   const incTypingRef = useRef(incTyping);
   const decTypingRef = useRef(decTyping);
   const triggerIncomingCallRef = useRef(triggerIncomingCall);

  useEffect(() => { rhythmRef.current = rhythm; }, [rhythm]);
  useEffect(() => { typingIndicatorRef.current = typingIndicator; }, [typingIndicator]);
  useEffect(() => { readReceiptRef.current = readReceipt; }, [readReceipt]);
  useEffect(() => { taNameRef.current = taName; }, [taName]);
  useEffect(() => { taAvatarUrlRef.current = taAvatarUrl; }, [taAvatarUrl]);
  useEffect(() => { getRandomCardsRef.current = getRandomCards; }, [getRandomCards]);
  useEffect(() => { sendOneTaMessageRef.current = sendOneTaMessage; }, [sendOneTaMessage]);
  useEffect(() => { sendPatMessageRef.current = sendPatMessage; }, [sendPatMessage]);
  useEffect(() => { markMessagesReadRef.current = markMessagesRead; }, [markMessagesRead]);
   useEffect(() => { incTypingRef.current = incTyping; }, [incTyping]);
   useEffect(() => { decTypingRef.current = decTyping; }, [decTyping]);
   useEffect(() => { triggerIncomingCallRef.current = triggerIncomingCall; }, [triggerIncomingCall]);

  useEffect(() => {
    if (!rhythm.backgroundPushEnabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => undefined);
    }
  }, [rhythm.backgroundPushEnabled]);

  const tryPatProactive = async () => {
    const r = rhythmRef.current;
    if (!r.patPatEnabled) return;
    if (replyingRef.current || activeMessageRef.current) return;
    const patProb = (r.patPatFrequency ?? 0) / 100;
    if (patProb <= 0 || Math.random() >= patProb) return;
    try {
      const patPats = getPatPats();
      const patText = patPats.length > 0
        ? patPats[Math.floor(Math.random() * patPats.length)].content
        : '拍了拍你';
      const patContent = `${taNameRef.current} ${patText}`;
      await sendPatMessageRef.current(patContent);
    } catch (e) {
      logger.warn('主动拍一拍失败', String(e));
    }
  };

  const tryCallProactive = async () => {
    const r = rhythmRef.current;
    if (!r.incomingCallProbability || r.incomingCallProbability <= 0) {
      logger.info('[call-debug] tryCallProactive skip: probability <= 0');
      return;
    }
    if (replyingRef.current || activeMessageRef.current) {
      logger.info('[call-debug] tryCallProactive skip: replying or active message');
      return;
    }
    const callProb = (r.incomingCallProbability ?? 0) / 100;
    if (callProb <= 0 || Math.random() >= callProb) {
      logger.info(`[call-debug] tryCallProactive skip: random miss, prob=${callProb}`);
      return;
    }
    try {
      logger.info('[call-debug] tryCallProactive triggering incoming call');
      triggerIncomingCallRef.current();
    } catch (e) {
      logger.warn('主动来电失败', String(e));
    }
  };

  useEffect(() => {
    if (!rhythm.proactiveEnabled) return;

    const intervalMin = Math.max(1, rhythm.proactiveIntervalMinutes);
    const intervalMs = intervalMin * 60 * 1000;

    const doMessageProactive = () => {
      if (activeMessageRef.current) return;
      if (replyingRef.current) return;
      const r = rhythmRef.current;
      if (!r.proactiveEnabled) return;

      void tryPatProactive();
      void tryCallProactive();

      activeMessageRef.current = true;

      const messageId = generateMessageId();
      if (hasSentMessageId(messageId)) {
        activeMessageRef.current = false;
        return;
      }

       void (async () => {
        let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
        try {
          const concatProb = (r.concatProbability ?? 0) / 100;
          const shouldConcat = r.concatEnabled && concatProb > 0 && Math.random() < concatProb;
          const concatMax = r.concatMaxSentences ?? 2;
          const pickCount = shouldConcat
            ? 2 + Math.floor(Math.random() * Math.max(1, concatMax - 1))
            : 1;
          logger.info(`[concat-deep] proactive: concatEnabled=${r.concatEnabled}, prob=${concatProb.toFixed(3)}, shouldConcat=${shouldConcat}, pickCount=${pickCount}`);
          const cards = shouldConcat
            ? getRandomCardsRef.current(pickCount, 'all')
            : getRandomCardsRef.current(1, 'all');
          logger.info(`[concat-deep] proactive: cards returned=${cards.length}`);
          if (cards.length === 0) {
            activeMessageRef.current = false;
            return;
          }

          if (typingIndicatorRef.current) {
            logger.info('[typing-counter] proactive incTyping');
            incTypingRef.current();
          }
          const preDelay =
            (r.replyMinSeconds +
              Math.random() *
                (r.replyMaxSeconds - r.replyMinSeconds)) *
              1000 *
              0.1;
          await new Promise<void>((resolve) => {
            pendingTimeout = setTimeout(resolve, preDelay);
          });
          if (!activeMessageRef.current) return;
          if (hasSentMessageId(messageId)) return;
          const mergedContent = cards.map((c) => c.content).join('，');
          const mergedCard = { ...cards[0], content: mergedContent };
          logger.info(`[concat-deep] proactive sending: cardCount=${cards.length}, mergedContent="${mergedContent}"`);
          markSentMessageId(messageId);
          setLastProactiveSentAt(Date.now());
          const msg = await sendOneTaMessageRef.current(mergedCard, messageId);
          if (readReceiptRef.current) {
            void Promise.resolve(markMessagesReadRef.current(msg.createdAt));
          }
        } catch (e) {
          logger.warn('主动消息发送失败', String(e));
          } finally {
            if (pendingTimeout) clearTimeout(pendingTimeout);
            if (typingIndicatorRef.current) {
              // 等两帧确保消息渲染完成再清除 typing
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  logger.info('[typing-counter] proactive decTyping');
                  decTypingRef.current();
                });
              });
            }
            activeMessageRef.current = false;
          }
      })();
    };

    const lastSent = getLastProactiveSentAt();
    const now = Date.now();
    const minDelayMs = Math.min(30000, intervalMs / 2);
    const initialDelayMs = lastSent
      ? Math.max(0, Math.min(intervalMs, Math.max(minDelayMs, lastSent + intervalMs - now)))
      : minDelayMs;

    const initialDelay = setTimeout(() => {
      doMessageProactive();
      messageTimerRef.current = setInterval(doMessageProactive, intervalMs);
    }, initialDelayMs);

      return () => {
        logger.info('[typing-counter] proactive cleanup: clearing timer, setting active=false, decTyping');
        activeMessageRef.current = false;
        if (typingIndicatorRef.current) {
          decTypingRef.current();
        }
        clearTimeout(initialDelay);
       if (messageTimerRef.current) {
         clearInterval(messageTimerRef.current);
         messageTimerRef.current = null;
       }
    };
   }, [rhythm.proactiveEnabled, rhythm.proactiveIntervalMinutes]);

   useEffect(() => {
    if (!rhythm.backgroundKeepAlive) return;
    keepAliveTimerRef.current = setInterval(() => {
      void document.visibilityState;
    }, 30000);
    return () => {
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
    };
  }, [rhythm.backgroundKeepAlive]);

  const setReplying = useRef((v: boolean) => {
    replyingRef.current = v;
  }).current;

  return { setReplying };
}
