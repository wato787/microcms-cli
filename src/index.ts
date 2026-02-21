#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

function findEnvDir(dir: string): string | null {
  const parent = path.dirname(dir);
  if (dir === parent) return null;
  const env = path.join(dir, '.env');
  const envLocal = path.join(dir, '.env.local');
  if (fs.existsSync(env) || fs.existsSync(envLocal)) return dir;
  return findEnvDir(parent);
}

const envDir = findEnvDir(process.cwd()) ?? process.cwd();
dotenv.config({ path: path.join(envDir, '.env') });
dotenv.config({ path: path.join(envDir, '.env.local') });
process.env.__MICROCMS_CLI_ENV_DIR = envDir;

import { Command } from 'commander';
import { genTypesCommand } from './commands/gen-types/index.js';

const program = new Command();

program
  .name('microcms-cli')
  .description('CLI for microCMS')
  .version('0.1.1');

program
  .command('gen-types [endpointId]')
  .description('Fetch API schema from microCMS Management API and generate TypeScript types')
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
