/**
 * Provider Management Redux Slice
 * 
 * This slice manages the state for dynamic provider management,
 * including providers, models, templates, and related operations.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  Provider,
  Model,
  ProviderTemplate,
  CreateProviderRequest,
  UpdateProviderRequest,
  CreateModelRequest,
  UpdateModelRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ApplyTemplateRequest,
  ProviderTestResult,
  ModelTestResult,
  ProviderStats,
  ModelStats,
  SystemProviderStats,
  ProviderHealth,
  ProviderQueryOptions,
  ModelQueryOptions,
  TemplateQueryOptions,
  ProviderFilters,
  ModelFilters,
} from '../../types/providers';
import { providersAPI } from '../../services/api/providersAPI';

// ============================================================================
// State Interface
// ============================================================================

interface ProvidersState {
  // Provider data
  providers: Provider[];
  selectedProvider: Provider | null;
  providerStats: Record<string, ProviderStats>;
  providerHealth: Record<string, ProviderHealth>;
  
  // Model data
  models: Model[];
  selectedModel: Model | null;
  modelStats: Record<string, ModelStats>;
  
  // Template data
  templates: ProviderTemplate[];
  selectedTemplate: ProviderTemplate | null;
  
  // System data
  systemStats: SystemProviderStats | null;
  
  // UI state
  filters: {
    providers: ProviderFilters;
    models: ModelFilters;
  };
  pagination: {
    providers: { page: number; limit: number; total: number };
    models: { page: number; limit: number; total: number };
    templates: { page: number; limit: number; total: number };
  };
  
  // Loading states
  loading: {
    providers: boolean;
    models: boolean;
    templates: boolean;
    systemStats: boolean;
    testing: Record<string, boolean>; // provider/model ID -> testing state
  };
  
  // Error states
  error: {
    providers: string | null;
    models: string | null;
    templates: string | null;
    systemStats: string | null;
  };
  
  // Test results
  testResults: {
    providers: Record<string, ProviderTestResult>;
    models: Record<string, ModelTestResult>;
  };
}

const initialState: ProvidersState = {
  providers: [],
  selectedProvider: null,
  providerStats: {},
  providerHealth: {},
  
  models: [],
  selectedModel: null,
  modelStats: {},
  
  templates: [],
  selectedTemplate: null,
  
  systemStats: null,
  
  filters: {
    providers: {},
    models: {},
  },
  pagination: {
    providers: { page: 1, limit: 20, total: 0 },
    models: { page: 1, limit: 20, total: 0 },
    templates: { page: 1, limit: 20, total: 0 },
  },
  
  loading: {
    providers: false,
    models: false,
    templates: false,
    systemStats: false,
    testing: {},
  },
  
  error: {
    providers: null,
    models: null,
    templates: null,
    systemStats: null,
  },
  
  testResults: {
    providers: {},
    models: {},
  },
};

// ============================================================================
// Async Thunks - Provider Operations
// ============================================================================

export const fetchProviders = createAsyncThunk(
  'providers/fetchProviders',
  async (options?: ProviderQueryOptions) => {
    const response = await providersAPI.getProviders(options);
    return response;
  }
);

export const fetchProvider = createAsyncThunk(
  'providers/fetchProvider',
  async (id: string) => {
    const provider = await providersAPI.getProvider(id);
    return provider;
  }
);

export const createProvider = createAsyncThunk(
  'providers/createProvider',
  async (data: CreateProviderRequest) => {
    const provider = await providersAPI.createProvider(data);
    return provider;
  }
);

export const updateProvider = createAsyncThunk(
  'providers/updateProvider',
  async ({ id, data }: { id: string; data: UpdateProviderRequest }) => {
    const provider = await providersAPI.updateProvider(id, data);
    return provider;
  }
);

export const deleteProvider = createAsyncThunk(
  'providers/deleteProvider',
  async (id: string) => {
    await providersAPI.deleteProvider(id);
    return id;
  }
);

export const testProvider = createAsyncThunk(
  'providers/testProvider',
  async (id: string) => {
    const result = await providersAPI.testProvider(id);
    return { id, result };
  }
);

export const fetchProviderStats = createAsyncThunk(
  'providers/fetchProviderStats',
  async (id: string) => {
    const stats = await providersAPI.getProviderStats(id);
    return { id, stats };
  }
);

export const fetchProviderHealth = createAsyncThunk(
  'providers/fetchProviderHealth',
  async (id: string) => {
    const health = await providersAPI.getProviderHealth(id);
    return { id, health };
  }
);

// ============================================================================
// Async Thunks - Model Operations
// ============================================================================

export const fetchModels = createAsyncThunk(
  'providers/fetchModels',
  async (options?: ModelQueryOptions) => {
    const response = await providersAPI.getModels(options);
    return response;
  }
);

export const fetchProviderModels = createAsyncThunk(
  'providers/fetchProviderModels',
  async (providerId: string) => {
    const models = await providersAPI.getProviderModels(providerId);
    return { providerId, models };
  }
);

export const fetchModel = createAsyncThunk(
  'providers/fetchModel',
  async (id: string) => {
    const model = await providersAPI.getModel(id);
    return model;
  }
);

export const createModel = createAsyncThunk(
  'providers/createModel',
  async ({ providerId, data }: { providerId: string; data: CreateModelRequest }) => {
    const model = await providersAPI.createModel(providerId, data);
    return model;
  }
);

export const updateModel = createAsyncThunk(
  'providers/updateModel',
  async ({ id, data }: { id: string; data: UpdateModelRequest }) => {
    const model = await providersAPI.updateModel(id, data);
    return model;
  }
);

export const deleteModel = createAsyncThunk(
  'providers/deleteModel',
  async (id: string) => {
    await providersAPI.deleteModel(id);
    return id;
  }
);

export const testModel = createAsyncThunk(
  'providers/testModel',
  async (id: string) => {
    const result = await providersAPI.testModel(id);
    return { id, result };
  }
);

export const bulkCreateModels = createAsyncThunk(
  'providers/bulkCreateModels',
  async ({ providerId, models }: { providerId: string; models: CreateModelRequest[] }) => {
    const createdModels = await providersAPI.bulkCreateModels(providerId, models);
    return createdModels;
  }
);

export const bulkDeleteModels = createAsyncThunk(
  'providers/bulkDeleteModels',
  async (ids: string[]) => {
    await providersAPI.bulkDeleteModels(ids);
    return ids;
  }
);

// ============================================================================
// Async Thunks - Template Operations
// ============================================================================

export const fetchTemplates = createAsyncThunk(
  'providers/fetchTemplates',
  async (options?: TemplateQueryOptions) => {
    const response = await providersAPI.getTemplates(options);
    return response;
  }
);

export const fetchTemplate = createAsyncThunk(
  'providers/fetchTemplate',
  async (id: string) => {
    const template = await providersAPI.getTemplate(id);
    return template;
  }
);

export const createTemplate = createAsyncThunk(
  'providers/createTemplate',
  async (data: CreateTemplateRequest) => {
    const template = await providersAPI.createTemplate(data);
    return template;
  }
);

export const updateTemplate = createAsyncThunk(
  'providers/updateTemplate',
  async ({ id, data }: { id: string; data: UpdateTemplateRequest }) => {
    const template = await providersAPI.updateTemplate(id, data);
    return template;
  }
);

export const deleteTemplate = createAsyncThunk(
  'providers/deleteTemplate',
  async (id: string) => {
    await providersAPI.deleteTemplate(id);
    return id;
  }
);

export const applyTemplate = createAsyncThunk(
  'providers/applyTemplate',
  async (data: ApplyTemplateRequest) => {
    const provider = await providersAPI.applyTemplate(data);
    return provider;
  }
);

// ============================================================================
// Async Thunks - System Operations
// ============================================================================

export const fetchSystemStats = createAsyncThunk(
  'providers/fetchSystemStats',
  async () => {
    const stats = await providersAPI.getSystemStats();
    return stats;
  }
);

export const refreshRegistry = createAsyncThunk(
  'providers/refreshRegistry',
  async () => {
    await providersAPI.refreshRegistry();
  }
);

export const fetchAllProviderHealth = createAsyncThunk(
  'providers/fetchAllProviderHealth',
  async () => {
    const health = await providersAPI.getAllProviderHealth();
    return health;
  }
);

// ============================================================================
// Slice Definition
// ============================================================================

const providersSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    // UI state management
    setSelectedProvider: (state, action: PayloadAction<Provider | null>) => {
      state.selectedProvider = action.payload;
    },
    
    setSelectedModel: (state, action: PayloadAction<Model | null>) => {
      state.selectedModel = action.payload;
    },
    
    setSelectedTemplate: (state, action: PayloadAction<ProviderTemplate | null>) => {
      state.selectedTemplate = action.payload;
    },
    
    // Filter management
    setProviderFilters: (state, action: PayloadAction<Partial<ProviderFilters>>) => {
      state.filters.providers = { ...state.filters.providers, ...action.payload };
    },
    
    setModelFilters: (state, action: PayloadAction<Partial<ModelFilters>>) => {
      state.filters.models = { ...state.filters.models, ...action.payload };
    },
    
    clearProviderFilters: (state) => {
      state.filters.providers = {};
    },
    
    clearModelFilters: (state) => {
      state.filters.models = {};
    },
    
    // Pagination management
    setProviderPagination: (state, action: PayloadAction<Partial<{ page: number; limit: number; total: number }>>) => {
      state.pagination.providers = { ...state.pagination.providers, ...action.payload };
    },
    
    setModelPagination: (state, action: PayloadAction<Partial<{ page: number; limit: number; total: number }>>) => {
      state.pagination.models = { ...state.pagination.models, ...action.payload };
    },
    
    setTemplatePagination: (state, action: PayloadAction<Partial<{ page: number; limit: number; total: number }>>) => {
      state.pagination.templates = { ...state.pagination.templates, ...action.payload };
    },
    
    // Clear errors
    clearErrors: (state) => {
      state.error = {
        providers: null,
        models: null,
        templates: null,
        systemStats: null,
      };
    },
    
    clearProviderError: (state) => {
      state.error.providers = null;
    },
    
    clearModelError: (state) => {
      state.error.models = null;
    },
    
    clearTemplateError: (state) => {
      state.error.templates = null;
    },
  },
  
  extraReducers: (builder) => {
    // ========================================================================
    // Provider Operations
    // ========================================================================
    
    // Fetch providers
    builder
      .addCase(fetchProviders.pending, (state) => {
        state.loading.providers = true;
        state.error.providers = null;
      })
      .addCase(fetchProviders.fulfilled, (state, action) => {
        state.loading.providers = false;
        state.providers = action.payload.providers;
        state.pagination.providers.total = action.payload.total;
        if (action.payload.page) {
          state.pagination.providers.page = action.payload.page;
        }
      })
      .addCase(fetchProviders.rejected, (state, action) => {
        state.loading.providers = false;
        state.error.providers = action.error.message || 'Failed to fetch providers';
      });
    
    // Fetch single provider
    builder
      .addCase(fetchProvider.fulfilled, (state, action) => {
        const index = state.providers.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.providers[index] = action.payload;
        } else {
          state.providers.push(action.payload);
        }
        state.selectedProvider = action.payload;
      });
    
    // Create provider
    builder
      .addCase(createProvider.fulfilled, (state, action) => {
        state.providers.push(action.payload);
        state.pagination.providers.total += 1;
      });
    
    // Update provider
    builder
      .addCase(updateProvider.fulfilled, (state, action) => {
        const index = state.providers.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.providers[index] = action.payload;
        }
        if (state.selectedProvider?.id === action.payload.id) {
          state.selectedProvider = action.payload;
        }
      });
    
    // Delete provider
    builder
      .addCase(deleteProvider.fulfilled, (state, action) => {
        state.providers = state.providers.filter(p => p.id !== action.payload);
        state.pagination.providers.total -= 1;
        if (state.selectedProvider?.id === action.payload) {
          state.selectedProvider = null;
        }
        // Remove related data
        delete state.providerStats[action.payload];
        delete state.providerHealth[action.payload];
        delete state.testResults.providers[action.payload];
      });
    
    // Test provider
    builder
      .addCase(testProvider.pending, (state, action) => {
        state.loading.testing[action.meta.arg] = true;
      })
      .addCase(testProvider.fulfilled, (state, action) => {
        state.loading.testing[action.payload.id] = false;
        state.testResults.providers[action.payload.id] = action.payload.result;
        
        // Update provider with test result
        const provider = state.providers.find(p => p.id === action.payload.id);
        if (provider) {
          provider.testResult = action.payload.result;
          provider.lastTested = action.payload.result.testedAt;
        }
      })
      .addCase(testProvider.rejected, (state, action) => {
        state.loading.testing[action.meta.arg] = false;
      });
    
    // Fetch provider stats
    builder
      .addCase(fetchProviderStats.fulfilled, (state, action) => {
        state.providerStats[action.payload.id] = action.payload.stats;
      });
    
    // Fetch provider health
    builder
      .addCase(fetchProviderHealth.fulfilled, (state, action) => {
        state.providerHealth[action.payload.id] = action.payload.health;
      });
    
    // ========================================================================
    // Model Operations
    // ========================================================================
    
    // Fetch models
    builder
      .addCase(fetchModels.pending, (state) => {
        state.loading.models = true;
        state.error.models = null;
      })
      .addCase(fetchModels.fulfilled, (state, action) => {
        state.loading.models = false;
        state.models = action.payload.models;
        state.pagination.models.total = action.payload.total;
      })
      .addCase(fetchModels.rejected, (state, action) => {
        state.loading.models = false;
        state.error.models = action.error.message || 'Failed to fetch models';
      });
    
    // Fetch provider models
    builder
      .addCase(fetchProviderModels.fulfilled, (state, action) => {
        // Update models for the specific provider
        const providerModels = action.payload.models;
        state.models = state.models.filter(m => m.providerId !== action.payload.providerId);
        state.models.push(...providerModels);
      });
    
    // Create model
    builder
      .addCase(createModel.fulfilled, (state, action) => {
        state.models.push(action.payload);
        state.pagination.models.total += 1;
      });
    
    // Update model
    builder
      .addCase(updateModel.fulfilled, (state, action) => {
        const index = state.models.findIndex(m => m.id === action.payload.id);
        if (index >= 0) {
          state.models[index] = action.payload;
        }
        if (state.selectedModel?.id === action.payload.id) {
          state.selectedModel = action.payload;
        }
      });
    
    // Delete model
    builder
      .addCase(deleteModel.fulfilled, (state, action) => {
        state.models = state.models.filter(m => m.id !== action.payload);
        state.pagination.models.total -= 1;
        if (state.selectedModel?.id === action.payload) {
          state.selectedModel = null;
        }
        delete state.modelStats[action.payload];
        delete state.testResults.models[action.payload];
      });
    
    // Test model
    builder
      .addCase(testModel.pending, (state, action) => {
        state.loading.testing[action.meta.arg] = true;
      })
      .addCase(testModel.fulfilled, (state, action) => {
        state.loading.testing[action.payload.id] = false;
        state.testResults.models[action.payload.id] = action.payload.result;
      })
      .addCase(testModel.rejected, (state, action) => {
        state.loading.testing[action.meta.arg] = false;
      });
    
    // Bulk create models
    builder
      .addCase(bulkCreateModels.fulfilled, (state, action) => {
        state.models.push(...action.payload);
        state.pagination.models.total += action.payload.length;
      });
    
    // Bulk delete models
    builder
      .addCase(bulkDeleteModels.fulfilled, (state, action) => {
        state.models = state.models.filter(m => !action.payload.includes(m.id));
        state.pagination.models.total -= action.payload.length;
        
        // Clean up related data
        action.payload.forEach(id => {
          delete state.modelStats[id];
          delete state.testResults.models[id];
        });
      });
    
    // ========================================================================
    // Template Operations
    // ========================================================================
    
    // Fetch templates
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading.templates = true;
        state.error.templates = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading.templates = false;
        state.templates = action.payload.templates;
        state.pagination.templates.total = action.payload.total;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading.templates = false;
        state.error.templates = action.error.message || 'Failed to fetch templates';
      });
    
    // Create template
    builder
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.templates.push(action.payload);
        state.pagination.templates.total += 1;
      });
    
    // Update template
    builder
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const index = state.templates.findIndex(t => t.id === action.payload.id);
        if (index >= 0) {
          state.templates[index] = action.payload;
        }
        if (state.selectedTemplate?.id === action.payload.id) {
          state.selectedTemplate = action.payload;
        }
      });
    
    // Delete template
    builder
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter(t => t.id !== action.payload);
        state.pagination.templates.total -= 1;
        if (state.selectedTemplate?.id === action.payload) {
          state.selectedTemplate = null;
        }
      });
    
    // Apply template (creates a new provider)
    builder
      .addCase(applyTemplate.fulfilled, (state, action) => {
        state.providers.push(action.payload);
        state.pagination.providers.total += 1;
      });
    
    // ========================================================================
    // System Operations
    // ========================================================================
    
    // Fetch system stats
    builder
      .addCase(fetchSystemStats.pending, (state) => {
        state.loading.systemStats = true;
        state.error.systemStats = null;
      })
      .addCase(fetchSystemStats.fulfilled, (state, action) => {
        state.loading.systemStats = false;
        state.systemStats = action.payload;
      })
      .addCase(fetchSystemStats.rejected, (state, action) => {
        state.loading.systemStats = false;
        state.error.systemStats = action.error.message || 'Failed to fetch system stats';
      });
    
    // Fetch all provider health
    builder
      .addCase(fetchAllProviderHealth.fulfilled, (state, action) => {
        const healthMap: Record<string, ProviderHealth> = {};
        action.payload.forEach(health => {
          healthMap[health.providerId] = health;
        });
        state.providerHealth = healthMap;
      });
  },
});

// ============================================================================
// Actions and Selectors Export
// ============================================================================

export const {
  setSelectedProvider,
  setSelectedModel,
  setSelectedTemplate,
  setProviderFilters,
  setModelFilters,
  clearProviderFilters,
  clearModelFilters,
  setProviderPagination,
  setModelPagination,
  setTemplatePagination,
  clearErrors,
  clearProviderError,
  clearModelError,
  clearTemplateError,
} = providersSlice.actions;

export default providersSlice.reducer;