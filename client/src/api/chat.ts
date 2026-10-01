import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  ChatHistoryResponse,
  SendMessageDto,
  SendMessageResponse,
  ChatStatsResponse,
} from '@shared/api.interface';

export async function getChatHistory(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ChatHistoryResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const response = await axiosForBackend.get(`/api/chat/messages?${searchParams.toString()}`);
    return response.data;
  } catch (error) {
    logger.error('获取聊天历史失败', error);
    throw error;
  }
}

export async function sendMessage(dto: SendMessageDto): Promise<SendMessageResponse> {
  try {
    const response = await axiosForBackend.post('/api/chat/send', dto);
    return response.data;
  } catch (error) {
    logger.error('发送消息失败', error);
    throw error;
  }
}

export async function deleteMessage(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend.delete(`/api/chat/messages/${id}`);
    return response.data;
  } catch (error) {
    logger.error('删除消息失败', error);
    throw error;
  }
}

export async function clearAllMessages(): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const response = await axiosForBackend.delete('/api/chat/messages');
    return response.data;
  } catch (error) {
    logger.error('清空聊天记录失败', error);
    throw error;
  }
}

export async function getChatStats(): Promise<ChatStatsResponse> {
  try {
    const response = await axiosForBackend.get('/api/chat/stats');
    return response.data;
  } catch (error) {
    logger.error('获取聊天统计失败', error);
    throw error;
  }
}
