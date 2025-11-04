#!/usr/bin/env node

/**
 * Template Seeding CLI Script
 * 
 * Command-line interface for seeding default templates into the database
 */

import { Pool } from 'pg';
import { TemplateSeedingService, SeedingOptions } from '../services/template-seeding-service';
import { TemplateRepository } from '../repositories/template-repository';
import { VersionManagementRepository } from '../repositories/version-management-repository';
import { AnalyticsDataRepository } from '../repositories/analytics-data-repository';

interface CLIOptions {
  command: 'seed' | 'rollback' | 'status' | 'help';
  overwrite?: boolean;
  dryRun?: boolean;
  skipValidation?: boolean;
  skipVersions?: boolean;
  skipMetrics?: boolean;
  seedingId?: string;
  verbose?: boolean;
}

class TemplateSeedingCLI {
  private seedingService: TemplateSeedingService;
  private db: Pool;

  constructor() {
    // Initialize database connection
    this.db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'prompt_library',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    });

    // Initialize repositories
    const templateRepository = new TemplateRepository();
    const versionRepository = new VersionManagementRepository();
    const analyticsRepository = new AnalyticsDataRepository();

    // Initialize seeding service
    this.seedingService = new TemplateSeedingService(
      templateRepository,
      versionRepository,
      analyticsRepository,
      this.db
    );
  }

  async run(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    try {
      switch (options.command) {
        case 'seed':
          await this.handleSeed(options);
          break;
        case 'rollback':
          await this.handleRollback(options);
          break;
        case 'status':
          await this.handleStatus(options);
          break;
        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    } finally {
      await this.db.end();
    }
  }

  private parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {
      command: 'help'
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case 'seed':
        case 'rollback':
        case 'status':
        case 'help':
          options.command = arg;
          break;
        case '--overwrite':
        case '-o':
          options.overwrite = true;
          break;
        case '--dry-run':
        case '-d':
          options.dryRun = true;
          break;
        case '--skip-validation':
          options.skipValidation = true;
          break;
        case '--skip-versions':
          options.skipVersions = true;
          break;
        case '--skip-metrics':
          options.skipMetrics = true;
          break;
        case '--seeding-id':
        case '-s':
          options.seedingId = args[++i];
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
      }
    }

    return options;
  }

  private async handleSeed(options: CLIOptions): Promise<void> {
    console.log('🌱 Starting template seeding...\n');

    const seedingOptions: SeedingOptions = {
      overwriteExisting: options.overwrite || false,
      validateTemplates: !options.skipValidation,
      createVersions: !options.skipVersions,
      initializeMetrics: !options.skipMetrics,
      dryRun: options.dryRun || false
    };

    if (options.dryRun) {
      console.log('🔍 Running in dry-run mode (no changes will be made)\n');
    }

    if (options.verbose) {
      console.log('Seeding options:', JSON.stringify(seedingOptions, null, 2));
      console.log('');
    }

    const result = await this.seedingService.seedDefaultTemplates(seedingOptions);

    // Display results
    console.log('📊 Seeding Results:');
    console.log(`   Templates processed: ${result.templatesSeeded}`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Seeding ID: ${result.seedingId}`);

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (result.success) {
      console.log('\n✅ Template seeding completed successfully!');
      if (!options.dryRun) {
        console.log(`💾 Use seeding ID "${result.seedingId}" for rollback if needed`);
      }
    } else {
      console.log('\n❌ Template seeding failed!');
      process.exit(1);
    }
  }

  private async handleRollback(options: CLIOptions): Promise<void> {
    if (!options.seedingId) {
      console.error('❌ Seeding ID is required for rollback. Use --seeding-id <id>');
      process.exit(1);
    }

    console.log(`🔄 Rolling back seeding: ${options.seedingId}\n`);

    const result = await this.seedingService.rollbackSeeding(options.seedingId);

    console.log('📊 Rollback Results:');
    console.log(`   Templates removed: ${result.templatesRemoved}`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (result.success) {
      console.log('\n✅ Rollback completed successfully!');
    } else {
      console.log('\n❌ Rollback failed!');
      process.exit(1);
    }
  }

  private async handleStatus(options: CLIOptions): Promise<void> {
    console.log('📈 Template Seeding Status\n');

    const status = await this.seedingService.getSeedingStatus();

    console.log(`Total default templates: ${status.totalDefaultTemplates}`);
    console.log(`Seeded templates: ${status.seededTemplates}`);
    console.log(`Missing templates: ${status.missingTemplates.length}`);
    
    if (status.lastSeedingDate) {
      console.log(`Last seeding: ${status.lastSeedingDate.toISOString()}`);
    } else {
      console.log('Last seeding: Never');
    }

    if (status.missingTemplates.length > 0) {
      console.log('\n❌ Missing templates:');
      status.missingTemplates.forEach(key => console.log(`   - ${key}`));
      console.log('\nRun "npm run seed-templates seed" to seed missing templates');
    } else {
      console.log('\n✅ All default templates are seeded');
    }

    if (options.verbose) {
      console.log('\n📋 Detailed Status:');
      console.log(`   Completion: ${Math.round((status.seededTemplates / status.totalDefaultTemplates) * 100)}%`);
    }
  }

  private showHelp(): void {
    console.log(`
🌱 Template Seeding CLI

USAGE:
  npm run seed-templates <command> [options]

COMMANDS:
  seed      Seed default templates into the database
  rollback  Rollback a previous seeding operation
  status    Show current seeding status
  help      Show this help message

OPTIONS:
  --overwrite, -o          Overwrite existing templates
  --dry-run, -d           Run without making changes
  --skip-validation       Skip template validation
  --skip-versions         Skip creating version entries
  --skip-metrics          Skip initializing metrics
  --seeding-id, -s <id>   Seeding ID for rollback
  --verbose, -v           Show detailed output

EXAMPLES:
  npm run seed-templates seed                    # Seed templates
  npm run seed-templates seed --dry-run          # Preview seeding
  npm run seed-templates seed --overwrite        # Overwrite existing
  npm run seed-templates rollback -s seed-123   # Rollback seeding
  npm run seed-templates status                  # Check status

ENVIRONMENT VARIABLES:
  DB_HOST      Database host (default: localhost)
  DB_PORT      Database port (default: 5432)
  DB_NAME      Database name (default: prompt_library)
  DB_USER      Database user (default: postgres)
  DB_PASSWORD  Database password (default: password)
`);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new TemplateSeedingCLI();
  cli.run(process.argv.slice(2)).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { TemplateSeedingCLI };