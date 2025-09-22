// Metadata indexing for fast prompt discovery

import { PromptRecord } from '../models/prompt';
import { PromptFilters } from '../types/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PromptIndex {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  owner: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  averageRating: number;
  ratingCount: number;
  variableCount: number;
  hasStructured: boolean;
  filePath: string;
}

export interface MetadataIndexer {
  /**
   * Build index from all prompts
   */
  buildIndex(prompts: PromptRecord[]): Promise<void>;

  /**
   * Add prompt to index
   */
  addToIndex(prompt: PromptRecord): Promise<void>;

  /**
   * Remove prompt from index
   */
  removeFromIndex(promptId: string): Promise<void>;

  /**
   * Update prompt in index
   */
  updateIndex(prompt: PromptRecord): Promise<void>;

  /**
   * Search prompts using filters
   */
  searchPrompts(filters: PromptFilters): Promise<PromptIndex[]>;

  /**
   * Get prompt by ID from index
   */
  getPromptById(id: string): Promise<PromptIndex | null>;

  /**
   * Get prompt by slug from index
   */
  getPromptBySlug(slug: string): Promise<PromptIndex | null>;

  /**
   * Get all tags
   */
  getAllTags(): Promise<string[]>;

  /**
   * Get all owners
   */
  getAllOwners(): Promise<string[]>;

  /**
   * Get index statistics
   */
  getIndexStats(): Promise<{
    totalPrompts: number;
    totalTags: number;
    totalOwners: number;
    averageRating: number;
    statusCounts: Record<string, number>;
  }>;

  /**
   * Clear the index
   */
  clearIndex(): Promise<void>;
}

export class FileSystemMetadataIndexer implements MetadataIndexer {
  private readonly indexDir: string;
  private readonly indexFile: string;
  private index: Map<string, PromptIndex> = new Map();
  private isLoaded: boolean = false;

  constructor(indexDir: string = './data/index') {
    this.indexDir = indexDir;
    this.indexFile = path.join(indexDir, 'metadata.index.json');
  }

  /**
   * Initialize index directory and load existing index
   */
  private async initialize(): Promise<void> {
    if (this.isLoaded) return;

    try {
      await fs.access(this.indexDir);
    } catch {
      await fs.mkdir(this.indexDir, { recursive: true });
    }

    await this.loadIndex();
    this.isLoaded = true;
  }

  /**
   * Load index from file
   */
  private async loadIndex(): Promise<void> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf8');
      const indexData = JSON.parse(content);
      
      this.index.clear();
      for (const [id, promptIndex] of Object.entries(indexData)) {
        this.index.set(id, promptIndex as PromptIndex);
      }
    } catch {
      // Index file doesn't exist or is corrupted, start with empty index
      this.index.clear();
    }
  }

  /**
   * Save index to file
   */
  private async saveIndex(): Promise<void> {
    const indexData = Object.fromEntries(this.index);
    await fs.writeFile(this.indexFile, JSON.stringify(indexData, null, 2), 'utf8');
  }

  /**
   * Convert PromptRecord to PromptIndex
   */
  private promptToIndex(prompt: PromptRecord): PromptIndex {
    const averageRating = prompt.history.ratings.length > 0
      ? prompt.history.ratings.reduce((sum, r) => sum + r.score, 0) / prompt.history.ratings.length
      : 0;

    return {
      id: prompt.id,
      slug: prompt.slug,
      title: prompt.metadata.title,
      summary: prompt.metadata.summary,
      tags: prompt.metadata.tags,
      owner: prompt.metadata.owner,
      status: prompt.status,
      createdAt: prompt.created_at,
      updatedAt: prompt.updated_at,
      averageRating: Math.round(averageRating * 100) / 100,
      ratingCount: prompt.history.ratings.length,
      variableCount: prompt.variables.length,
      hasStructured: !!prompt.prompt_structured,
      filePath: `${prompt.slug}.prompt.yaml`
    };
  }

  /**
   * Build index from all prompts
   */
  async buildIndex(prompts: PromptRecord[]): Promise<void> {
    await this.initialize();

    this.index.clear();
    
    for (const prompt of prompts) {
      const promptIndex = this.promptToIndex(prompt);
      this.index.set(prompt.id, promptIndex);
    }

    await this.saveIndex();
  }

  /**
   * Add prompt to index
   */
  async addToIndex(prompt: PromptRecord): Promise<void> {
    await this.initialize();

    const promptIndex = this.promptToIndex(prompt);
    this.index.set(prompt.id, promptIndex);
    
    await this.saveIndex();
  }

  /**
   * Remove prompt from index
   */
  async removeFromIndex(promptId: string): Promise<void> {
    await this.initialize();

    this.index.delete(promptId);
    await this.saveIndex();
  }

  /**
   * Update prompt in index
   */
  async updateIndex(prompt: PromptRecord): Promise<void> {
    await this.initialize();

    const promptIndex = this.promptToIndex(prompt);
    this.index.set(prompt.id, promptIndex);
    
    await this.saveIndex();
  }

  /**
   * Search prompts using filters
   */
  async searchPrompts(filters: PromptFilters): Promise<PromptIndex[]> {
    await this.initialize();

    let results = Array.from(this.index.values());

    // Apply filters
    if (filters.status) {
      results = results.filter(p => p.status === filters.status);
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(p => 
        filters.tags!.some(tag => p.tags.includes(tag))
      );
    }

    if (filters.owner) {
      results = results.filter(p => p.owner === filters.owner);
    }

    if (filters.minRating !== undefined) {
      results = results.filter(p => p.averageRating >= filters.minRating!);
    }

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      results = results.filter(p => 
        p.title.toLowerCase().includes(searchTerm) ||
        p.summary.toLowerCase().includes(searchTerm) ||
        p.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Sort by updated date (newest first)
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return results;
  }

  /**
   * Get prompt by ID from index
   */
  async getPromptById(id: string): Promise<PromptIndex | null> {
    await this.initialize();
    return this.index.get(id) || null;
  }

  /**
   * Get prompt by slug from index
   */
  async getPromptBySlug(slug: string): Promise<PromptIndex | null> {
    await this.initialize();
    
    for (const promptIndex of this.index.values()) {
      if (promptIndex.slug === slug) {
        return promptIndex;
      }
    }
    
    return null;
  }

  /**
   * Get all tags
   */
  async getAllTags(): Promise<string[]> {
    await this.initialize();

    const tagSet = new Set<string>();
    
    for (const promptIndex of this.index.values()) {
      for (const tag of promptIndex.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Get all owners
   */
  async getAllOwners(): Promise<string[]> {
    await this.initialize();

    const ownerSet = new Set<string>();
    
    for (const promptIndex of this.index.values()) {
      if (promptIndex.owner) {
        ownerSet.add(promptIndex.owner);
      }
    }

    return Array.from(ownerSet).sort();
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    totalPrompts: number;
    totalTags: number;
    totalOwners: number;
    averageRating: number;
    statusCounts: Record<string, number>;
  }> {
    await this.initialize();

    const prompts = Array.from(this.index.values());
    const totalPrompts = prompts.length;
    
    const tags = await this.getAllTags();
    const owners = await this.getAllOwners();
    
    const ratingsSum = prompts.reduce((sum, p) => sum + (p.averageRating * p.ratingCount), 0);
    const totalRatings = prompts.reduce((sum, p) => sum + p.ratingCount, 0);
    const averageRating = totalRatings > 0 ? ratingsSum / totalRatings : 0;

    const statusCounts: Record<string, number> = {};
    for (const prompt of prompts) {
      statusCounts[prompt.status] = (statusCounts[prompt.status] || 0) + 1;
    }

    return {
      totalPrompts,
      totalTags: tags.length,
      totalOwners: owners.length,
      averageRating: Math.round(averageRating * 100) / 100,
      statusCounts
    };
  }

  /**
   * Clear the index
   */
  async clearIndex(): Promise<void> {
    await this.initialize();
    
    this.index.clear();
    await this.saveIndex();
  }
}