import { useCallback, useEffect } from 'react';
import {
  getPendingReply,
  savePendingReply,
  clearPendingReply,
  getRandomReplyCards,
  getReplyCardsByIds,
  hasSentMessageId,
  markSentMessageId,
  generateMessageId,
  getPatPats,
} from '@client/src/utils/local-storage';
import type { PendingReplyState } from '@client/src/utils/local-storage';
import { usePendingReplyStore } from '@client/src/stores/pending-reply-store';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ReplyCard } from '@shared/api.interface';

 interface UsePendingReplyOptions {
   typingIndicator: boolean;
   readReceipt: boolean;
   patPatEnabled: boolean;
   patPatFrequency: number;
   taName: string;
   concatEnabled: boolean;
   concatProbability: number;
   concatMaxSentences: number;
   emojiReplyProbability: number;
   stickerReplyProbability: number;
   quoteReplyEnabled: boolean;
   quoteReplyProbability: number;
   recallProbability: number;
   minReplyCount: number;
   maxReplyCount: number;
   replyMinSeconds: number;
   replyMaxSeconds: number;
    getReplyCardsByIds: (ids: string[]) => ReplyCard[];
    getRandomCards?: (count: number, categoryId?: string) => ReplyCard[];
   sendOneMessage: (
     card: ReplyCard,
     quoteTo: string | null | undefined,
     quoteContent: string | null | undefined,
     quoteSender: 'me' | 'ta' | null | undefined,
     messageId: string,
     stickerUrl?: string | null,
     emojis?: string[] | null,
   ) => Promise<{ createdAt: string; id?: string }>;
    sendPatMessage: (content: string) => Promise<any>;
    markRead: (time: string) => void | Promise<void>;
     getEmojis?: () => string[];
     getStickers?: () => string[];
    recallMessage?: (id: string) => Promise<boolean>;
 }

 const TYPING_AFTER_READ_DELAY_MS = 800;
const FLOOD_WINDOW_MS = 10_000;
const FLOOD_MAX_MESSAGES = 8;
const PAT_COOLDOWN_MS = 15_000;

interface PendingJob {
  id: string;
  state: PendingReplyState;
  timer: ReturnType<typeof setTimeout> | null;
}

const jobs = new Map<string, PendingJob>();
const replyQueue: string[] = [];
let executingId: string | null = null;
let scheduledId: string | null = null;
const recentSentTimes: number[] = [];
let lastPatAt = 0;

 const typingIndicatorRef = { current: true };
 const readReceiptRef = { current: true };
 const patPatEnabledRef = { current: false };
const patPatFrequencyRef = { current: 0 };
const taNameRef = { current: 'TA' };
const concatEnabledRef = { current: false };
const concatProbabilityRef = { current: 0 };
 const concatMaxSentencesRef = { current: 3 };
 const forceConcatRef = { current: false };
 const minReplyCountRef = { current: 1 };
 const maxReplyCountRef = { current: 2 };
 const replyMinSecondsRef = { current: 2 };
 const replyMaxSecondsRef = { current: 4 };
 const emojiReplyProbabilityRef = { current: 0 };
const stickerReplyProbabilityRef = { current: 0 };
const quoteReplyEnabledRef = { current: false };
const quoteReplyProbabilityRef = { current: 0 };
const recallProbabilityRef = { current: 0 };
let getEmojisFn: () => string[] = () => [];
let getStickersFn: () => string[] = () => [];
let getRandomCardsFn: (count: number, categoryId?: string) => ReplyCard[] = (count, cat) => getRandomReplyCards(count, cat);
let recallMessageFn: ((id: string) => Promise<boolean>) | undefined;
let getCardsByIdsFn: (ids: string[]) => ReplyCard[] = () => [];
let sendOneMessageFn: UsePendingReplyOptions['sendOneMessage'] = async () => ({ createdAt: new Date().toISOString() });
let sendPatMessageFn: (content: string) => Promise<any> = async () => {};
let markReadFn: (time: string) => void | Promise<void> = () => {};

function checkFlood(): boolean {
  const now = Date.now();
  const cutoff = now - FLOOD_WINDOW_MS;
  for (let i = recentSentTimes.length - 1; i >= 0; i--) {
    if (recentSentTimes[i] <= cutoff) recentSentTimes.splice(i, 1);
  }
  if (recentSentTimes.length >= FLOOD_MAX_MESSAGES) {
    logger.error('TA回复触发防刷屏保护，停止发送');
    return true;
  }
  return false;
}

function recordSent(): void {
  recentSentTimes.push(Date.now());
}

function getSafeReplyCards(cardIds: string[]): ReplyCard[] {
  let cards = getCardsByIdsFn(cardIds);
  if (cards.length === 0) {
    const fallbackCount = Math.max(1, cardIds.length);
    cards = getRandomReplyCards(fallbackCount, 'all');
  }
  return cards;
}

   const incTyping = (): void => {
   if (!typingIndicatorRef.current) return;
   usePendingReplyStore.getState().incrementTyping();
   logger.info(`[typing-deep] incTyping: count=${usePendingReplyStore.getState().typingCount}, time=${Date.now()}`);
 };
 const decTyping = (): void => {
   if (!typingIndicatorRef.current) return;
   usePendingReplyStore.getState().decrementTyping();
   logger.info(`[typing-deep] decTyping: count=${usePendingReplyStore.getState().typingCount}, time=${Date.now()}`);
 };
 const resetTyping = (): void => {
   usePendingReplyStore.getState().resetTyping();
   logger.info(`[typing-deep] resetTyping: count=0, time=${Date.now()}`);
 };

  function removeJob(id: string): void {
   const job = jobs.get(id);
   if (job && job.timer) {
     clearTimeout(job.timer);
     job.timer = null;
   }
   jobs.delete(id);
   logger.info(`[typing-counter] module-level removeJob id=${id} jobsLeft=${jobs.size} executing=${executingId} scheduled=${scheduledId}`);
   if (jobs.size === 0 && executingId === null && scheduledId === null) {
     usePendingReplyStore.getState().setHasActiveJob(false);
   }
 }

 export function usePendingReply({
    typingIndicator,
    readReceipt,
    patPatEnabled,
    patPatFrequency,
    taName,
    concatEnabled,
    concatProbability,
    concatMaxSentences,
    emojiReplyProbability,
    stickerReplyProbability,
    quoteReplyEnabled,
    quoteReplyProbability,
    recallProbability,
    minReplyCount,
    maxReplyCount,
    replyMinSeconds,
    replyMaxSeconds,
    getReplyCardsByIds,
    sendOneMessage,
    sendPatMessage,
    markRead,
     getEmojis,
     getStickers,
     getRandomCards,
     recallMessage,
  }: UsePendingReplyOptions) {
   const typingCount = usePendingReplyStore((s) => s.typingCount);
   const isTyping = typingCount > 0;

   useEffect(() => { typingIndicatorRef.current = typingIndicator; }, [typingIndicator]);
   useEffect(() => { readReceiptRef.current = readReceipt; }, [readReceipt]);
   useEffect(() => { patPatEnabledRef.current = patPatEnabled; }, [patPatEnabled]);
   useEffect(() => { patPatFrequencyRef.current = patPatFrequency; }, [patPatFrequency]);
   useEffect(() => { taNameRef.current = taName; }, [taName]);
   useEffect(() => { concatEnabledRef.current = concatEnabled; }, [concatEnabled]);
   useEffect(() => { concatProbabilityRef.current = concatProbability; }, [concatProbability]);
   useEffect(() => { concatMaxSentencesRef.current = concatMaxSentences; }, [concatMaxSentences]);
   useEffect(() => { minReplyCountRef.current = minReplyCount; }, [minReplyCount]);
   useEffect(() => { maxReplyCountRef.current = maxReplyCount; }, [maxReplyCount]);
   useEffect(() => { replyMinSecondsRef.current = replyMinSeconds; }, [replyMinSeconds]);
   useEffect(() => { replyMaxSecondsRef.current = replyMaxSeconds; }, [replyMaxSeconds]);
   useEffect(() => { emojiReplyProbabilityRef.current = emojiReplyProbability; }, [emojiReplyProbability]);
   useEffect(() => { stickerReplyProbabilityRef.current = stickerReplyProbability; }, [stickerReplyProbability]);
   useEffect(() => { quoteReplyEnabledRef.current = quoteReplyEnabled; }, [quoteReplyEnabled]);
   useEffect(() => { quoteReplyProbabilityRef.current = quoteReplyProbability; }, [quoteReplyProbability]);
   useEffect(() => { recallProbabilityRef.current = recallProbability; }, [recallProbability]);
   useEffect(() => { getEmojisFn = getEmojis ?? (() => []); }, [getEmojis]);
   useEffect(() => { getStickersFn = getStickers ?? (() => []); }, [getStickers]);
   useEffect(() => { getRandomCardsFn = getRandomCards ?? ((count, cat) => getRandomReplyCards(count, cat)); }, [getRandomCards]);
   useEffect(() => { recallMessageFn = recallMessage; }, [recallMessage]);
   useEffect(() => { getCardsByIdsFn = getReplyCardsByIds; }, [getReplyCardsByIds]);
   useEffect(() => { sendOneMessageFn = sendOneMessage; }, [sendOneMessage]);
   useEffect(() => { sendPatMessageFn = sendPatMessage; }, [sendPatMessage]);
   useEffect(() => { markReadFn = markRead; }, [markRead]);

  const checkFlood = useCallback((): boolean => {
    const now = Date.now();
    const cutoff = now - FLOOD_WINDOW_MS;
    for (let i = recentSentTimes.length - 1; i >= 0; i--) {
      if (recentSentTimes[i] <= cutoff) recentSentTimes.splice(i, 1);
    }
    if (recentSentTimes.length >= FLOOD_MAX_MESSAGES) {
      logger.error('TA回复触发防刷屏保护，停止发送');
      return true;
    }
    return false;
  }, []);

  const recordSent = useCallback(() => {
    recentSentTimes.push(Date.now());
  }, []);

  const getSafeReplyCards = useCallback((cardIds: string[]): ReplyCard[] => {
    let cards = getCardsByIdsFn(cardIds);
    if (cards.length === 0) {
      const fallbackCount = Math.max(1, cardIds.length);
      cards = getRandomReplyCards(fallbackCount, 'all');
    }
    return cards;
  }, []);

   const removeJob = useCallback((id: string) => {
     const job = jobs.get(id);
     if (job && job.timer) {
       clearTimeout(job.timer);
       job.timer = null;
     }
     jobs.delete(id);
      logger.info(`[typing-counter] removeJob id=${id} jobsLeft=${jobs.size} executing=${executingId} scheduled=${scheduledId}`);
     if (jobs.size === 0) {
       usePendingReplyStore.getState().setHasActiveJob(false);
     }
   }, []);

   const executeReply = useCallback((jobId: string, pending: PendingReplyState) => {
     if (executingId) return;
     if (!jobs.has(jobId)) return;

      const replyCards = getSafeReplyCards(pending.cardIds);
      logger.info(`[concat-debug] executeReply: jobId=${jobId}, cardIds=${pending.cardIds?.length || 0}, willReply=${pending.willReply}, replyCards=${replyCards.length}, concatEnabled=${concatEnabledRef.current}, concatProb=${concatProbabilityRef.current}%`);

     const willActuallySend = pending.willReply && replyCards.length > 0;
     const messageId = pending.messageId || generateMessageId();

     if (willActuallySend) {
       if (hasSentMessageId(messageId)) {
         logger.warn('pending 消息已发送过，跳过重复执行', messageId);
         clearPendingReply();
         removeJob(jobId);
         return;
       }
       if (checkFlood()) {
         clearPendingReply();
         removeJob(jobId);
         return;
       }
     }

     executingId = jobId;

      const finish = () => {
         logger.info(`[typing-counter] finish called for job=${jobId}, executingId=${executingId}`);
         clearPendingReply();
         removeJob(jobId);
         executingId = null;
         logger.info(`[typing-counter] finish: executingId cleared, queueLen=${replyQueue.length}, jobsLeft=${jobs.size}`);
         scheduleNextFromQueue();
       };

      if (!willActuallySend) {
        logger.info(`[typing-counter] executeReply: willActuallySend=false willReply=${pending.willReply} replyCardsLen=${replyCards.length}, finishing immediately`);
       if (pending.readReceipt) {
         void Promise.resolve(markReadFn(new Date().toISOString()));
       }
       finish();
       return;
     }

     const job = jobs.get(jobId);
     if (job) {
       job.timer = null;
     }

      markSentMessageId(messageId);
     clearPendingReply();
     recordSent();

     const trySendPat = async () => {
       if (!patPatEnabledRef.current) return false;
       const now = Date.now();
       if (now - lastPatAt < PAT_COOLDOWN_MS) return false;
       const prob = Math.max(0, Math.min(100, patPatFrequencyRef.current)) / 100;
       if (prob <= 0 || Math.random() >= prob) return false;
       const patPats = getPatPats();
       const patText = patPats.length > 0
         ? patPats[Math.floor(Math.random() * patPats.length)].content
         : '拍了拍你';
       const patContent = `${taNameRef.current} ${patText}`;
       try {
         await sendPatMessageFn(patContent);
         lastPatAt = Date.now();
         return true;
       } catch (err) {
         logger.error('发送拍一拍失败', err);
         return false;
       }
     };

      const maybeRecall = (sentId: string, originalPending: PendingReplyState, sentCardId: string, sentStickerUrl: string) => {
       const recallProb = recallProbabilityRef.current / 100;
       if (recallProb <= 0 || Math.random() >= recallProb) return;
       const delay = 2000 + Math.random() * 3000;
       setTimeout(() => {
         if (!recallMessageFn) return;
         void recallMessageFn(sentId).then((ok) => {
           if (!ok) return;
           const reSendDelay = 1000 + Math.random() * 2000;
            setTimeout(() => {
              if (checkFlood()) return;
              const reCardPool = getRandomCardsFn(50, 'all');
              if (reCardPool.length === 0) return;
             const reMsgId = generateMessageId();
             markSentMessageId(reMsgId);
             recordSent();
           incTyping();
           const typingDelay = 600 + Math.random() * 800;
           setTimeout(async () => {
             try {
               const { mergedCard, stickerUrl: reStickerUrl, replyEmojis, quoteTo, quoteContent, quoteSender } = buildReplyPayload(reCardPool, !!originalPending.quoteTo, sentCardId, sentStickerUrl);
               await sendOneMessageFn(
                 mergedCard,
                 quoteTo || undefined,
                 quoteContent || undefined,
                 quoteSender || undefined,
                 reMsgId,
                 reStickerUrl,
                 replyEmojis,
               );
              if (originalPending.readReceipt) {
                void Promise.resolve(markReadFn(new Date().toISOString()));
              }
            } catch (err) {
              logger.error('撤回重发失败', err);
             } finally {
               // 等两帧确保消息渲染完成再清除 typing
               await new Promise<void>((resolve) => {
                 requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
               });
               decTyping();
             }
          }, typingDelay);
           }, reSendDelay);
         });
       }, delay);
     };

        const buildReplyPayload = (baseCards: ReplyCard[], useQuote: boolean, excludeCardId: string, excludeStickerUrl: string) => {
          const stickerProb = stickerReplyProbabilityRef.current / 100;
           const stickers = getStickersFn();
          const availableStickers = stickers.filter((s: string) => s !== excludeStickerUrl);
          const stickerPool = availableStickers.length > 0 ? availableStickers : stickers;
          logger.info(`[concat-debug] buildReplyPayload entry: baseCards=${baseCards.length}, concatEnabled=${concatEnabledRef.current}, concatProbability=${concatProbabilityRef.current}%, stickerProb=${(stickerReplyProbabilityRef.current).toFixed(1)}%, useQuote=${useQuote}`);
          const useSticker = stickerProb > 0 && stickerPool.length > 0 && Math.random() < stickerProb;
          logger.info(`[concat-debug] buildReplyPayload: useSticker=${useSticker}, stickerProb=${stickerProb.toFixed(3)} (${Math.round(stickerProb * 100)}%)`);

         let finalCards: ReplyCard[] = [];
         let stickerUrl: string | undefined;

            if (useSticker) {
              stickerUrl = stickerPool[Math.floor(Math.random() * stickerPool.length)];
              finalCards = [{ id: '', content: '', category: '' } as ReplyCard];
              logger.info(`[concat-debug] STICKER reply selected: concat skipped entirely (sticker messages don't concat)`);
           } else {
             const concatProb = concatProbabilityRef.current / 100;
             const rand = Math.random();
             let shouldConcat = concatEnabledRef.current && concatProb > 0 && rand < concatProb;
              const forceConcat = forceConcatRef.current;
              if (forceConcat) {
                shouldConcat = true;
                logger.info(`[concat-debug] FORCE CONCAT enabled by test message, overriding probability`);
              }
              logger.info(`[concat-debug] concat roll: enabled=${concatEnabledRef.current}, prob=${concatProb.toFixed(3)} (${Math.round(concatProb * 100)}%), rand=${rand.toFixed(3)}, shouldConcat=${shouldConcat}, forceConcat=${forceConcat}`);
            const availableCards = baseCards.filter((c: ReplyCard) => c.id !== excludeCardId);
            let pool = availableCards.length > 0 ? availableCards : baseCards;
            logger.info(`[concat-deep] pool after excludeCardId: base=${baseCards.length}, available=${availableCards.length}, pool=${pool.length}`);
            if (shouldConcat && pool.length < 2) {
              const extra = getRandomCardsFn(50, 'all').filter((c: ReplyCard) => c.id !== excludeCardId && !pool.some((p: ReplyCard) => p.id === c.id));
              pool = [...pool, ...extra];
              logger.info(`[concat-deep] pool supplemented: extra=${extra.length}, newPoolSize=${pool.length}`);
            }
             if (shouldConcat && pool.length > 1) {
               const maxCount = Math.max(2, concatMaxSentencesRef.current);
               const count = 2 + Math.floor(Math.random() * Math.max(1, maxCount - 1));
               const actualCount = Math.min(count, pool.length);
               const picked: ReplyCard[] = [];
               const cardPool = [...pool];
               for (let i = 0; i < actualCount && cardPool.length > 0; i++) {
                 const idx = Math.floor(Math.random() * cardPool.length);
                 picked.push(cardPool.splice(idx, 1)[0]);
               }
                finalCards = picked;
                const mergedText = picked.map((c: ReplyCard) => c.content).join('，');
                logger.info(`[concat-debug] CONCAT YES: ${picked.length} cards merged (pool=${pool.length}, max=${maxCount})`);
                logger.info(`[concat-debug] merged content="${mergedText}"`);
                logger.info(`[concat-debug] concat card ids: [${picked.map((c) => c.id).join(', ')}]`);
                if (forceConcatRef.current) {
                  forceConcatRef.current = false;
                  logger.info(`[concat-debug] forceConcat consumed, reset to false`);
               }
             } else {
               finalCards = [pool[Math.floor(Math.random() * pool.length)]];
               let reason = '';
               if (useSticker) reason = 'sticker mode (not in this branch)';
               else if (!concatEnabledRef.current) reason = 'concat DISABLED in settings';
               else if (concatProb <= 0) reason = 'concat probability is 0';
               else if (pool.length < 2) reason = `pool too small (${pool.length} card, need >=2)`;
               else reason = `random not hit: ${rand.toFixed(3)} >= ${concatProb.toFixed(3)} (${Math.round(rand * 100)}% vs ${Math.round(concatProb * 100)}%)`;
                logger.info(`[concat-debug] NO concat: reason="${reason}"`);
             }
          }

         const mergedContent = finalCards.map((c: ReplyCard) => c.content).join('，');
         const firstCard = finalCards[0];
         const mergedCard: ReplyCard = { ...firstCard, content: mergedContent };

         let replyEmojis: string[] | null = null;
         if (!useSticker) {
            const emojis = getEmojisFn();
           const emojiProb = emojiReplyProbabilityRef.current / 100;
           if (emojiProb > 0 && emojis.length > 0 && Math.random() < emojiProb) {
             const count = 1 + Math.floor(Math.random() * 2);
             const picked: string[] = [];
             for (let i = 0; i < count; i++) {
               picked.push(emojis[Math.floor(Math.random() * emojis.length)]);
             }
             replyEmojis = picked;
           }
         }

       let quoteTo: string | null = null;
       let quoteContent: string | null = null;
       let quoteSender: 'me' | 'ta' | null = null;
       if (useQuote && quoteReplyEnabledRef.current) {
         const quoteProb = quoteReplyProbabilityRef.current / 100;
         if (quoteProb > 0 && Math.random() < quoteProb && pending.userMsgId && pending.userMsgContent) {
           quoteTo = pending.userMsgId;
           quoteContent = pending.userMsgContent;
           quoteSender = 'me';
         }
       }

       return { mergedCard, stickerUrl, replyEmojis, quoteTo, quoteContent, quoteSender };
     };

       const sendOneReply = async (baseCards: ReplyCard[], msgId: string, useQuote: boolean, excludeCardId: string, excludeStickerUrl: string): Promise<{ createdAt: string; id?: string; cardId: string; stickerUrl: string }> => {
         const { mergedCard, stickerUrl, replyEmojis, quoteTo, quoteContent, quoteSender } = buildReplyPayload(baseCards, useQuote, excludeCardId, excludeStickerUrl);
         const isConcat = mergedCard.content.includes('，') && baseCards.length > 1;
         logger.info(`[concat-deep] sendOneReply: msgId=${msgId} content="${mergedCard.content.slice(0, 60)}${mergedCard.content.length > 60 ? '...' : ''}" isSticker=${!!stickerUrl}`);
         const sentMsg = await sendOneMessageFn(
           mergedCard,
           quoteTo || undefined,
           quoteContent || undefined,
           quoteSender || undefined,
           msgId,
           stickerUrl,
           replyEmojis,
         );
          if (sentMsg && 'id' in sentMsg) {
            maybeRecall((sentMsg as { id: string }).id, pending, mergedCard.id || '', stickerUrl || '');
          }
         return {
           createdAt: sentMsg?.createdAt ?? new Date().toISOString(),
           id: sentMsg?.id,
           cardId: mergedCard.id || '',
           stickerUrl: stickerUrl || '',
         };
       };

      void (async () => {
        incTyping();

        const minS = Math.max(1, replyMinSecondsRef.current);
        const maxS = Math.max(minS, replyMaxSecondsRef.current);
        let waitMs = (minS + Math.random() * Math.max(0, maxS - minS)) * 1000;
        const MIN_TYPING_MS = 1000;
        if (waitMs < MIN_TYPING_MS) waitMs = MIN_TYPING_MS;
        logger.info(`[typing-deep] executeReply: incTyping done, will wait ${Math.round(waitMs)}ms before sending first reply (min=${minS}s max=${maxS}s)`);

        await new Promise<void>((resolve) => { setTimeout(resolve, waitMs); });

        if (!jobs.has(jobId)) {
          logger.info('[typing-deep] job removed during typing wait, finishing');
          decTyping();
          finish();
          return;
        }

        const didPat = await trySendPat();
       if (didPat) {
         await new Promise<void>((resolve) => { setTimeout(resolve, 800 + Math.random() * 600); });
       }

        const weightMap: Record<number, number> = { 1: 70, 2: 18, 3: 8, 4: 3, 5: 1 };
        const candidates: { count: number; weight: number }[] = [];
        let totalWeight = 0;
        for (let c = 1; c <= 5; c++) {
          const w = weightMap[c] ?? 1;
          candidates.push({ count: c, weight: w });
          totalWeight += w;
        }
        let replyCount = 1;
       if (candidates.length > 1 && totalWeight > 0) {
         const r = Math.random() * totalWeight;
         let acc = 0;
         for (const { count, weight } of candidates) {
           acc += weight;
           if (r < acc) {
             replyCount = count;
             break;
           }
         }
       }

        let lastCardId = '';
        let lastStickerUrl = '';

         for (let idx = 0; idx < replyCount; idx++) {
           if (!jobs.has(jobId) && idx > 0) break;
           if (checkFlood()) break;

           const nextMsgId = idx === 0 ? messageId : generateMessageId();
           if (idx > 0) {
             markSentMessageId(nextMsgId);
             recordSent();
           }

           const cardPool = idx === 0
             ? getSafeReplyCards(pending.cardIds)
              : getRandomCardsFn(50, 'all');
            logger.info(`[concat-debug] reply idx=${idx}: cardPool=${cardPool.length}, source=${idx === 0 ? 'pending.cardIds' : 'random(50,all)'}`);
           if (cardPool.length === 0) break;

           if (!jobs.has(jobId) && idx > 0) break;

           const useQuote = idx === 0;
           const sent = await sendOneReply(cardPool, nextMsgId, useQuote, lastCardId, lastStickerUrl);
           if (sent && sent.cardId) {
             lastCardId = sent.cardId;
           }
           if (sent && sent.stickerUrl) {
             lastStickerUrl = sent.stickerUrl;
           }

          if (pending.readReceipt) {
            void Promise.resolve(markReadFn(new Date().toISOString()));
          }

           if (idx < replyCount - 1) {
            decTyping();
            const gapMs = 400 + Math.random() * 600;
            await new Promise<void>((resolve) => { setTimeout(resolve, gapMs); });
            if (!jobs.has(jobId)) break;
            incTyping();
            const minS2 = Math.max(1, replyMinSecondsRef.current);
            const maxS2 = Math.max(minS2, replyMaxSecondsRef.current);
            let waitMs2 = (minS2 + Math.random() * Math.max(0, maxS2 - minS2)) * 1000;
            if (waitMs2 < 1000) waitMs2 = 1000;
            logger.info(`[typing-deep] next reply idx=${idx + 1}: incTyping, wait ${Math.round(waitMs2)}ms`);
            await new Promise<void>((resolve) => { setTimeout(resolve, waitMs2); });
            if (!jobs.has(jobId)) {
              decTyping();
              break;
            }
          }
        }

          // 等两帧确保最后一条消息渲染完成再清除 typing
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
          decTyping();
          logger.info(`[typing-deep] executeReply finished for job=${jobId}`);
          finish();
       })();
    }, [getSafeReplyCards, removeJob, checkFlood, recordSent]);

   const enqueueReply = useCallback((jobId: string, state: PendingReplyState) => {
     replyQueue.push(jobId);
     const job: PendingJob = { id: jobId, state, timer: null };
     jobs.set(jobId, job);
      usePendingReplyStore.getState().setHasActiveJob(true);
      logger.info(`[typing-counter] enqueueReply job=${jobId} willReply=${state.willReply} queueLen=${replyQueue.length} executing=${executingId} scheduled=${scheduledId} cardIdsCount=${state.cardIds?.length || 0}`);
      logger.info(`[reply-queue] enqueue job=${jobId} queueLen=${replyQueue.length} executing=${executingId} scheduled=${scheduledId}`);
      if (replyQueue.length === 1 && !executingId && !scheduledId) {
        logger.info(`[typing-counter] enqueueReply trigger scheduleNextFromQueue`);
       scheduleNextFromQueue();
     }
   }, []);

    const scheduleNextFromQueue = useCallback(() => {
       logger.info(`[typing-counter] scheduleNextFromQueue called. executing=${executingId} scheduled=${scheduledId} queueLen=${replyQueue.length} jobs=${jobs.size}`);
       if (executingId || scheduledId) {
         logger.info(`[typing-counter] scheduleNextFromQueue early return: executingId=${executingId} scheduledId=${scheduledId}`);
         return;
       }
        if (replyQueue.length === 0) {
          if (jobs.size === 0 && executingId === null) {
            logger.info('[typing-counter] scheduleNext queue empty & no jobs & no executing');
            usePendingReplyStore.getState().setHasActiveJob(false);
          }
          return;
        }
       const nextId = replyQueue.shift();
       if (!nextId) {
         scheduleNextFromQueue();
         return;
       }
        const nextJob = jobs.get(nextId);
        if (!nextJob) {
          logger.info(`[typing-counter] scheduleNext job not found in jobs map: ${nextId}`);
          scheduleNextFromQueue();
          return;
        }
       scheduledId = nextId;
       logger.info(`[reply-queue] scheduleNext job=${nextId} queueLen=${replyQueue.length}`);
        const now2 = Date.now();
        const typingStartAt = nextJob.state.typingStartAt ?? now2;
        const startDelay = Math.max(0, typingStartAt - now2);
        logger.info(`[typing-deep] scheduleNext: job=${nextId}, typingStartAt=${new Date(typingStartAt).toISOString()}, startDelay=${Math.round(startDelay)}ms (read+800ms gap)`);
        const timer = setTimeout(() => {
        scheduledId = null;
        if (!jobs.has(nextId)) {
          logger.info(`[reply-queue] scheduled job not found, skip ${nextId}`);
          scheduleNextFromQueue();
          return;
        }
        executeReply(nextId, nextJob.state);
      }, startDelay);
      nextJob.timer = timer;
    }, []);

    const startPending = useCallback((
      userMsgId: string,
      userMsgContent: string,
      willReply: boolean,
      delayMs: number,
      cards: ReplyCard[],
      quoteTo: string | null,
      quoteContent: string | null,
      quoteSender: 'me' | 'ta' | null,
    ) => {
      const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const messageId = generateMessageId();
       const now = Date.now();
       const readDelay = 1000 + Math.random() * 9000;
       const typingStartDelay = readDelay + TYPING_AFTER_READ_DELAY_MS;
      const state: PendingReplyState = {
        exists: true,
        userMsgId,
        userMsgContent,
        willReply,
        startedAt: new Date(now).toISOString(),
        scheduledAt: new Date(now + delayMs).toISOString(),
        cardIds: cards.map((c) => c.id),
        quoteTo,
        quoteContent,
        quoteSender,
        readReceipt: readReceiptRef.current,
        messageId,
        typingStartAt: now + typingStartDelay,
      };

     if (readReceiptRef.current) {
       setTimeout(() => {
         void Promise.resolve(markReadFn(new Date(now + readDelay).toISOString()));
       }, readDelay);
     }

     if (willReply) {
       enqueueReply(jobId, state);
       savePendingReply(state);
     } else {
       clearPendingReply();
     }
   }, [enqueueReply]);

   const cancelPending = useCallback(() => {
     for (const [id] of jobs) {
       removeJob(id);
     }
     jobs.clear();
     replyQueue.length = 0;
     clearPendingReply();
     logger.info('[typing-counter] cancelPending: resetTyping, clearing all jobs');
     resetTyping();
     executingId = null;
     scheduledId = null;
   }, [removeJob]);

  useEffect(() => {
    const pending = getPendingReply();
    const storeState = usePendingReplyStore.getState();

    if (executingId !== null || scheduledId !== null || jobs.size > 0 || storeState.hasActiveJob) {
      return;
    }

     if (!pending) {
       if (storeState.typingCount > 0) {
         logger.info('[typing-counter] mount restore no pending, resetTyping');
         resetTyping();
       }
       return;
     }

     if (pending.messageId && hasSentMessageId(pending.messageId)) {
       logger.warn('恢复 pending 时发现消息已发送过，直接清理', pending.messageId);
       logger.info('[typing-counter] mount restore already sent, resetTyping');
       clearPendingReply();
       resetTyping();
       return;
     }

    const jobId = `restore_${Date.now()}`;
     const now = Date.now();

    if (pending.readReceipt) {
      void Promise.resolve(markReadFn(new Date().toISOString()));
    }
    if (!pending.willReply) {
      clearPendingReply();
      return;
    }
    enqueueReply(jobId, pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    const setIsTyping = (v: boolean) => {
      if (v) {
        incTyping();
      } else {
        resetTyping();
      }
    };
   const setForceConcat = (v: boolean) => { forceConcatRef.current = v; };

   const incTypingCb = useCallback(() => { incTyping(); }, []);
   const decTypingCb = useCallback(() => { decTyping(); }, []);

    return { isTyping, setIsTyping, incTyping: incTypingCb, decTyping: decTypingCb, startPending, cancelPending, setForceConcat };
}
