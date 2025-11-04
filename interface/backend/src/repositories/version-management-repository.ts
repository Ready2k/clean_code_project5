import { PoolClient } from 'pg';
import { getDatabaseService } from '../services/database-service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../types/errors.js';
import {
  TemplateVersion,
  TemplateVariable,
  TemplateMetadata
} from '../types/prompt-templates.js';

/**
 * Repository for template version management operations
 * Implements version history tracking, diff calculation, rollback functionality,
 * and version comparison capabilities
 */
export class VersionManagementRepository {
  private db = getDatabaseService();

  /**
   * Create a new version entry
   */
  async createVersion(
    templateId: string,
    content: string,
    variables: TemplateVariable[],
    metadata: TemplateMetadata,
    changeMessage?: string,
    userId?: string
  ): Promise<TemplateVersion> {
    return this.db.transaction(async (client) => {
      // Get the next version number
      const versionQuery = `
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM prompt_template_versions
        WHERE template_id = $1
      `;
      const versionResult = await client.query(versionQuery, [templateId]);
      const nextVersion = versionResult.rows[0].next_version;

      // Insert new version
      const insertQuery = `
        INSERT INTO prompt_template_versions (
          template_id, version_number, content, variables, metadata, change_message, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        templateId,
        nextVersion,
        content,
        JSON.stringify(variables),
        JSON.stringify(metadata),
        changeMessage || 'Version created',
        userId
      ];

      const result = await client.query(insertQuery, values);
      const row = result.rows[0];

      logger.info('Template version created', {
        templateId,
        versionNumber: nextVersion,
        userId
      });

      return this.mapRowToTemplateVersion(row);
    });
  }

  /**
   * Get version history for a template
   */
  async getVersionHistory(
    templateId: string,
    limit?: number,
    offset?: number
  ): Promise<{
    versions: TemplateVersion[];
    total: number;
    hasMore: boolean;
  }> {
    // Count total versions
    const countQuery = `
      SELECT COUNT(*) as total
      FROM prompt_template_versions
      WHERE template_id = $1
    `;

    // Get versions with pagination
    const versionsQuery = `
      SELECT *
      FROM prompt_template_versions
      WHERE template_id = $1
      ORDER BY version_number DESC
      ${limit ? `LIMIT $2` : ''}
      ${offset ? `OFFSET $${limit ? '3' : '2'}` : ''}
    `;

    const params: any[] = [templateId];
    if (limit) params.push(limit);
    if (offset) params.push(offset);

    const [countResult, versionsResult] = await Promise.all([
      this.db.query(countQuery, [templateId]),
      this.db.query(versionsQuery, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const versions = versionsResult.rows.map(row => this.mapRowToTemplateVersion(row));

    return {
      versions,
      total,
      hasMore: offset ? offset + versions.length < total : versions.length < total
    };
  }

  /**
   * Get specific version by template ID and version number
   */
  async getVersion(templateId: string, versionNumber: number): Promise<TemplateVersion | null> {
    const query = `
      SELECT *
      FROM prompt_template_versions
      WHERE template_id = $1 AND version_number = $2
    `;

    const result = await this.db.query(query, [templateId, versionNumber]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplateVersion(result.rows[0]);
  }

  /**
   * Get latest version for a template
   */
  async getLatestVersion(templateId: string): Promise<TemplateVersion | null> {
    const query = `
      SELECT *
      FROM prompt_template_versions
      WHERE template_id = $1
      ORDER BY version_number DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [templateId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplateVersion(result.rows[0]);
  }

  /**
   * Calculate diff between two versions
   */
  async calculateDiff(
    templateId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{
    contentDiff: DiffResult;
    variablesDiff: DiffResult;
    metadataDiff: DiffResult;
  }> {
    const query = `
      SELECT version_number, content, variables, metadata
      FROM prompt_template_versions
      WHERE template_id = $1 AND version_number IN ($2, $3)
      ORDER BY version_number ASC
    `;

    const result = await this.db.query(query, [templateId, fromVersion, toVersion]);
    
    if (result.rows.length !== 2) {
      throw new AppError(
        `Could not find both versions ${fromVersion} and ${toVersion} for template ${templateId}`,
        404,
        'VERSION_NOT_FOUND' as any
      );
    }

    const [oldVersion, newVersion] = result.rows;

    return {
      contentDiff: this.calculateTextDiff(oldVersion.content, newVersion.content),
      variablesDiff: this.calculateJsonDiff(oldVersion.variables, newVersion.variables),
      metadataDiff: this.calculateJsonDiff(oldVersion.metadata, newVersion.metadata)
    };
  }

  /**
   * Rollback template to a specific version
   */
  async rollbackToVersion(
    templateId: string,
    targetVersion: number,
    userId?: string,
    changeMessage?: string
  ): Promise<void> {
    return this.db.transaction(async (client) => {
      // Get the target version
      const versionQuery = `
        SELECT content, variables, metadata
        FROM prompt_template_versions
        WHERE template_id = $1 AND version_number = $2
      `;
      const versionResult = await client.query(versionQuery, [templateId, targetVersion]);
      
      if (versionResult.rows.length === 0) {
        throw new AppError(
          `Version ${targetVersion} not found for template ${templateId}`,
          404,
          'VERSION_NOT_FOUND' as any
        );
      }

      const targetVersionData = versionResult.rows[0];

      // Update the main template with the target version data
      const updateQuery = `
        UPDATE prompt_templates
        SET content = $2,
            variables = $3,
            metadata = $4,
            updated_by = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(updateQuery, [
        templateId,
        targetVersionData.content,
        targetVersionData.variables,
        targetVersionData.metadata,
        userId
      ]);

      // Create a new version entry for the rollback
      const rollbackMessage = changeMessage || `Rolled back to version ${targetVersion}`;
      await this.createVersionInTransaction(
        client,
        templateId,
        targetVersionData.content,
        targetVersionData.variables,
        targetVersionData.metadata,
        rollbackMessage,
        userId
      );

      logger.info('Template rolled back successfully', {
        templateId,
        targetVersion,
        userId
      });
    });
  }

  /**
   * Compare two versions and return detailed comparison
   */
  async compareVersions(
    templateId: string,
    version1: number,
    version2: number
  ): Promise<{
    version1Data: TemplateVersion;
    version2Data: TemplateVersion;
    differences: {
      content: DiffResult;
      variables: DiffResult;
      metadata: DiffResult;
    };
    summary: {
      hasContentChanges: boolean;
      hasVariableChanges: boolean;
      hasMetadataChanges: boolean;
      changeCount: number;
    };
  }> {
    const [v1, v2] = await Promise.all([
      this.getVersion(templateId, version1),
      this.getVersion(templateId, version2)
    ]);

    if (!v1 || !v2) {
      throw new AppError(
        `One or both versions not found: ${version1}, ${version2}`,
        404,
        'VERSION_NOT_FOUND' as any
      );
    }

    const differences = {
      content: this.calculateTextDiff(v1.content, v2.content),
      variables: this.calculateJsonDiff(v1.variables, v2.variables),
      metadata: this.calculateJsonDiff(v1.metadata, v2.metadata)
    };

    const summary = {
      hasContentChanges: differences.content.hasChanges,
      hasVariableChanges: differences.variables.hasChanges,
      hasMetadataChanges: differences.metadata.hasChanges,
      changeCount: [
        differences.content.hasChanges,
        differences.variables.hasChanges,
        differences.metadata.hasChanges
      ].filter(Boolean).length
    };

    return {
      version1Data: v1,
      version2Data: v2,
      differences,
      summary
    };
  }

  /**
   * Merge changes from one version to another (for conflict resolution)
   */
  async mergeVersions(
    templateId: string,
    baseVersion: number,
    sourceVersion: number,
    targetVersion: number,
    mergeStrategy: 'auto' | 'manual',
    manualResolutions?: Record<string, any>,
    userId?: string
  ): Promise<TemplateVersion> {
    return this.db.transaction(async (client) => {
      // Get all three versions
      const versionsQuery = `
        SELECT version_number, content, variables, metadata
        FROM prompt_template_versions
        WHERE template_id = $1 AND version_number IN ($2, $3, $4)
        ORDER BY version_number ASC
      `;

      const result = await client.query(versionsQuery, [
        templateId, baseVersion, sourceVersion, targetVersion
      ]);

      if (result.rows.length !== 3) {
        throw new AppError(
          'Could not find all required versions for merge',
          404,
          'VERSION_NOT_FOUND' as any
        );
      }

      const versions = new Map(result.rows.map(row => [row.version_number, row]));
      const base = versions.get(baseVersion)!;
      const source = versions.get(sourceVersion)!;
      const target = versions.get(targetVersion)!;

      let mergedContent: string;
      let mergedVariables: TemplateVariable[];
      let mergedMetadata: TemplateMetadata;

      if (mergeStrategy === 'auto') {
        // Simple auto-merge: prefer source changes over target
        mergedContent = source.content !== base.content ? source.content : target.content;
        mergedVariables = JSON.stringify(source.variables) !== JSON.stringify(base.variables) 
          ? source.variables 
          : target.variables;
        mergedMetadata = JSON.stringify(source.metadata) !== JSON.stringify(base.metadata)
          ? source.metadata
          : target.metadata;
      } else {
        // Manual merge using provided resolutions
        if (!manualResolutions) {
          throw new AppError(
            'Manual resolutions required for manual merge strategy',
            400,
            'INVALID_REQUEST' as any
          );
        }

        mergedContent = manualResolutions.content || target.content;
        mergedVariables = manualResolutions.variables || target.variables;
        mergedMetadata = manualResolutions.metadata || target.metadata;
      }

      // Create new merged version
      const mergedVersion = await this.createVersionInTransaction(
        client,
        templateId,
        mergedContent,
        mergedVariables,
        mergedMetadata,
        `Merged versions ${sourceVersion} and ${targetVersion} (base: ${baseVersion})`,
        userId
      );

      logger.info('Versions merged successfully', {
        templateId,
        baseVersion,
        sourceVersion,
        targetVersion,
        mergeStrategy,
        userId
      });

      return mergedVersion;
    });
  }

  /**
   * Delete version history older than specified date
   */
  async cleanupOldVersions(
    templateId: string,
    keepVersionsCount: number = 10,
    olderThanDays: number = 365
  ): Promise<number> {
    return this.db.transaction(async (client) => {
      // Keep the most recent versions and versions newer than the specified date
      const deleteQuery = `
        DELETE FROM prompt_template_versions
        WHERE template_id = $1
        AND version_number NOT IN (
          SELECT version_number
          FROM prompt_template_versions
          WHERE template_id = $1
          ORDER BY version_number DESC
          LIMIT $2
        )
        AND created_at < CURRENT_DATE - INTERVAL '${olderThanDays} days'
        RETURNING id
      `;

      const result = await client.query(deleteQuery, [templateId, keepVersionsCount]);
      const deletedCount = result.rows.length;

      logger.info('Old template versions cleaned up', {
        templateId,
        deletedCount,
        keepVersionsCount,
        olderThanDays
      });

      return deletedCount;
    });
  }

  /**
   * Create version within an existing transaction
   */
  private async createVersionInTransaction(
    client: PoolClient,
    templateId: string,
    content: string,
    variables: TemplateVariable[],
    metadata: TemplateMetadata,
    changeMessage?: string,
    userId?: string
  ): Promise<TemplateVersion> {
    // Get the next version number
    const versionQuery = `
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
      FROM prompt_template_versions
      WHERE template_id = $1
    `;
    const versionResult = await client.query(versionQuery, [templateId]);
    const nextVersion = versionResult.rows[0].next_version;

    // Insert new version
    const insertQuery = `
      INSERT INTO prompt_template_versions (
        template_id, version_number, content, variables, metadata, change_message, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      templateId,
      nextVersion,
      content,
      JSON.stringify(variables),
      JSON.stringify(metadata),
      changeMessage || 'Version created',
      userId
    ];

    const result = await client.query(insertQuery, values);
    return this.mapRowToTemplateVersion(result.rows[0]);
  }

  /**
   * Calculate text diff between two strings
   */
  private calculateTextDiff(oldText: string, newText: string): DiffResult {
    if (oldText === newText) {
      return {
        hasChanges: false,
        additions: 0,
        deletions: 0,
        changes: []
      };
    }

    // Simple line-by-line diff
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const changes: DiffChange[] = [];

    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex >= oldLines.length) {
        // Remaining lines are additions
        changes.push({
          type: 'addition',
          line: newIndex + 1,
          content: newLines[newIndex]
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Remaining lines are deletions
        changes.push({
          type: 'deletion',
          line: oldIndex + 1,
          content: oldLines[oldIndex]
        });
        oldIndex++;
      } else if (oldLines[oldIndex] === newLines[newIndex]) {
        // Lines are the same
        oldIndex++;
        newIndex++;
      } else {
        // Lines are different - mark as modification
        changes.push({
          type: 'deletion',
          line: oldIndex + 1,
          content: oldLines[oldIndex]
        });
        changes.push({
          type: 'addition',
          line: newIndex + 1,
          content: newLines[newIndex]
        });
        oldIndex++;
        newIndex++;
      }
    }

    const additions = changes.filter(c => c.type === 'addition').length;
    const deletions = changes.filter(c => c.type === 'deletion').length;

    return {
      hasChanges: true,
      additions,
      deletions,
      changes
    };
  }

  /**
   * Calculate JSON diff between two objects
   */
  private calculateJsonDiff(oldJson: any, newJson: any): DiffResult {
    const oldStr = JSON.stringify(oldJson, null, 2);
    const newStr = JSON.stringify(newJson, null, 2);

    if (oldStr === newStr) {
      return {
        hasChanges: false,
        additions: 0,
        deletions: 0,
        changes: []
      };
    }

    // For JSON, we'll do a simple string comparison
    // In a production system, you might want to use a more sophisticated JSON diff library
    return this.calculateTextDiff(oldStr, newStr);
  }

  /**
   * Map database row to TemplateVersion object
   */
  private mapRowToTemplateVersion(row: any): TemplateVersion {
    return {
      id: row.id,
      templateId: row.template_id,
      versionNumber: row.version_number,
      content: row.content,
      variables: row.variables || [],
      metadata: row.metadata || {},
      changeMessage: row.change_message,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    };
  }
}

/**
 * Diff result interface
 */
export interface DiffResult {
  hasChanges: boolean;
  additions: number;
  deletions: number;
  changes: DiffChange[];
}

/**
 * Individual diff change
 */
export interface DiffChange {
  type: 'addition' | 'deletion' | 'modification';
  line: number;
  content: string;
}