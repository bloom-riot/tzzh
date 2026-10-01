import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { ReplyCardService } from './reply-card.service';
import type {
  ReplyCard,
  CreateReplyCardDto,
  UpdateReplyCardDto,
  ReplyCardListResponse,
  RandomCardResponse,
} from '@shared/api.interface';

@Controller('api/reply-cards')
export class ReplyCardController {
  constructor(private readonly replyCardService: ReplyCardService) {}

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('category') category?: string,
  ): Promise<ReplyCardListResponse> {
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    return this.replyCardService.findAll(pageNum, pageSizeNum, category);
  }

  @Get('random')
  async getRandom(): Promise<RandomCardResponse> {
    return this.replyCardService.getRandom();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReplyCard> {
    return this.replyCardService.findOne(id);
  }

  @NeedLogin()
  @Post()
  async create(@Body() dto: CreateReplyCardDto): Promise<ReplyCard> {
    return this.replyCardService.create(dto);
  }

  @NeedLogin()
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReplyCardDto,
  ): Promise<ReplyCard> {
    return this.replyCardService.update(id, dto);
  }

  @NeedLogin()
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true }> {
    return this.replyCardService.remove(id);
  }
}
