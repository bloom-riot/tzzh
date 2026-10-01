import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  ReplyCard,
  ReplyCardListResponse,
  CreateReplyCardDto,
  UpdateReplyCardDto,
  RandomCardResponse,
} from '@shared/api.interface';

export async function getReplyCards(params?: {
  page?: number;
  pageSize?: number;
  category?: string;
}): Promise<ReplyCardListResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.category) searchParams.set('category', params.category);
    const response = await axiosForBackend.get(`/api/reply-cards?${searchParams.toString()}`);
    return response.data;
  } catch (error) {
    logger.error('获取字卡列表失败', error);
    throw error;
  }
}

export async function getReplyCard(id: string): Promise<ReplyCard> {
  try {
    const response = await axiosForBackend.get(`/api/reply-cards/${id}`);
    return response.data;
  } catch (error) {
    logger.error('获取字卡详情失败', error);
    throw error;
  }
}

export async function createReplyCard(dto: CreateReplyCardDto): Promise<ReplyCard> {
  try {
    const response = await axiosForBackend.post('/api/reply-cards', dto);
    return response.data;
  } catch (error) {
    logger.error('创建字卡失败', error);
    throw error;
  }
}

export async function updateReplyCard(
  id: string,
  dto: UpdateReplyCardDto,
): Promise<ReplyCard> {
  try {
    const response = await axiosForBackend.patch(`/api/reply-cards/${id}`, dto);
    return response.data;
  } catch (error) {
    logger.error('更新字卡失败', error);
    throw error;
  }
}

export async function deleteReplyCard(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend.delete(`/api/reply-cards/${id}`);
    return response.data;
  } catch (error) {
    logger.error('删除字卡失败', error);
    throw error;
  }
}

export async function getRandomCard(): Promise<RandomCardResponse> {
  try {
    const response = await axiosForBackend.get('/api/reply-cards/random');
    return response.data;
  } catch (error) {
    logger.error('获取随机字卡失败', error);
    throw error;
  }
}
