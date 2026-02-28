/**
 * CLI script for automated PropStream scraping.
 * Can be run standalone or scheduled via cron — no Next.js server needed.
 *
 * Usage:
 *   npx tsx scripts/scrape.ts --location "Miami-Dade County, FL"
 *   npx tsx scripts/scrape.ts --location "33101" --min-equity 30 --foreclosure
 *   npx tsx scripts/scrape.ts --location "Miami, FL" --headless false
 *
 * Required env vars:
 *   PROPSTREAM_EMAIL, PROPSTREAM_PASSWORD, DATABASE_URL, ENCRYPTION_KEY
 */

import { autoImportFromPropStream } from '../src/lib/propstream/autoImport';
import type { ScrapeConfig } from '../src/lib/propstream/scraper';

function parseArgs(): ScrapeConfig {
  const args = process.argv.slice(2);
  const config: ScrapeConfig = { location: '' };
  const filters: NonNullable<ScrapeConfig['filters']> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--location':
      case '-l':
        config.location = next ?? '';
        i++;
        break;
      case '--min-equity':
        filters.minEquityPercent = Number(next);
        i++;
        break;
      case '--property-type':
        filters.propertyType = next;
        i++;
        break;
      case '--max-results':
        filters.maxResults = Number(next);
        i++;
        break;
      case '--foreclosure':
        filters.foreclosure = true;
        break;
      case '--pre-foreclosure':
        filters.preForeclosure = true;
        break;
      case '--tax-lien':
        filters.taxLien = true;
        break;
      case '--absentee-owner':
        filters.absenteeOwner = true;
        break;
      case '--headless':
        config.headless = next !== 'false';
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!config.location) {
    console.error('Error: --location is required\n');
    printHelp();
    process.exit(1);
  }

  if (Object.keys(filters).length > 0) {
    config.filters = filters;
  }

  return config;
}

function printHelp() {
  console.log(`
PropStream Automated Scraper

Usage:
  npx tsx scripts/scrape.ts --location <location> [options]

Required:
  --location, -l    Location to search (county, city, or zip code)

Filters:
  --min-equity      Minimum equity percent (0-100)
  --property-type   Property type ("Single Family", "Multi-Family", etc.)
  --max-results     Maximum results to export
  --foreclosure     Include foreclosure filter
  --pre-foreclosure Include pre-foreclosure filter
  --tax-lien        Include tax lien filter
  --absentee-owner  Include absentee owner filter

Options:
  --headless        Run browser headless (default: true, set "false" to watch)
  --help, -h        Show this help

Examples:
  npx tsx scripts/scrape.ts --location "Miami-Dade County, FL"
  npx tsx scripts/scrape.ts --location "33101" --min-equity 30 --foreclosure
  npx tsx scripts/scrape.ts --location "Miami, FL" --headless false
`);
}

async function main() {
  const config = parseArgs();

  console.log(`\nStarting PropStream scrape...`);
  console.log(`  Location: ${config.location}`);
  if (config.filters) {
    console.log(`  Filters:  ${JSON.stringify(config.filters)}`);
  }
  console.log(`  Headless: ${config.headless ?? true}\n`);

  const startTime = Date.now();

  try {
    const result = await autoImportFromPropStream(config);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\nScrape completed in ${elapsed}s`);
    console.log(`  Total rows:  ${result.totalRows}`);
    console.log(`  Imported:    ${result.imported}`);
    console.log(`  Updated:     ${result.updated}`);
    console.log(`  Skipped:     ${result.skipped}`);

    if (result.errors.length > 0) {
      console.log(`  Errors:      ${result.errors.length}`);
      for (const err of result.errors.slice(0, 10)) {
        console.log(`    - ${err}`);
      }
      if (result.errors.length > 10) {
        console.log(`    ... and ${result.errors.length - 10} more`);
      }
    }

    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\nScrape failed after ${elapsed}s`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
