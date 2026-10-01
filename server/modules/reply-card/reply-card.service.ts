import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { replyCard } from '@server/database/schema';
import type {
  ReplyCard,
  ReplyCardListResponse,
  CreateReplyCardDto,
  UpdateReplyCardDto,
  RandomCardResponse,
} from '@shared/api.interface';

@Injectable()
export class ReplyCardService {
  private readonly logger = new Logger(ReplyCardService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  private toReplyCard(row: typeof replyCard.$inferSelect): ReplyCard {
    return {
      id: row.id,
      content: row.content,
      category: row.category ?? 'default',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAll(
    page: number,
    pageSize: number,
    category?: string,
  ): Promise<ReplyCardListResponse> {
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (category) {
      conditions.push(eq(replyCard.category, category));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = this.db.select().from(replyCard);

    const [countResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(replyCard).where(whereClause),
      baseQuery
        .where(whereClause)
        .orderBy(desc(replyCard.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: ReplyCard[] = rows.map((row) => this.toReplyCard(row));

    this.logger.log(`查询字卡列表, page: ${page}, pageSize: ${pageSize}, total: ${total}`);

    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<ReplyCard> {
    const rows = await this.db.select().from(replyCard).where(eq(replyCard.id, id)).limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('字卡不存在');
    }

    return this.toReplyCard(rows[0]);
  }

  async create(dto: CreateReplyCardDto): Promise<ReplyCard> {
    const trimmed = dto.content?.trim();
    if (!trimmed) {
      throw new BadRequestException('字卡内容不能为空');
    }

    const [row] = await this.db
      .insert(replyCard)
      .values({
        content: trimmed,
        category: dto.category ?? 'default',
      })
      .returning();

    this.logger.log(`字卡已创建: ${row.id}`);
    return this.toReplyCard(row);
  }

  async update(id: string, dto: UpdateReplyCardDto): Promise<ReplyCard> {
    const patch: Partial<typeof replyCard.$inferInsert> = {};
    if (dto.content !== undefined) {
      const trimmed = dto.content.trim();
      if (!trimmed) {
        throw new BadRequestException('字卡内容不能为空');
      }
      patch.content = trimmed;
    }
    if (dto.category !== undefined) {
      patch.category = dto.category;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const [row] = await this.db
      .update(replyCard)
      .set(patch as any)
      .where(eq(replyCard.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('字卡不存在');
    }

    this.logger.log(`字卡已更新: ${id}`);
    return this.toReplyCard(row);
  }

  async remove(id: string): Promise<{ success: true }> {
    const deleted = await this.db
      .delete(replyCard)
      .where(eq(replyCard.id, id))
      .returning({ id: replyCard.id });

    if (deleted.length === 0) {
      throw new NotFoundException('字卡不存在');
    }

    this.logger.log(`字卡已删除: ${id}`);
    return { success: true };
  }

  async getRandom(): Promise<RandomCardResponse> {
    const card = await this.getRandomCard();
    if (!card) {
      throw new NotFoundException('字卡库为空');
    }
    return { card: this.toReplyCard(card) };
  }

  async getRandomCard(): Promise<typeof replyCard.$inferSelect | null> {
    const cards = await this.db
      .select()
      .from(replyCard)
      .orderBy(sql`random()`)
      .limit(1);
    return cards[0] ?? null;
  }
}
