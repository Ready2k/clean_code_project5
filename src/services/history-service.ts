// History Service - Handles prompt history display, audit trails, and version-specific rating association

import { PromptRecord } from '../models/prompt';
import { VersionManager, VersionComparison, PromptVersionManager } from './version-manager';

export interface HistoryEntry {
  version: number;
  message: string;
  author: string;
  created_at: string;
  changes?: VersionComparison;
  ratings: Array<{
    user: string;
    score: number;
    note: string;
    created_at: string;
  }>;
}

export interface AuditTrailEntry {
  id: string;
  promptId: string;
  action: 'created' | 'updated' | 'enhanced' | 'rated' | 'rendered' | 'deleted';
  version: number;
  author: string;
  timestamp: string;
  details: Record<string, any>;
  changes?: VersionComparison;
}

export interface HistoryDisplayOptions {
  includeChanges?: boolean;
  includeRatings?: boolean;
  maxEntries?: number;
  fromVersion?: number;
  toVersion?: number;
}

export interface HistoryService {
  /**
   * Get formatted history for display
   */
  getHistoryDisplay(prompt: PromptRecord, options?: HistoryDisplayOptions): HistoryEntry[];

  /**
   * Get audit trail for a prompt
   */
  getAuditTrail(promptId: string): AuditTrailEntry[];

  /**
   * Add audit trail entry
   */
  addAuditEntry(entry: Omit<AuditTrailEntry, 'id' | 'timestamp'>): void;

  /**
   * Get ratings for a specific version
   */
  getVersionRatings(prompt: PromptRecord, version: number): Array<{
    user: string;
    score: number;
    note: string;
    created_at: string;
  }>;

  /**
   * Associate rating with specific version
   */
  associateRatingWithVersion(prompt: PromptRecord, rating: {
    user: string;
    score: number;
    note: string;
    version: number;
  }): void;

  /**
   * Get version statistics
   */
  getVersionStatistics(prompt: PromptRecord): {
    totalVersions: number;
    totalRatings: number;
    averageRating: number;
    mostActiveAuthor: string;
    versionFrequency: Array<{ version: number; ratingsCount: number; averageRating: number }>;
  };
}

export class PromptHistoryService implements HistoryService {
  private versionManager: VersionManager;
  private auditTrail: Map<string, AuditTrailEntry[]> = new Map();

  constructor(versionManager?: VersionManager) {
    this.versionManager = versionManager || new PromptVersionManager();
  }

  /**
   * Get formatted history for display
   */
  getHistoryDisplay(prompt: PromptRecord, options: HistoryDisplayOptions = {}): HistoryEntry[] {
    const {
      includeChanges = false,
      includeRatings = true,
      maxEntries,
      fromVersion,
      toVersion
    } = options;

    let versions = this.versionManager.getVersionHistory(prompt);

    // Filter by version range
    if (fromVersion !== undefined || toVersion !== undefined) {
      versions = versions.filter(v => {
        if (fromVersion !== undefined && v.number < fromVersion) return false;
        if (toVersion !== undefined && v.number > toVersion) return false;
        return true;
      });
    }

    // Limit entries
    if (maxEntries && maxEntries > 0) {
      versions = versions.slice(0, maxEntries);
    }

    const entries: HistoryEntry[] = [];

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const entry: HistoryEntry = {
        version: version.number,
        message: version.message,
        author: version.author,
        created_at: version.created_at,
        ratings: includeRatings ? this.getVersionRatings(prompt, version.number) : []
      };

      // Add changes if requested and we have a previous version to compare
      if (includeChanges && i < versions.length - 1) {
        const previousVersion = versions[i + 1];
        // Note: This would require storing previous states or reconstructing them
        // For now, we'll indicate that changes are available but not computed
        entry.changes = {
          fromVersion: previousVersion.number,
          toVersion: version.number,
          changes: [],
          summary: 'Changes available - use version comparison for details'
        };
      }

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Get audit trail for a prompt
   */
  getAuditTrail(promptId: string): AuditTrailEntry[] {
    const trail = this.auditTrail.get(promptId) || [];
    return [...trail].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Add audit trail entry
   */
  addAuditEntry(entry: Omit<AuditTrailEntry, 'id' | 'timestamp'>): void {
    const fullEntry: AuditTrailEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date().toISOString()
    };

    const existingTrail = this.auditTrail.get(entry.promptId) || [];
    existingTrail.push(fullEntry);
    this.auditTrail.set(entry.promptId, existingTrail);
  }

  /**
   * Get ratings for a specific version
   */
  getVersionRatings(prompt: PromptRecord, _version: number): Array<{
    user: string;
    score: number;
    note: string;
    created_at: string;
  }> {
    // For now, we'll return all ratings since the current model doesn't associate ratings with specific versions
    // In a future enhancement, we could extend the rating model to include version information
    // For the current implementation, we return all ratings for any version request
    return [...prompt.history.ratings];
  }

  /**
   * Associate rating with specific version
   */
  associateRatingWithVersion(prompt: PromptRecord, rating: {
    user: string;
    score: number;
    note: string;
    version: number;
  }): void {
    // Remove existing rating from same user
    prompt.history.ratings = prompt.history.ratings.filter(r => r.user !== rating.user);

    // Add new rating (note: current model doesn't support version-specific ratings)
    // This would need to be enhanced in the future
    prompt.history.ratings.push({
      user: rating.user,
      score: rating.score,
      note: rating.note,
      created_at: new Date().toISOString()
    });

    // Add audit trail entry
    this.addAuditEntry({
      promptId: prompt.id,
      action: 'rated',
      version: rating.version,
      author: rating.user,
      details: {
        score: rating.score,
        note: rating.note,
        targetVersion: rating.version
      }
    });
  }

  /**
   * Get version statistics
   */
  getVersionStatistics(prompt: PromptRecord): {
    totalVersions: number;
    totalRatings: number;
    averageRating: number;
    mostActiveAuthor: string;
    versionFrequency: Array<{ version: number; ratingsCount: number; averageRating: number }>;
  } {
    const versions = prompt.history.versions;
    const ratings = prompt.history.ratings;

    // Count authors
    const authorCounts = new Map<string, number>();
    versions.forEach(v => {
      authorCounts.set(v.author, (authorCounts.get(v.author) || 0) + 1);
    });

    const mostActiveAuthor = authorCounts.size > 0 
      ? [...authorCounts.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0]
      : '';

    // Calculate average rating
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;

    // Version frequency (for current implementation, all ratings are associated with current version)
    const versionFrequency = versions.map(v => ({
      version: v.number,
      ratingsCount: v.number === prompt.version ? ratings.length : 0,
      averageRating: v.number === prompt.version ? averageRating : 0
    }));

    return {
      totalVersions: versions.length + 1, // +1 for current version
      totalRatings: ratings.length,
      averageRating: Math.round(averageRating * 100) / 100,
      mostActiveAuthor,
      versionFrequency
    };
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear audit trail for a prompt (useful for testing)
   */
  clearAuditTrail(promptId: string): void {
    this.auditTrail.delete(promptId);
  }

  /**
   * Get all audit trails (useful for system-wide auditing)
   */
  getAllAuditTrails(): Map<string, AuditTrailEntry[]> {
    return new Map(this.auditTrail);
  }
}