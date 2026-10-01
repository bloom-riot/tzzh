import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { count, desc, eq } from 'drizzle-orm';
import { chatMessage, replyCard } from '@server/database/schema';
import type {
  ChatHistoryResponse,
  ChatMessage,
  ChatStatsResponse,
  SendMessageResponse,
} from '@shared/api.interface';
import { ReplyCardService } from '../reply-card/reply-card.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly replyCardService: ReplyCardService,
  ) {}

  private toChatMessage(row: typeof chatMessage.$inferSelect): ChatMessage {
    return {
      id: row.id,
      content: row.content,
      sender: row.sender as 'me' | 'ta',
      replyCardId: row.replyCardId ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getMessages(page: number, pageSize: number): Promise<ChatHistoryResponse> {
    const offset = (page - 1) * pageSize;

    const [countResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(chatMessage),
      this.db
        .select()
        .from(chatMessage)
        .orderBy(desc(chatMessage.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: ChatMessage[] = rows.map((row) => this.toChatMessage(row));

    this.logger.log(`查询聊天历史, page: ${page}, pageSize: ${pageSize}, total: ${total}`);

    return { items, total, page, pageSize };
  }

  async sendMessage(userId: string, content: string): Promise<SendMessageResponse> {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestException('消息内容不能为空');
    }

    const [userRow] = await this.db
      .insert(chatMessage)
      .values({
        content: trimmed,
        sender: 'me',
      })
      .returning();

    const userMessage: ChatMessage = this.toChatMessage(userRow);

    const card = await this.replyCardService.getRandomCard();

    const taContent = card ? card.content : '...';
    const taReplyCardId = card ? card.id : null;

    const [taRow] = await this.db
      .insert(chatMessage)
      .values({
        content: taContent,
        sender: 'ta',
        replyCardId: taReplyCardId,
      })
      .returning();

    const taReply: ChatMessage = this.toChatMessage(taRow);

    this.logger.log(
      `消息已发送, userMsgId: ${userMessage.id}, taMsgId: ${taReply.id}, ` +
        `cardId: ${taReplyCardId ?? 'none'}`,
    );

    return { userMessage, taReply };
  }

  async deleteMessage(id: string): Promise<{ success: true }> {
    const deleted = await this.db
      .delete(chatMessage)
      .where(eq(chatMessage.id, id))
      .returning({ id: chatMessage.id });

    if (deleted.length === 0) {
      throw new NotFoundException('消息不存在');
    }

    this.logger.log(`消息已删除: ${id}`);
    return { success: true };
  }

  async clearMessages(): Promise<{ success: true; deletedCount: number }> {
    const deleted = await this.db
      .delete(chatMessage)
      .returning({ id: chatMessage.id });

    const deletedCount = deleted.length;
    this.logger.log(`已清空所有消息, 数量: ${deletedCount}`);

    return { success: true, deletedCount };
  }

  async getStats(): Promise<ChatStatsResponse> {
    const [messagesCountResult, cardsCountResult, firstMessageResult] =
      await Promise.all([
        this.db.select({ count: count() }).from(chatMessage),
        this.db.select({ count: count() }).from(replyCard),
        this.db
          .select({ createdAt: chatMessage.createdAt })
          .from(chatMessage)
          .orderBy(chatMessage.createdAt)
          .limit(1),
      ]);

    const totalMessages = Number(messagesCountResult[0]?.count ?? 0);
    const totalCards = Number(cardsCountResult[0]?.count ?? 0);

    let totalDays = 0;
    if (totalMessages > 1 && firstMessageResult[0]) {
      const firstDate = firstMessageResult[0].createdAt;
      const today = new Date();
      const diffMs = Math.abs(today.getTime() - firstDate.getTime());
      totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    return { totalCards, totalMessages, totalDays };
  }
}
