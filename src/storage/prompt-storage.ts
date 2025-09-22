// Prompt Storage interface and implementation - File-based storage operations

import { PromptRecord, PromptRecordClass } from '../models/prompt';
import { ProviderPayload } from '../types/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface PromptStorage {
  /**
   * Save a prompt to filesystem
   */
  savePrompt(prompt: PromptRecord): Promise<void>;

  /**
   * Load a prompt from filesystem
   */
  loadPrompt(id: string): Promise<PromptRecord>;

  /**
   * Load a prompt by slug
   */
  loadPromptBySlug(slug: string): Promise<PromptRecord>;

  /**
   * List all prompts
   */
  listPrompts(): Promise<PromptRecord[]>;

  /**
   * Delete a prompt
   */
  deletePrompt(id: string): Promise<void>;

  /**
   * Check if a prompt exists
   */
  promptExists(id: string): Promise<boolean>;

  /**
   * Save a rendered prompt
   */
  saveRender(promptId: string, provider: string, payload: ProviderPayload): Promise<string>;

  /**
   * Load a rendered prompt
   */
  loadRender(contentRef: string): Promise<ProviderPayload>;

  /**
   * Generate unique slug from title
   */
  generateSlug(title: string): Promise<string>;

  /**
   * Get directory structure info
   */
  getStorageInfo(): Promise<{
    promptsDir: string;
    rendersDir: string;
    specsDir: string;
    totalPrompts: number;
    totalRenders: number;
  }>;
}

export class FileSystemPromptStorage implements PromptStorage {
  private readonly baseDir: string;
  private readonly promptsDir: string;
  private readonly rendersDir: string;
  private readonly specsDir: string;

  constructor(baseDir: string = './data') {
    this.baseDir = baseDir;
    this.promptsDir = path.join(baseDir, 'prompts');
    this.rendersDir = path.join(baseDir, 'renders');
    this.specsDir = path.join(baseDir, 'specs');
  }

  /**
   * Initialize directory structure
   */
  async initialize(): Promise<void> {
    await this.ensureDirectoryExists(this.baseDir);
    await this.ensureDirectoryExists(this.promptsDir);
    await this.ensureDirectoryExists(this.rendersDir);
    await this.ensureDirectoryExists(this.specsDir);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Generate file path for a prompt
   */
  private getPromptFilePath(slug: string): string {
    return path.join(this.promptsDir, `${slug}.prompt.yaml`);
  }

  /**
   * Generate file path for a structured prompt
   */
  private getStructuredPromptFilePath(slug: string): string {
    return path.join(this.promptsDir, `${slug}.structured.yaml`);
  }

  /**
   * Generate file path for a render
   */
  private getRenderFilePath(contentRef: string): string {
    return path.join(this.rendersDir, `${contentRef}.json`);
  }

  /**
   * Save a prompt to filesystem
   */
  async savePrompt(prompt: PromptRecord): Promise<void> {
    await this.initialize();
    
    const promptRecord = prompt instanceof PromptRecordClass ? prompt : new PromptRecordClass(prompt);
    const filePath = this.getPromptFilePath(promptRecord.slug);
    
    try {
      const yamlContent = promptRecord.toYAML();
      await fs.writeFile(filePath, yamlContent, 'utf8');
      
      // Save structured prompt separately if it exists
      if (promptRecord.prompt_structured) {
        const structuredPath = this.getStructuredPromptFilePath(promptRecord.slug);
        const structuredYaml = this.structuredPromptToYAML(promptRecord.prompt_structured);
        await fs.writeFile(structuredPath, structuredYaml, 'utf8');
      }
    } catch (error) {
      throw new Error(`Failed to save prompt ${promptRecord.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load a prompt from filesystem
   */
  async loadPrompt(id: string): Promise<PromptRecord> {
    await this.initialize();
    
    // Find the prompt file by ID
    const files = await fs.readdir(this.promptsDir);
    const promptFiles = files.filter(f => f.endsWith('.prompt.yaml'));
    
    for (const file of promptFiles) {
      const filePath = path.join(this.promptsDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const prompt = PromptRecordClass.fromYAML(content);
        
        if (prompt.id === id) {
          // Load structured prompt if it exists
          const slug = path.basename(file, '.prompt.yaml');
          await this.loadStructuredPrompt(prompt, slug);
          return prompt;
        }
      } catch (error) {
        // Skip corrupted files
        continue;
      }
    }
    
    throw new Error(`Prompt with ID ${id} not found`);
  }

  /**
   * Load a prompt by slug
   */
  async loadPromptBySlug(slug: string): Promise<PromptRecord> {
    await this.initialize();
    
    const filePath = this.getPromptFilePath(slug);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const prompt = PromptRecordClass.fromYAML(content);
      
      // Load structured prompt if it exists
      await this.loadStructuredPrompt(prompt, slug);
      
      return prompt;
    } catch (error) {
      throw new Error(`Prompt with slug ${slug} not found: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load structured prompt if it exists
   */
  private async loadStructuredPrompt(prompt: PromptRecordClass, slug: string): Promise<void> {
    const structuredPath = this.getStructuredPromptFilePath(slug);
    
    try {
      const structuredContent = await fs.readFile(structuredPath, 'utf8');
      prompt.prompt_structured = this.parseStructuredPromptYAML(structuredContent);
    } catch {
      // Structured prompt doesn't exist, which is fine
    }
  }

  /**
   * List all prompts
   */
  async listPrompts(): Promise<PromptRecord[]> {
    await this.initialize();
    
    const prompts: PromptRecord[] = [];
    
    try {
      const files = await fs.readdir(this.promptsDir);
      const promptFiles = files.filter(f => f.endsWith('.prompt.yaml'));
      
      for (const file of promptFiles) {
        try {
          const filePath = path.join(this.promptsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const prompt = PromptRecordClass.fromYAML(content);
          
          // Load structured prompt if it exists
          const slug = path.basename(file, '.prompt.yaml');
          await this.loadStructuredPrompt(prompt, slug);
          
          prompts.push(prompt);
        } catch (error) {
          // Skip corrupted files but log the error
          console.warn(`Failed to load prompt file ${file}:`, error);
        }
      }
    } catch (error) {
      throw new Error(`Failed to list prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return prompts;
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(id: string): Promise<void> {
    const prompt = await this.loadPrompt(id);
    const promptPath = this.getPromptFilePath(prompt.slug);
    const structuredPath = this.getStructuredPromptFilePath(prompt.slug);
    
    try {
      await fs.unlink(promptPath);
      
      // Delete structured prompt if it exists
      try {
        await fs.unlink(structuredPath);
      } catch {
        // Structured prompt doesn't exist, which is fine
      }
      
      // Delete associated renders
      for (const render of prompt.renders) {
        try {
          const renderPath = this.getRenderFilePath(render.content_ref);
          await fs.unlink(renderPath);
        } catch {
          // Render file doesn't exist, which is fine
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete prompt ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a prompt exists
   */
  async promptExists(id: string): Promise<boolean> {
    try {
      await this.loadPrompt(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save a rendered prompt
   */
  async saveRender(promptId: string, provider: string, payload: ProviderPayload): Promise<string> {
    await this.initialize();
    
    const contentRef = `${promptId}_${provider}_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const filePath = this.getRenderFilePath(contentRef);
    
    try {
      const renderData = {
        contentRef,
        promptId,
        provider,
        createdAt: new Date().toISOString(),
        payload
      };
      
      await fs.writeFile(filePath, JSON.stringify(renderData, null, 2), 'utf8');
      return contentRef;
    } catch (error) {
      throw new Error(`Failed to save render: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load a rendered prompt
   */
  async loadRender(contentRef: string): Promise<ProviderPayload> {
    const filePath = this.getRenderFilePath(contentRef);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const renderData = JSON.parse(content);
      return renderData.payload;
    } catch (error) {
      throw new Error(`Failed to load render ${contentRef}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate unique slug from title
   */
  async generateSlug(title: string): Promise<string> {
    const baseSlug = this.createSlugFromTitle(title);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure uniqueness
    while (await this.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Create slug from title
   */
  private createSlugFromTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading and trailing dashes
      .trim()
      .substring(0, 50)
      .replace(/-+$/, ''); // Remove trailing dashes after substring
  }

  /**
   * Check if slug exists
   */
  private async slugExists(slug: string): Promise<boolean> {
    try {
      await this.loadPromptBySlug(slug);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get directory structure info
   */
  async getStorageInfo(): Promise<{
    promptsDir: string;
    rendersDir: string;
    specsDir: string;
    totalPrompts: number;
    totalRenders: number;
  }> {
    await this.initialize();
    
    let totalPrompts = 0;
    let totalRenders = 0;
    
    try {
      const promptFiles = await fs.readdir(this.promptsDir);
      totalPrompts = promptFiles.filter(f => f.endsWith('.prompt.yaml')).length;
    } catch {
      // Directory doesn't exist or is empty
    }
    
    try {
      const renderFiles = await fs.readdir(this.rendersDir);
      totalRenders = renderFiles.filter(f => f.endsWith('.json')).length;
    } catch {
      // Directory doesn't exist or is empty
    }
    
    return {
      promptsDir: this.promptsDir,
      rendersDir: this.rendersDir,
      specsDir: this.specsDir,
      totalPrompts,
      totalRenders
    };
  }

  /**
   * Convert structured prompt to YAML
   */
  private structuredPromptToYAML(structured: any): string {
    const YAML = require('yaml');
    return YAML.stringify(structured, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0
    });
  }

  /**
   * Parse structured prompt from YAML
   */
  private parseStructuredPromptYAML(yamlContent: string): any {
    const YAML = require('yaml');
    return YAML.parse(yamlContent);
  }
}