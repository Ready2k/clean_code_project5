/**
 * Script to validate all default templates
 */

import { DEFAULT_TEMPLATES } from '../data/default-templates';
import { validateAllDefaultTemplates, generateValidationReport } from '../utils/template-validator';

function main() {
  console.log('Validating default templates...\n');

  const validation = validateAllDefaultTemplates(DEFAULT_TEMPLATES);
  const report = generateValidationReport(validation.results);

  console.log(report);

  if (!validation.isValid) {
    console.error('\n❌ Template validation failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All templates are valid!');
  }
}

if (require.main === module) {
  main();
}

export { main as validateDefaultTemplates };