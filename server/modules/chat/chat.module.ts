import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ReplyCardModule } from '../reply-card/reply-card.module';

@Module({
  imports: [ReplyCardModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
