// 前后端共享的类型定义

// 字卡
export interface ReplyCard {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

// 创建字卡请求
export interface CreateReplyCardDto {
  content: string;
  category?: string;
}

// 更新字卡请求
export interface UpdateReplyCardDto {
  content?: string;
  category?: string;
}

// 字卡列表响应
export interface ReplyCardListResponse {
  items: ReplyCard[];
  total: number;
  page: number;
  pageSize: number;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  content: string;
  sender: 'me' | 'ta' | 'system';
  type?: 'normal' | 'system' | 'pat' | 'sticker' | 'image' | 'call';
  callType?: 'outgoing' | 'incoming' | 'missed' | 'rejected';
  callDuration?: number;
  replyCardId?: string | null;
  createdAt: string;
  quoteTo?: string | null;
  quoteContent?: string | null;
  quoteSender?: 'me' | 'ta' | null;
  isRead?: boolean;
  readAt?: string | null;
  isRecalled?: boolean;
  recalledAt?: string | null;
  stickerUrl?: string | null;
  emojis?: string[] | null;
}

// 发送消息请求
export interface SendMessageDto {
  content: string;
}

// 发送消息响应
export interface SendMessageResponse {
  userMessage: ChatMessage;
  taReply: ChatMessage;
}

// 聊天历史响应
export interface ChatHistoryResponse {
  items: ChatMessage[];
  total: number;
  page: number;
  pageSize: number;
}

// 随机字卡响应
export interface RandomCardResponse {
  card: ReplyCard;
}

// 统计数据
export interface ChatStatsResponse {
  totalCards: number;
  totalMessages: number;
  totalDays: number;
}
