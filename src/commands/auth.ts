import type { Command } from 'commander';
import {
  saveOAuthCredentials,
  saveApiKeyCredentials,
  clearCredentials,
  loadCredentials,
} from '../credentials.js';
import { oauthLogin, revokeToken } from '../oauth.js';
import { apolloGet, apolloGetWithHeaders } from '../api.js';
import { promptSecret, readPipedStdin } from '../utils.js';

interface ApiLoginOptions {
  fromStdin?: boolean;
}

interface ApiProfile {
  first_name?: string;
  last_name?: string;
  email?: string;
}

function profileLabel(p: ApiProfile): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'unknown';
  return `${name} (${p.email ?? 'unknown'})`;
}

async function fetchProfileLabel(): Promise<string> {
  return profileLabel(await apolloGet<ApiProfile>('/users/api_profile'));
}

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('Manage Apollo.io credentials');

  auth
    .command('login')
    .description('Log in to Apollo.io via browser (OAuth)')
    .action(async () => {
      try {
        const tokens = await oauthLogin();
        saveOAuthCredentials(tokens);
        console.log('Successfully logged in.');
        process.exit(0);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Login failed: ${message}`);
        process.exit(1);
      }
    });

  auth
    .command('api-login')
    .description('Authenticate with an Apollo API key (saved to ~/.config/apollo/credentials with mode 600)')
    .option('--from-stdin', 'Read the API key from stdin instead of prompting')
    .action(async (opts: ApiLoginOptions) => {
      const apiKey = opts.fromStdin
        ? await readPipedStdin()
        : await promptSecret('Apollo API key');
      if (!apiKey) {
        console.error('Error: empty API key');
        process.exit(1);
      }
      // Verify the key BEFORE persisting, so a bad key never touches disk.
      const res = await apolloGetWithHeaders<ApiProfile>('/users/api_profile', { 'X-Api-Key': apiKey });
      if (!res.ok || !res.data) {
        console.error(`Error: API key authentication failed (HTTP ${res.status})`);
        process.exit(1);
      }
      saveApiKeyCredentials(apiKey);
      console.log(`Successfully logged in as ${profileLabel(res.data)} via API key.`);
    });

  auth
    .command('logout')
    .description('Remove saved credentials (OAuth or API key)')
    .action(async () => {
      const creds = loadCredentials();
      if (!creds) {
        console.log('No credentials found.');
        return;
      }
      if (creds.type === 'oauth' && creds.access_token) {
        await revokeToken(creds.access_token, creds.client_id).catch(() => {});
      }
      clearCredentials();
      console.log('Logged out.');
    });

  auth
    .command('whoami')
    .description('Show the currently authenticated user and auth method')
    .action(async () => {
      const envKey = process.env.APOLLO_API_KEY;
      let method: string;
      if (envKey) {
        method = 'API key (from APOLLO_API_KEY env)';
      } else {
        const creds = loadCredentials();
        if (!creds) {
          console.log('Not logged in.');
          return;
        }
        method = creds.type === 'api_key' ? 'API key' : 'OAuth';
      }
      const label = await fetchProfileLabel();
      console.log(`Logged in as ${label} via ${method}.`);
    });
}
