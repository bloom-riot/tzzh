import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import type { SendMessageDto } from '@shared/api.interface';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  async getMessages(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.chatService.getMessages(pageNum, pageSizeNum);
  }

  @NeedLogin()
  @Post('send')
  async sendMessage(@Req() req: Request, @Body() dto: SendMessageDto) {
    const { userId } = req.userContext;
    return this.chatService.sendMessage(userId, dto.content);
  }

  @NeedLogin()
  @Delete('messages')
  async clearMessages() {
    return this.chatService.clearMessages();
  }

  @NeedLogin()
  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string) {
    return this.chatService.deleteMessage(id);
  }

  @Get('stats')
  async getStats() {
    return this.chatService.getStats();
  }
}
