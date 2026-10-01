import { Module } from '@nestjs/common';
import { ReplyCardController } from './reply-card.controller';
import { ReplyCardService } from './reply-card.service';

@Module({
  controllers: [ReplyCardController],
  providers: [ReplyCardService],
  exports: [ReplyCardService],
})
export class ReplyCardModule {}
