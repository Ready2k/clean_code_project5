// Example demonstrating the rating and evaluation system

import { FileRatingSystem } from '../services/file-rating-system';
import { PromptRecordClass } from '../models/prompt';

async function demonstrateRatingSystem() {
  // Initialize the rating system
  const ratingSystem = new FileRatingSystem('./example-data');
  await ratingSystem.initialize();

  // Create a sample prompt
  const prompt = new PromptRecordClass({
    metadata: {
      title: 'Code Review Assistant',
      summary: 'Helps review code for best practices',
      tags: ['code', 'review', 'development'],
      owner: 'dev-team'
    },
    prompt_human: {
      goal: 'Review code for best practices and suggest improvements',
      audience: 'Software developers',
      steps: [
        'Analyze the provided code',
        'Identify potential issues',
        'Suggest improvements',
        'Provide examples'
      ],
      output_expectations: {
        format: 'Structured review with sections',
        fields: ['issues', 'suggestions', 'examples']
      }
    }
  });

  console.log('Created prompt:', prompt.id);

  // Simulate multiple users rating the prompt
  await ratingSystem.ratePrompt(prompt.id, 'alice', {
    prompt_id: prompt.id,
    user_id: 'alice',
    score: 5,
    note: 'Excellent prompt! Very thorough.',
    prompt_version: 1
  });

  await ratingSystem.ratePrompt(prompt.id, 'bob', {
    prompt_id: prompt.id,
    user_id: 'bob',
    score: 4,
    note: 'Good structure, could use more examples.',
    prompt_version: 1
  });

  await ratingSystem.ratePrompt(prompt.id, 'charlie', {
    prompt_id: prompt.id,
    user_id: 'charlie',
    score: 4,
    note: 'Works well for most cases.',
    prompt_version: 2
  });

  // Log some prompt runs
  await ratingSystem.logRun({
    prompt_id: prompt.id,
    user_id: 'alice',
    provider: 'openai',
    model: 'gpt-4',
    success: true,
    outcome_note: 'Generated comprehensive code review'
  });

  await ratingSystem.logRun({
    prompt_id: prompt.id,
    user_id: 'bob',
    provider: 'anthropic',
    model: 'claude-3',
    success: true,
    outcome_note: 'Good analysis, missed some edge cases'
  });

  await ratingSystem.logRun({
    prompt_id: prompt.id,
    user_id: 'charlie',
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    success: false,
    outcome_note: 'Response was too generic'
  });

  // Get comprehensive analytics
  const analytics = await ratingSystem.getPromptAnalytics(prompt.id);
  
  console.log('\n=== Prompt Analytics ===');
  console.log('Overall Ratings:');
  console.log(`  Average Score: ${analytics.ratings.average_score}/5`);
  console.log(`  Total Ratings: ${analytics.ratings.total_ratings}`);
  console.log(`  Score Distribution:`, analytics.ratings.score_distribution);

  console.log('\nRun Statistics:');
  console.log(`  Total Runs: ${analytics.runs.total_runs}`);
  console.log(`  Success Rate: ${(analytics.runs.success_rate * 100).toFixed(1)}%`);
  console.log(`  Provider Distribution:`, analytics.runs.provider_distribution);
  console.log(`  Model Distribution:`, analytics.runs.model_distribution);

  console.log('\nVersion-specific Ratings:');
  for (const [version, versionRating] of Object.entries(analytics.version_ratings)) {
    console.log(`  Version ${version}: ${versionRating.average_score}/5 (${versionRating.total_ratings} ratings)`);
  }

  // Get recent ratings
  const recentRatings = await ratingSystem.getPromptRatings(prompt.id);
  console.log('\nRecent Ratings:');
  recentRatings.slice(0, 3).forEach(rating => {
    console.log(`  ${rating.user_id}: ${rating.score}/5 - "${rating.note}"`);
  });

  // Get run history
  const runHistory = await ratingSystem.getRunHistory(prompt.id);
  console.log('\nRecent Runs:');
  runHistory.slice(0, 3).forEach(run => {
    const status = run.success ? '✅' : '❌';
    console.log(`  ${status} ${run.provider}/${run.model} by ${run.user_id}`);
    if (run.outcome_note) {
      console.log(`     Note: ${run.outcome_note}`);
    }
  });

  console.log('\n=== Rating System Demo Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateRatingSystem().catch(console.error);
}

export { demonstrateRatingSystem };