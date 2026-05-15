import type { Command } from 'commander';
import { apolloGet } from '../api.js';
import { print, FORMAT_OPTION } from '../output.js';

interface LabelsListOptions {
  modality?: 'contacts' | 'accounts';
  format?: string;
}

interface LabelsShowOptions {
  id: string;
  format?: string;
}

export function registerLabels(program: Command): void {
  const labels = program
    .command('labels')
    .description('List labels (a.k.a. lists) for contacts and accounts');

  labels
    .command('list')
    .description('List all labels in your Apollo team')
    .option('--modality <modality>', 'Filter client-side: contacts or accounts')
    .option(...FORMAT_OPTION)
    .action(async (opts: LabelsListOptions) => {
      const data = await apolloGet<Array<{ modality?: string }>>('/labels');
      const filtered = opts.modality
        ? data.filter((l) => l.modality === opts.modality)
        : data;
      print(filtered, opts.format);
    });

  labels
    .command('show')
    .description('Show a single label by ID')
    .requiredOption('--id <id>', 'Label ID')
    .option(...FORMAT_OPTION)
    .action(async (opts: LabelsShowOptions) => {
      const data = await apolloGet(`/labels/${opts.id}`);
      print(data, opts.format);
    });
}
