#!/usr/bin/env node

import { Command } from 'commander';
import { docsCommand } from './commands/docs.js';

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

// Show help if no command is provided
if (process.argv.length === 2) {
  program.outputHelp();
}

program.parse();
