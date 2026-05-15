import type { Command } from 'commander';
import { apolloGet } from '../api.js';
import { print, FORMAT_OPTION } from '../output.js';

interface CustomFieldsListOptions {
  modality?: 'account' | 'contact' | 'opportunity';
  format?: string;
}

interface CustomFieldsShowOptions {
  id: string;
  format?: string;
}

export function registerCustomFields(program: Command): void {
  const customFields = program
    .command('custom-fields')
    .description('Inspect typed custom field schema for accounts, contacts, and opportunities');

  customFields
    .command('list')
    .description('List all typed custom fields in your Apollo team')
    .option('--modality <modality>', 'Filter client-side: account, contact, or opportunity')
    .option(...FORMAT_OPTION)
    .action(async (opts: CustomFieldsListOptions) => {
      const data = await apolloGet<{ typed_custom_fields?: Array<{ modality?: string }> }>('/typed_custom_fields');
      const fields = data.typed_custom_fields ?? [];
      const filtered = opts.modality
        ? fields.filter((f) => f.modality === opts.modality)
        : fields;
      print(filtered, opts.format);
    });

  customFields
    .command('show')
    .description('Show a single custom field by ID')
    .requiredOption('--id <id>', 'Custom field ID')
    .option(...FORMAT_OPTION)
    .action(async (opts: CustomFieldsShowOptions) => {
      const data = await apolloGet(`/typed_custom_fields/${opts.id}`);
      print(data, opts.format);
    });
}
