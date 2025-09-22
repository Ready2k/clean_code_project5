import apiClient from './client';
import { 
  EnhancementStartRequest, 
  EnhancementJobResponse, 
  EnhancementProgress,
  QuestionnaireResponse 
} from '../../types/enhancement';

export const enhancementAPI = {
  async startEnhancement(promptId: string, options?: EnhancementStartRequest): Promise<EnhancementJobResponse> {
    const response = await apiClient.post(`/prompts/${promptId}/enhance`, options);
    return response.data;
  },

  async getEnhancementStatus(promptId: string, jobId?: string): Promise<EnhancementProgress | { jobs: EnhancementProgress[] }> {
    const params = jobId ? { jobId } : {};
    const response = await apiClient.get(`/prompts/${promptId}/enhance/status`, { params });
    return response.data;
  },

  async submitQuestionnaireResponse(promptId: string, jobId: string, answers: Record<string, any>): Promise<void> {
    const response: QuestionnaireResponse = { jobId, answers };
    await apiClient.post(`/prompts/${promptId}/enhance/questionnaire?jobId=${jobId}`, response);
  },

  async cancelEnhancement(promptId: string, jobId: string): Promise<void> {
    await apiClient.delete(`/prompts/${promptId}/enhance?jobId=${jobId}`);
  }
};