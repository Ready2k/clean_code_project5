import apiClient from './client';

export interface ExportOptions {
  format: 'json' | 'yaml' | 'openai' | 'anthropic' | 'meta';
  includeMetadata?: boolean;
  includeHistory?: boolean;
  includeRatings?: boolean;
  substituteVariables?: boolean;
  variableValues?: Record<string, any>;
  template?: 'minimal' | 'full' | 'provider-ready';
}

export interface BulkExportOptions extends ExportOptions {
  promptIds: string[];
  archiveFormat?: 'zip' | 'tar';
  filename?: string;
}

export interface ExportPreview {
  promptId: string;
  format: string;
  template: string;
  filename: string;
  size: number;
  preview: string;
  truncated: boolean;
  mimeType: string;
  options: ExportOptions;
  generatedAt: string;
}

export interface BulkExportPreview {
  format: string;
  template: string;
  archiveFormat: string;
  filename: string;
  totalPrompts: number;
  validPrompts: number;
  invalidPrompts: number;
  estimatedSize: number;
  prompts: Array<{
    id: string;
    title: string;
    version?: number;
    estimatedSize?: number;
    tags?: string[];
    owner?: string;
    error?: string;
  }>;
  options: BulkExportOptions;
  generatedAt: string;
}

export interface ExportFormat {
  id: string;
  name: string;
  description: string;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  useCase: string;
  includes: string[];
}

export interface ShareLink {
  id: string;
  promptId: string;
  url: string;
  expiresAt?: string;
  accessCount: number;
  maxAccess?: number;
  password?: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ShareLinkRequest {
  promptId: string;
  expiresIn?: number; // hours
  maxAccess?: number;
  password?: string;
  includeMetadata?: boolean;
}

export interface ExportHistory {
  id: string;
  promptId?: string;
  promptIds?: string[];
  format: string;
  template: string;
  filename: string;
  size: number;
  type: 'single' | 'bulk';
  status: 'completed' | 'failed' | 'expired';
  createdAt: string;
  createdBy: string;
  downloadCount: number;
  expiresAt?: string;
}

export const exportAPI = {
  // Get supported formats and templates
  async getFormats(): Promise<{
    formats: ExportFormat[];
    total: number;
    templates: string[];
    archiveFormats: string[];
  }> {
    const response = await apiClient.get('/export/formats');
    return response.data;
  },

  async getTemplates(): Promise<{
    templates: ExportTemplate[];
    total: number;
    default: string;
  }> {
    const response = await apiClient.get('/export/templates');
    return response.data;
  },

  // Single prompt export
  async exportPrompt(promptId: string, options: ExportOptions): Promise<Blob> {
    const response = await apiClient.post(`/export/prompt/${promptId}`, options, {
      responseType: 'blob'
    });
    return response.data;
  },

  async previewExport(promptId: string, options: ExportOptions): Promise<ExportPreview> {
    const response = await apiClient.post(`/export/prompt/${promptId}/preview`, options);
    return response.data;
  },

  // Bulk export
  async bulkExport(options: BulkExportOptions): Promise<Blob> {
    const response = await apiClient.post('/export/bulk', options, {
      responseType: 'blob'
    });
    return response.data;
  },

  async previewBulkExport(options: BulkExportOptions): Promise<BulkExportPreview> {
    const response = await apiClient.post('/export/bulk/preview', options);
    return response.data;
  },

  // Format examples
  async getFormatExample(format: string): Promise<{
    format: string;
    description: string;
    example: any;
    notes: string;
  }> {
    const response = await apiClient.get(`/export/formats/${format}/example`);
    return response.data;
  },

  // Sharing functionality
  async createShareLink(request: ShareLinkRequest): Promise<ShareLink> {
    const response = await apiClient.post('/export/share', request);
    return response.data;
  },

  async getShareLinks(promptId?: string): Promise<ShareLink[]> {
    const params = promptId ? { promptId } : {};
    const response = await apiClient.get('/export/share', { params });
    return response.data;
  },

  async deleteShareLink(linkId: string): Promise<void> {
    await apiClient.delete(`/export/share/${linkId}`);
  },

  async getSharedPrompt(linkId: string, password?: string): Promise<any> {
    const data = password ? { password } : {};
    const response = await apiClient.post(`/export/shared/${linkId}`, data);
    return response.data;
  },

  // Export history
  async getExportHistory(filters?: {
    promptId?: string;
    type?: 'single' | 'bulk';
    status?: 'completed' | 'failed' | 'expired';
    limit?: number;
    offset?: number;
  }): Promise<{
    exports: ExportHistory[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const response = await apiClient.get('/export/history', { params: filters });
    return response.data;
  },

  async deleteExportHistory(exportId: string): Promise<void> {
    await apiClient.delete(`/export/history/${exportId}`);
  },

  async downloadFromHistory(exportId: string): Promise<Blob> {
    const response = await apiClient.get(`/export/history/${exportId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Documentation
  async getDocumentation(): Promise<any> {
    const response = await apiClient.get('/export/documentation');
    return response.data;
  },

  async getOpenAPISpec(): Promise<any> {
    const response = await apiClient.get('/export/openapi');
    return response.data;
  }
};