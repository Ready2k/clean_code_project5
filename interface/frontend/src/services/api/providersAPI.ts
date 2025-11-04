/**
 * Provider Management API Service
 * 
 * This service handles all API calls related to dynamic provider management,
 * including providers, models, templates, and testing functionality.
 */

import apiClient from './client';
import {
  Provider,
  Model,
  ProviderTemplate,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProviderResponse,
  ProviderListResponse,
  CreateModelRequest,
  UpdateModelRequest,
  ModelResponse,
  ModelListResponse,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateResponse,
  TemplateListResponse,
  ApplyTemplateRequest,
  ProviderTestResult,
  ModelTestResult,
  ValidationResult,
  ProviderStats,
  ModelStats,
  SystemProviderStats,
  ProviderHealth,
  ProviderQueryOptions,
  ModelQueryOptions,
  TemplateQueryOptions,
  ProviderExportData,
  ProviderImportRequest,
  ProviderImportResult,
} from '../../types/providers';

class ProvidersAPIService {
  // ============================================================================
  // Provider Management
  // ============================================================================

  /**
   * Get all providers with optional filtering and pagination
   */
  async getProviders(options?: ProviderQueryOptions): Promise<ProviderListResponse> {
    const params = new URLSearchParams();
    
    if (options?.status?.length) {
      params.append('status', options.status.join(','));
    }
    if (options?.authMethod?.length) {
      params.append('authMethod', options.authMethod.join(','));
    }
    if (options?.isSystem !== undefined) {
      params.append('isSystem', options.isSystem.toString());
    }
    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.sortBy) {
      params.append('sortBy', options.sortBy);
    }
    if (options?.sortOrder) {
      params.append('sortOrder', options.sortOrder);
    }
    if (options?.page) {
      params.append('page', options.page.toString());
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }

    const queryString = params.toString();
    const url = `/admin/providers${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<{ success: boolean; data: ProviderListResponse }>(url);
    return response.data.data;
  }

  /**
   * Get a specific provider by ID
   */
  async getProvider(id: string): Promise<Provider> {
    const response = await apiClient.get<ProviderResponse>(`/admin/providers/${id}`);
    return response.data.provider;
  }

  /**
   * Create a new provider
   */
  async createProvider(data: CreateProviderRequest): Promise<Provider> {
    const response = await apiClient.post<ProviderResponse>('/admin/providers', data);
    return response.data.provider;
  }

  /**
   * Update an existing provider
   */
  async updateProvider(id: string, data: UpdateProviderRequest): Promise<Provider> {
    const response = await apiClient.put<ProviderResponse>(`/admin/providers/${id}`, data);
    return response.data.provider;
  }

  /**
   * Delete a provider
   */
  async deleteProvider(id: string): Promise<void> {
    await apiClient.delete(`/admin/providers/${id}`);
  }

  /**
   * Test provider connectivity and configuration
   */
  async testProvider(id: string): Promise<ProviderTestResult> {
    const response = await apiClient.post<{ data: { testResult: ProviderTestResult } }>(`/admin/providers/${id}/test`);
    return response.data.data.testResult;
  }

  /**
   * Get provider statistics and usage data
   */
  async getProviderStats(id: string): Promise<ProviderStats> {
    const response = await apiClient.get<{ stats: ProviderStats }>(`/admin/providers/${id}/stats`);
    return response.data.stats;
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(id: string): Promise<ProviderHealth> {
    const response = await apiClient.get<{ health: ProviderHealth }>(`/admin/providers/${id}/health`);
    return response.data.health;
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * Get models for a specific provider or all models
   */
  async getModels(options?: ModelQueryOptions): Promise<ModelListResponse> {
    const params = new URLSearchParams();
    
    if (options?.providerId) {
      params.append('providerId', options.providerId);
    }
    if (options?.status?.length) {
      params.append('status', options.status.join(','));
    }
    if (options?.isDefault !== undefined) {
      params.append('isDefault', options.isDefault.toString());
    }
    if (options?.minContextLength) {
      params.append('minContextLength', options.minContextLength.toString());
    }
    if (options?.maxContextLength) {
      params.append('maxContextLength', options.maxContextLength.toString());
    }
    if (options?.capabilities?.length) {
      params.append('capabilities', options.capabilities.join(','));
    }
    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.sortBy) {
      params.append('sortBy', options.sortBy);
    }
    if (options?.sortOrder) {
      params.append('sortOrder', options.sortOrder);
    }
    if (options?.page) {
      params.append('page', options.page.toString());
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }

    const queryString = params.toString();
    const url = `/admin/models${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<{ success: boolean; data: ModelListResponse }>(url);
    return response.data.data;
  }

  /**
   * Get models for a specific provider
   */
  async getProviderModels(providerId: string): Promise<Model[]> {
    const response = await apiClient.get<ModelListResponse>(`/admin/providers/${providerId}/models`);
    return response.data.models;
  }

  /**
   * Get a specific model by ID
   */
  async getModel(id: string): Promise<Model> {
    const response = await apiClient.get<ModelResponse>(`/admin/models/${id}`);
    return response.data.model;
  }

  /**
   * Create a new model for a provider
   */
  async createModel(providerId: string, data: CreateModelRequest): Promise<Model> {
    const response = await apiClient.post<ModelResponse>(`/admin/providers/${providerId}/models`, data);
    return response.data.model;
  }

  /**
   * Update an existing model
   */
  async updateModel(id: string, data: UpdateModelRequest): Promise<Model> {
    const response = await apiClient.put<ModelResponse>(`/admin/models/${id}`, data);
    return response.data.model;
  }

  /**
   * Delete a model
   */
  async deleteModel(id: string): Promise<void> {
    await apiClient.delete(`/admin/models/${id}`);
  }

  /**
   * Test model availability and capabilities
   */
  async testModel(id: string): Promise<ModelTestResult> {
    const response = await apiClient.post<{ result: ModelTestResult }>(`/admin/models/${id}/test`);
    return response.data.result;
  }

  /**
   * Get model statistics and usage data
   */
  async getModelStats(id: string): Promise<ModelStats> {
    const response = await apiClient.get<{ stats: ModelStats }>(`/admin/models/${id}/stats`);
    return response.data.stats;
  }

  /**
   * Bulk create models for a provider
   */
  async bulkCreateModels(providerId: string, models: CreateModelRequest[]): Promise<Model[]> {
    const response = await apiClient.post<{ models: Model[] }>(`/admin/providers/${providerId}/models/bulk`, { models });
    return response.data.models;
  }

  /**
   * Bulk update models
   */
  async bulkUpdateModels(updates: Array<{ id: string; data: UpdateModelRequest }>): Promise<Model[]> {
    const response = await apiClient.put<{ models: Model[] }>('/admin/models/bulk', { updates });
    return response.data.models;
  }

  /**
   * Bulk delete models
   */
  async bulkDeleteModels(ids: string[]): Promise<void> {
    await apiClient.delete('/admin/models/bulk', { data: { ids } });
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  /**
   * Get all provider templates
   */
  async getTemplates(options?: TemplateQueryOptions): Promise<TemplateListResponse> {
    const params = new URLSearchParams();
    
    if (options?.isSystem !== undefined) {
      params.append('isSystem', options.isSystem.toString());
    }
    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.category) {
      params.append('category', options.category);
    }
    if (options?.sortBy) {
      params.append('sortBy', options.sortBy);
    }
    if (options?.sortOrder) {
      params.append('sortOrder', options.sortOrder);
    }
    if (options?.page) {
      params.append('page', options.page.toString());
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }

    const queryString = params.toString();
    const url = `/admin/provider-templates${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<TemplateListResponse>(url);
    return response.data;
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<ProviderTemplate> {
    const response = await apiClient.get<TemplateResponse>(`/admin/provider-templates/${id}`);
    return response.data.template;
  }

  /**
   * Create a new provider template
   */
  async createTemplate(data: CreateTemplateRequest): Promise<ProviderTemplate> {
    const response = await apiClient.post<TemplateResponse>('/admin/provider-templates', data);
    return response.data.template;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id: string, data: UpdateTemplateRequest): Promise<ProviderTemplate> {
    const response = await apiClient.put<TemplateResponse>(`/admin/provider-templates/${id}`, data);
    return response.data.template;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    await apiClient.delete(`/admin/provider-templates/${id}`);
  }

  /**
   * Apply a template to create a new provider
   */
  async applyTemplate(data: ApplyTemplateRequest): Promise<Provider> {
    const response = await apiClient.post<ProviderResponse>('/admin/provider-templates/apply', data);
    return response.data.provider;
  }

  /**
   * Preview template application (validation only)
   */
  async previewTemplate(data: ApplyTemplateRequest): Promise<ValidationResult> {
    const response = await apiClient.post<{ validation: ValidationResult }>('/admin/provider-templates/preview', data);
    return response.data.validation;
  }

  // ============================================================================
  // System Operations
  // ============================================================================

  /**
   * Refresh the provider registry
   */
  async refreshRegistry(): Promise<void> {
    await apiClient.post('/admin/providers/refresh-registry');
  }

  /**
   * Get registry status and statistics
   */
  async getRegistryStatus(): Promise<SystemProviderStats> {
    const response = await apiClient.get<{ status: SystemProviderStats }>('/admin/providers/registry-status');
    return response.data.status;
  }

  /**
   * Get system-wide provider statistics
   */
  async getSystemStats(): Promise<SystemProviderStats> {
    const response = await apiClient.get<{ success: boolean; data: { stats: SystemProviderStats } }>('/admin/providers/system-stats');
    return response.data.data.stats;
  }

  /**
   * Get health status for all providers
   */
  async getAllProviderHealth(): Promise<ProviderHealth[]> {
    const response = await apiClient.get<{ success: boolean; data: { health: ProviderHealth[] } }>('/admin/providers/health');
    return response.data.data.health;
  }

  // ============================================================================
  // Import/Export Operations
  // ============================================================================

  /**
   * Export provider configurations
   */
  async exportProviders(options?: {
    providerIds?: string[];
    includeModels?: boolean;
    includeTemplates?: boolean;
    includeSystemProviders?: boolean;
    format?: 'json' | 'yaml';
  }): Promise<ProviderExportData> {
    const params = new URLSearchParams();
    
    if (options?.providerIds?.length) {
      params.append('providerIds', options.providerIds.join(','));
    }
    if (options?.includeModels !== undefined) {
      params.append('includeModels', options.includeModels.toString());
    }
    if (options?.includeTemplates !== undefined) {
      params.append('includeTemplates', options.includeTemplates.toString());
    }
    if (options?.includeSystemProviders !== undefined) {
      params.append('includeSystemProviders', options.includeSystemProviders.toString());
    }
    if (options?.format) {
      params.append('format', options.format);
    }

    const queryString = params.toString();
    const url = `/admin/providers/export${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ProviderExportData>(url);
    return response.data;
  }

  /**
   * Import provider configurations
   */
  async importProviders(data: ProviderImportRequest): Promise<ProviderImportResult> {
    const response = await apiClient.post<ProviderImportResult>('/admin/providers/import', data);
    return response.data;
  }

  /**
   * Validate import data without actually importing
   */
  async validateImport(data: ProviderExportData): Promise<ValidationResult> {
    const response = await apiClient.post<{ validation: ValidationResult }>('/admin/providers/validate-import', { data });
    return response.data.validation;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get available authentication methods
   */
  async getAuthMethods(): Promise<Array<{ value: string; label: string; description: string }>> {
    const response = await apiClient.get<{ methods: Array<{ value: string; label: string; description: string }> }>('/admin/providers/auth-methods');
    return response.data.methods;
  }

  /**
   * Get supported capabilities
   */
  async getSupportedCapabilities(): Promise<Array<{ key: string; label: string; description: string }>> {
    const response = await apiClient.get<{ capabilities: Array<{ key: string; label: string; description: string }> }>('/admin/providers/capabilities');
    return response.data.capabilities;
  }

  /**
   * Validate provider configuration
   */
  async validateProviderConfig(config: Partial<CreateProviderRequest>): Promise<ValidationResult> {
    const response = await apiClient.post<{ validation: ValidationResult }>('/admin/providers/validate', config);
    return response.data.validation;
  }

  /**
   * Validate model configuration
   */
  async validateModelConfig(config: Partial<CreateModelRequest>): Promise<ValidationResult> {
    const response = await apiClient.post<{ validation: ValidationResult }>('/admin/models/validate', config);
    return response.data.validation;
  }
}

// Create and export singleton instance
export const providersAPI = new ProvidersAPIService();
export default providersAPI;