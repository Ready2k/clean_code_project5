import { LLMService } from './enhancement-agent';
export declare class MockLLMService implements LLMService {
    private responses;
    private defaultResponse;
    constructor();
    complete(prompt: string, _options?: {
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
    }): Promise<string>;
    isAvailable(): Promise<boolean>;
    /**
     * Add a custom response for testing
     */
    addResponse(promptPattern: string, response: string): void;
    /**
     * Clear all custom responses
     */
    clearResponses(): void;
    private setupDefaultResponses;
    private generateDefaultEnhancementResponse;
    private generateBlogPostResponse;
    private generateDataAnalysisResponse;
    private generateSummaryResponse;
}
//# sourceMappingURL=mock-llm-service.d.ts.map