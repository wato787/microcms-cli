#!/usr/bin/env node

import { Command } from 'commander';
import { docsCommand } from './commands/docs.js';
import { genTypesCommand } from './commands/gen-types.js';

const program = new Command();

program
  .name('microcms')
  .description('CLI for microCMS')
  .version('0.1.0');

program
  .command('docs [path]')
  .description('Display microCMS documentation')
  .action((path?: string) => {
    docsCommand(path);
  });

program
  .command('gen-types [endpointId]')
  .description('Generate TypeScript types from microCMS Management API schema')
  .option(
    '-o, --output <path>',
    'Output path (default: ./types/microcms.d.ts)',
    './types/microcms.d.ts',
  )
  .option('--all', 'Generate types for all endpoints')
  .option('--service-domain <domain>', 'Override MICROCMS_SERVICE_DOMAIN')
  .option('--api-key <key>', 'Override MICROCMS_MANAGEMENT_API_KEY')
  .action(async (endpointId: string | undefined, options: {
    output?: string;
    all?: boolean;
    serviceDomain?: string;
    apiKey?: string;
  }) => {
    await genTypesCommand(endpointId, options);
  });

// Show help if no command is provided
if (process.argv.length === 2) {
  program.outputHelp();
}

program.parse();
