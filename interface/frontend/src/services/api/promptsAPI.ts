import apiClient from './client';
import { 
  PromptRecord, 
  PromptFilters, 
  CreatePromptRequest, 
  UpdatePromptRequest,
  PromptsResponse 
} from '../../types/prompts';

export const promptsAPI = {
  async getPrompts(filters?: PromptFilters): Promise<PromptsResponse> {
    const response = await apiClient.get('/prompts', { params: filters });
    return response.data;
  },

  async getPrompt(id: string): Promise<PromptRecord> {
    const response = await apiClient.get(`/prompts/${id}`);
    return response.data;
  },

  async createPrompt(data: CreatePromptRequest): Promise<PromptRecord> {
    const response = await apiClient.post('/prompts', data);
    return response.data;
  },

  async updatePrompt(id: string, data: UpdatePromptRequest): Promise<PromptRecord> {
    const response = await apiClient.put(`/prompts/${id}`, data);
    return response.data;
  },

  async deletePrompt(id: string): Promise<void> {
    await apiClient.delete(`/prompts/${id}`);
  },

  async enhancePrompt(id: string, options?: any): Promise<any> {
    const response = await apiClient.post(`/prompts/${id}/enhance`, options);
    return response.data;
  },

  async getEnhancementStatus(id: string, jobId?: string): Promise<any> {
    const params = jobId ? { jobId } : {};
    const response = await apiClient.get(`/prompts/${id}/enhance/status`, { params });
    return response.data;
  },

  async submitQuestionnaireResponse(id: string, jobId: string, answers: Record<string, any>): Promise<void> {
    await apiClient.post(`/prompts/${id}/enhance/questionnaire?jobId=${jobId}`, { jobId, answers });
  },

  async renderPrompt(id: string, provider: string, options: any): Promise<any> {
    const response = await apiClient.post(`/prompts/${id}/render/${provider}`, options);
    return response.data;
  },

  async ratePrompt(promptId: string, rating: { score: number; note?: string }): Promise<void> {
    await apiClient.post(`/ratings/prompts/${promptId}/rate`, rating);
  },

  async getPromptRatings(promptId: string, filters?: any): Promise<any> {
    const response = await apiClient.get(`/ratings/prompts/${promptId}/ratings`, { params: filters });
    return response.data;
  },

  async getPromptRatingAnalytics(promptId: string): Promise<any> {
    const response = await apiClient.get(`/ratings/prompts/${promptId}/analytics`);
    return response.data;
  },

  async getUserRating(promptId: string): Promise<any> {
    const response = await apiClient.get(`/ratings/prompts/${promptId}/user-rating`);
    return response.data;
  },

  async updateRating(ratingId: string, updates: { score?: number; note?: string }): Promise<void> {
    await apiClient.put(`/ratings/${ratingId}`, updates);
  },

  async deleteRating(ratingId: string): Promise<void> {
    await apiClient.delete(`/ratings/${ratingId}`);
  },

  async getSystemRatingStats(): Promise<any> {
    const response = await apiClient.get('/ratings/system/stats');
    return response.data;
  },

  async getRatingTrends(promptId?: string, days?: number): Promise<any> {
    const params: any = {};
    if (days) params.days = days;
    
    const url = promptId ? `/ratings/prompts/${promptId}/trends` : '/ratings/system/trends';
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  async getTopRatedPrompts(limit?: number, minRatingCount?: number): Promise<any> {
    const params: any = {};
    if (limit) params.limit = limit;
    if (minRatingCount) params.minRatingCount = minRatingCount;
    
    const response = await apiClient.get('/ratings/system/top-rated', { params });
    return response.data;
  },

  async filterPromptsByRating(filters: any): Promise<any> {
    const response = await apiClient.get('/ratings/prompts/filter', { params: filters });
    return response.data;
  },
};