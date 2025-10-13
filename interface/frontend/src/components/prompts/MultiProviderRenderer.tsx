import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  PlayArrow as RenderIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { 
  renderPrompt, 
  renderMultipleProviders,
  clearRenders,
  toggleCompareMode,
  toggleRenderSelection,
  clearRenderSelection,
  addPreviewRender,
} from '../../store/slices/renderingSlice';
import { removeNotification } from '../../store/slices/uiSlice';
import { fetchConnections } from '../../store/slices/connectionsSlice';
import { fetchPrompts } from '../../store/slices/promptsSlice';
import { PromptRecord, RenderResult, RenderOptions } from '../../types/prompts';
import { promptsAPI } from '../../services/api/promptsAPI';
import ProviderSelector from './rendering/ProviderSelector';
import TargetModelSelector from './rendering/TargetModelSelector';
import VersionSelector from './rendering/VersionSelector';
import VariableInputForm from './rendering/VariableInputForm';
import RenderPreview from './rendering/RenderPreview';
import ComparisonView from './rendering/ComparisonView';
import ModelBadge from './ModelBadge';
import RenderProgressIndicator from './rendering/RenderProgressIndicator';
import { PromptAdaptationService } from '../../services/promptAdaptationService';

interface MultiProviderRendererProps {
  prompt: PromptRecord;
  onClose?: () => void;
}

const MultiProviderRenderer: React.FC<MultiProviderRendererProps> = ({
  prompt,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { renders, isLoading, error, compareMode, selectedRenders } = useAppSelector(
    (state) => state.rendering
  );
  const { items: connections } = useAppSelector((state) => state.connections);

  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    temperature: 0.7,
    maxTokens: 2000,
  });
  const [variables, setVariables] = useState<Record<string, any>>({});
  
  // Target model selection state
  const [targetProvider, setTargetProvider] = useState<string>('openai-basic');
  const [targetModel, setTargetModel] = useState<string>('gpt-4o');
  const [adaptationConnectionId, setAdaptationConnectionId] = useState<string>('');
  
  // Version selection state
  const [selectedVersion, setSelectedVersion] = useState<'original' | 'enhanced' | 'original-no-adapt'>('original');

  // Initialize target model based on original prompt
  useEffect(() => {
    const originalProvider = (prompt.metadata as any)?.tuned_for_provider;
    const originalModel = (prompt.metadata as any)?.preferred_model;
    
    if (originalProvider && originalModel) {
      setTargetProvider(originalProvider);
      setTargetModel(originalModel);
    }
  }, [prompt]);

  // Initialize variables with default values
  useEffect(() => {
    const defaultVariables: Record<string, any> = {};
    (prompt.variables || []).forEach((variable) => {
      if (variable.default !== undefined) {
        defaultVariables[variable.key] = variable.default;
      }
    });
    setVariables(defaultVariables);
  }, [prompt.variables]);

  // Fetch connections on mount
  useEffect(() => {
    dispatch(fetchConnections());
  }, [dispatch]);

  // Cleanup notifications on unmount
  useEffect(() => {
    return () => {
      // Clear any render notifications for this prompt when component unmounts
      connections.forEach(connection => {
        dispatch(removeNotification(`render-started-${prompt.id}-${connection.id}`));
        dispatch(removeNotification(`render-progress-${prompt.id}-${connection.id}`));
        dispatch(removeNotification(`render-completed-${prompt.id}-${connection.id}`));
        dispatch(removeNotification(`render-failed-${prompt.id}-${connection.id}`));
      });
    };
  }, [dispatch, prompt.id, connections]);

  const activeConnections = connections.filter(conn => conn.status === 'active');
  const promptRenders = Object.values(renders).filter(render => render.promptId === prompt.id);

  const handleRenderSingle = useCallback((connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    dispatch(renderPrompt({
      promptId: prompt.id,
      connectionId,
      provider: connection.provider,
      options: {
        ...renderOptions,
        variables,
        version: selectedVersion,
      },
    }));
  }, [dispatch, prompt.id, connections, renderOptions, variables, selectedVersion]);

  const [isRendering, setIsRendering] = useState(false);

  const buildNoAdaptationPreview = useCallback(() => {
    const sections = [];
    
    // Goal section
    sections.push(`**Goal:** ${prompt.humanPrompt.goal}`);
    
    // Audience section
    if (prompt.humanPrompt.audience) {
      sections.push(`**Audience:** ${prompt.humanPrompt.audience}`);
    }
    
    // Steps section
    if (prompt.humanPrompt.steps && prompt.humanPrompt.steps.length > 0) {
      sections.push('\n**Steps:**');
      prompt.humanPrompt.steps.forEach((step, i) => {
        sections.push(`${i + 1}. ${step}`);
      });
    }
    
    // Output expectations
    if (prompt.humanPrompt.output_expectations?.format) {
      sections.push(`\n**Expected Output:** ${prompt.humanPrompt.output_expectations.format}`);
    }
    
    return sections.join('\n');
  }, [prompt.humanPrompt]);

  const checkForDuplicatePrompt = useCallback(async (): Promise<boolean> => {
    try {
      // TODO: Implement API call to check for duplicates
      // This would search for prompts with similar goal, steps, and content
      console.log('Checking for duplicate prompts...');
      return false; // No duplicates found for now
    } catch (error) {
      console.error('Failed to check for duplicates:', error);
      return false;
    }
  }, []);

  const handleRenderMultiple = useCallback(async () => {
    // Prevent multiple simultaneous renders
    if (isRendering) {
      console.log('Render already in progress, ignoring duplicate request');
      return;
    }

    // Clear any existing render notifications for this prompt
    selectedConnections.forEach(connectionId => {
      dispatch(removeNotification(`render-started-${prompt.id}-${connectionId}`));
      dispatch(removeNotification(`render-progress-${prompt.id}-${connectionId}`));
      dispatch(removeNotification(`render-completed-${prompt.id}-${connectionId}`));
      dispatch(removeNotification(`render-failed-${prompt.id}-${connectionId}`));
    });

    setIsRendering(true);

    try {
      // Check for duplicate prompts before rendering
      if (selectedVersion !== 'original-no-adapt') {
        const isDuplicate = await checkForDuplicatePrompt();
        if (isDuplicate) {
          return; // User was informed and chose not to proceed
        }
      }

      // Handle "No Adaptation" case - show formatted prompt without LLM execution
      if (selectedVersion === 'original-no-adapt') {
        // Create a mock render result to show the formatted prompt
        // Get original model info for no-adaptation display
        const originalProvider = (prompt.metadata as any)?.tuned_for_provider || 'unknown';
        const originalModel = (prompt.metadata as any)?.preferred_model || 'original';
        
        const mockRender = {
          id: `no-adapt-${Date.now()}`,
          promptId: prompt.id,
          connectionId: 'no-adaptation',
          provider: originalProvider,
          model: originalModel,
          payload: {
            provider: originalProvider,
            model: originalModel,
            messages: [],
            formatted_prompt: buildNoAdaptationPreview(),
            response: `Original Prompt Structure:\n\n${buildNoAdaptationPreview()}\n\n[This is the raw original prompt as originally tuned for ${originalProvider} ${originalModel}]`
          },
          variables,
          createdAt: new Date().toISOString(),
          success: true,
          isPreview: true
        };

        // Add the mock render to the store
        dispatch(addPreviewRender(mockRender));
        return;
      }

      if (selectedConnections.length === 0) return;

      const renders = selectedConnections.map(connectionId => {
        const connection = connections.find(c => c.id === connectionId);
        return {
          connectionId,
          provider: connection!.provider,
          options: {
            ...renderOptions,
            model: connection!.config.defaultModel, // Use connection's model for actual rendering
            targetModel: targetModel, // Pass target model for adaptation/variant tagging
            variables,
            version: selectedVersion,
          },
        };
      });

      await dispatch(renderMultipleProviders({
        promptId: prompt.id,
        renders,
      }));
    } finally {
      setIsRendering(false);
    }
  }, [isRendering, selectedVersion, checkForDuplicatePrompt, buildNoAdaptationPreview, dispatch, addPreviewRender, removeNotification, prompt, selectedConnections, connections, renderOptions, targetModel, variables]);

  const handleSaveVariant = async (render: RenderResult) => {
    console.log('Saving variant with render data:', render);
    try {
      // Extract adapted content from payload
      let adaptedContent = '';
      if (typeof render.payload === 'string') {
        adaptedContent = render.payload;
      } else if (render.payload) {
        adaptedContent = render.payload.response || render.payload.formatted_prompt || '';
      }

      const variantData = {
        provider: render.provider,
        model: render.targetModel || render.model, // Use targetModel for variant tagging, fallback to render model
        adaptedContent,
        renderResult: render
      };

      // Validate required fields
      if (!variantData.provider || !variantData.model || !variantData.adaptedContent) {
        throw new Error('Missing required fields: provider, model, and adaptedContent are required');
      }
      console.log('Saving variant with data:', variantData);
      const result = await promptsAPI.saveVariant(prompt.id, variantData);
      console.log('Variant saved successfully:', result);
      
      // Refresh the prompts list to show the new variant
      dispatch(fetchPrompts({}));
      
      // Show success message
      console.log('Variant saved successfully!');
      
    } catch (error) {
      console.error('Failed to save variant:', error);
      // TODO: Show error message to user
    }
  };

  const handleClearRenders = () => {
    dispatch(clearRenders());
  };

  const handleToggleCompare = () => {
    dispatch(toggleCompareMode());
    if (compareMode) {
      dispatch(clearRenderSelection());
    }
  };

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasRequiredVariables = prompt.variables.some(v => v.required);
  const missingRequiredVariables = prompt.variables
    .filter(v => v.required && (variables[v.key] === undefined || variables[v.key] === ''))
    .map(v => v.key);

  const canRender = missingRequiredVariables.length === 0;

  return (
    <Box sx={{ p: 3, minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexShrink: 0 }}>
        <Box>
          <Typography variant="h5" component="h2">
            Multi-Provider Rendering
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Render for different providers:
            </Typography>
            {(prompt.metadata as any)?.preferred_model && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Originally tuned for:
                </Typography>
                <ModelBadge
                  model={(prompt.metadata as any).preferred_model}
                  provider={(prompt.metadata as any)?.tuned_for_provider}
                  type="tuned"
                  size="small"
                />
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Supports: OpenAI (GPT-3.5, GPT-4), Anthropic (Claude), AWS Bedrock, Meta (Llama), Microsoft Copilot (GPT-4, GPT-3.5)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={compareMode}
                onChange={handleToggleCompare}
                disabled={promptRenders.length < 2}
              />
            }
            label="Compare Mode"
          />
          <Tooltip title="Clear all renders">
            <span>
              <IconButton onClick={handleClearRenders} disabled={promptRenders.length === 0}>
                <ClearIcon />
              </IconButton>
            </span>
          </Tooltip>
          {onClose && (
            <Button onClick={onClose} variant="outlined">
              Close
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        {/* Left Panel - Configuration */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Prompt: {prompt.metadata.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {prompt.metadata.summary}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <TargetModelSelector
                originalProvider={(prompt.metadata as any)?.tuned_for_provider}
                originalModel={(prompt.metadata as any)?.preferred_model}
                selectedProvider={targetProvider}
                selectedModel={targetModel}
                onProviderChange={setTargetProvider}
                onModelChange={setTargetModel}
                existingVariants={prompt.metadata?.tags?.filter(tag => tag.includes('-')) || []}
              />

              <Divider sx={{ my: 2 }} />

              <VersionSelector
                prompt={prompt}
                selectedVersion={selectedVersion}
                onVersionChange={setSelectedVersion}
              />

              <Divider sx={{ my: 2 }} />

              <ProviderSelector
                connections={activeConnections}
                selectedConnections={selectedConnections}
                onSelectionChange={setSelectedConnections}
                renderOptions={renderOptions}
                onOptionsChange={setRenderOptions}
                originalProvider={targetProvider}
                originalModel={targetModel}
              />

              {hasRequiredVariables && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <VariableInputForm
                    variables={prompt.variables}
                    values={variables}
                    onChange={setVariables}
                  />
                </>
              )}

              <Box sx={{ mt: 3, display: 'flex', gap: 1, flexDirection: 'column' }}>
                {!canRender && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Please fill in all required variables: {missingRequiredVariables.join(', ')}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  startIcon={<RenderIcon />}
                  onClick={handleRenderMultiple}
                  disabled={!canRender || (selectedVersion !== 'original-no-adapt' && selectedConnections.length === 0) || isLoading || isRendering}
                  fullWidth
                >
                  {isRendering ? 'Rendering...' : selectedVersion === 'original-no-adapt' ? 'Show Original Prompt' : `Render Selected (${selectedConnections.length})`}
                </Button>

                {error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {error}
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Results */}
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* Show progress indicators for active renders */}
            {isLoading && selectedConnections.map(connectionId => {
              const connection = connections.find(c => c.id === connectionId);
              return (
                <RenderProgressIndicator
                  key={connectionId}
                  promptId={prompt.id}
                  connectionId={connectionId}
                  provider={connection?.provider}
                  compact={false}
                />
              );
            })}

            {compareMode && selectedRenders.length > 0 ? (
              <ComparisonView
                renders={selectedRenders.map(id => renders[id]).filter(Boolean)}
                onCopy={handleCopyToClipboard}
                onDownload={handleDownload}
              />
            ) : (
              <Box>
                {promptRenders.length === 0 ? (
                  <Card>
                    <CardContent>
                      <Typography variant="body1" color="text.secondary" textAlign="center">
                        Select providers and click "Render Selected" to see results here.
                      </Typography>
                    </CardContent>
                  </Card>
                ) : (
                  <Grid container spacing={2}>
                    {promptRenders.map((render) => (
                      <Grid item xs={12} key={render.id}>
                        <RenderPreview
                          render={render}
                          compareMode={compareMode}
                          isSelected={selectedRenders.includes(render.id)}
                          onToggleSelection={() => dispatch(toggleRenderSelection(render.id))}
                          onCopy={handleCopyToClipboard}
                          onDownload={handleDownload}
                          onRerender={() => handleRenderSingle(render.connectionId)}
                          onSaveVariant={handleSaveVariant}
                          originalPrompt={prompt}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MultiProviderRenderer;