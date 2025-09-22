import apiClient from './client';
import { 
  LLMConnection, 
  CreateConnectionRequest, 
  UpdateConnectionRequest, 
  ConnectionTestResult 
} from '../../types/connections';

interface ConnectionListResponse {
  connections: LLMConnection[];
  total: number;
}

interface ConnectionResponse {
  connection: LLMConnection;
}

interface ConnectionTestResponse {
  result: ConnectionTestResult;
}

interface AvailableModelsResponse {
  models: string[];
  provider: string;
}

export const connectionsAPI = {
  async getConnections(): Promise<LLMConnection[]> {
    const response = await apiClient.get<ConnectionListResponse>('/connections');
    return response.data.connections;
  },

  async getConnection(id: string): Promise<LLMConnection> {
    const response = await apiClient.get<ConnectionResponse>(`/connections/${id}`);
    return response.data.connection;
  },

  async createConnection(data: CreateConnectionRequest): Promise<LLMConnection> {
    const response = await apiClient.post<ConnectionResponse>('/connections', data);
    return response.data.connection;
  },

  async updateConnection(id: string, data: UpdateConnectionRequest): Promise<LLMConnection> {
    const response = await apiClient.put<ConnectionResponse>(`/connections/${id}`, data);
    return response.data.connection;
  },

  async deleteConnection(id: string): Promise<void> {
    await apiClient.delete(`/connections/${id}`);
  },

  async testConnection(id: string): Promise<ConnectionTestResult> {
    const response = await apiClient.post<ConnectionTestResponse>(`/connections/${id}/test`);
    return response.data.result;
  },

  async getAvailableModels(provider: 'openai' | 'bedrock'): Promise<string[]> {
    const response = await apiClient.get<AvailableModelsResponse>(`/connections/models/${provider}`);
    return response.data.models;
  },

  async testAllConnections(): Promise<Record<string, ConnectionTestResult>> {
    const response = await apiClient.post('/connections/test-all');
    return response.data.results;
  },

  async getConnectionsHealth(): Promise<{
    summary: {
      total: number;
      active: number;
      inactive: number;
      error: number;
      byProvider: Record<string, number>;
    };
    connections: Array<{
      id: string;
      name: string;
      provider: string;
      status: string;
      lastTested?: string;
    }>;
  }> {
    const response = await apiClient.get('/connections/health');
    return response.data;
  }
};