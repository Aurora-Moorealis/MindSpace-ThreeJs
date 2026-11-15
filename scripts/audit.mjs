#!/usr/bin/env node
/**
 * Headless data audit. Run with `npm run audit`.
 */
import { auditData } from '../src/core/audit.js';

const result = auditData();
console.log('Outpost Lunar — data audit');
console.log(JSON.stringify(result.counts, null, 2));
if (result.warnings.length) {
  console.warn(`\nWarnings (${result.warnings.length}):`);
  for (const warning of result.warnings) console.warn(`  ! ${warning}`);
}
if (!result.ok) {
  console.error(`\nErrors (${result.errors.length}):`);
  for (const error of result.errors) console.error(`  x ${error}`);
  process.exit(1);
}
console.log('\nPASS — all data rows are valid.');
